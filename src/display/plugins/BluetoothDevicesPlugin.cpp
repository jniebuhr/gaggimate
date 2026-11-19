#include "BluetoothDevicesPlugin.h"
#include <cmath> // For isfinite()
#include <display/core/Controller.h>
#include <display/core/ProfileManager.h>

static const char *TAG = "BluetoothDevices";

static constexpr std::array<BluetoothDeviceType, BLUETOOTH_DEVICE_TYPE_COUNT> DEVICE_TYPES = {BluetoothDeviceType::SCALE,
                                                                                              BluetoothDeviceType::GRINDER};

BluetoothDevicesPlugin BLEDevices;

BluetoothDevicesPlugin::BluetoothDevicesPlugin() = default;

BluetoothDevicesPlugin::~BluetoothDevicesPlugin() noexcept {
    try {
        // Disable active flag first to stop processing
        active = false;

        // Give any running callbacks time to complete
        delay(100);

        for (const BluetoothDeviceType type : DEVICE_TYPES) {
            disconnect(type);
        }

        if (scanner != nullptr) {
            // Stop scanning first
            scanner->stopAsyncScan();
            // Give it time to actually stop
            delay(50);
            scanner.reset();
        }
    } catch (...) {
        // Destructors must not propagate exceptions.
    }
}

void BluetoothDevicesPlugin::setup(Controller *controller, PluginManager *manager) {
    if (controller == nullptr || manager == nullptr) {
        ESP_LOGE(TAG, "Invalid controller or manager passed to setup");
        return;
    }

    this->controller = controller;
    this->pluginManager = manager;

    BluetoothDevices::registerBuiltinDrivers();

    this->scanner.reset(new (std::nothrow) BluetoothDeviceScanner());
    if (this->scanner == nullptr) {
        ESP_LOGE(TAG, "Failed to create the device scanner - out of memory");
        return;
    }

    manager->on("controller:bluetooth:connect", [this](Event const &) {
        if (this->controller != nullptr && this->controller->getMode() != MODE_STANDBY) {
            ESP_LOGI(TAG, "Resuming scanning");
            requestScan(false);
            active = true;
        }
    });
    manager->on("controller:bluetooth:disconnect", [this](Event const &) {
        ESP_LOGW(TAG, "Controller disconnected, stopping BLE scan");
        active = false;
    });
    manager->on("controller:brew:prestart", [this](Event const &) { onProcessStart(); });
    manager->on("controller:brew:end", [this](Event const &) {
        BluetoothScale *connectedScale = scale();
        if (connectedScale != nullptr && connectedScale->isConnected() && connectedScale->hasTimerControl()) {
            connectedScale->stopTimer();
        }
    });
    manager->on("controller:grind:start", [this](Event const &) { onProcessStart(); });
    manager->on("controller:mode:change", [this](Event const &event) {
        if (event.getInt("value") != MODE_STANDBY) {
            ESP_LOGI(TAG, "Resuming scanning");
            requestScan(false);
            active = true;
            shutdownPending = false;
        } else {
            shutdownPending = true;
            active = false;
        }
    });
    // Saving a profile re-selects the current one, so this also covers edits of the selected profile.
    manager->on("profiles:profile:select", [this](Event const &) { grinderSyncRequested = true; });
}

void BluetoothDevicesPlugin::loop() {
    if (controller == nullptr || scanner == nullptr) {
        return;
    }
    for (const BluetoothDeviceType type : DEVICE_TYPES) {
        if (slot(type).forgetRequested.exchange(false)) {
            ESP_LOGI(TAG, "Forgetting saved %s", bluetoothDeviceTypeName(type));
            setSavedAddress(type, "");
            setSavedName(type, "");
            slot(type).doConnect = false;
            disconnect(type);
            if (active) {
                requestScan(false);
            }
        }
    }
    bool connectFailed = false;
    for (const BluetoothDeviceType type : DEVICE_TYPES) {
        if (slot(type).doConnect && slot(type).device == nullptr) {
            connectFailed = !establishConnection(type) || connectFailed;
        }
    }
    if (connectFailed) {
        // Rescan only after every pending connect ran: starting the scan clears the list they look their device up in.
        scanner->initializeAsyncScan();
    }
    if (!active) {
        for (const BluetoothDeviceType type : DEVICE_TYPES) {
            auto &device = slot(type).device;
            if (device == nullptr) {
                continue;
            }
            // Entering standby powers the device off too; a no-op for drivers without shutdown support.
            if (shutdownPending && device->isConnected()) {
                device->shutdown();
                delay(100);
            }
            disconnect(type);
        }
        shutdownPending = false;
        if (scanner->isScanRunning()) {
            scanner->stopAsyncScan();
        }
    }
    const unsigned long now = millis();
    if (scanRequested.exchange(false)) {
        // No running scan (every slot connected) closes the window right away.
        const bool scanning = scanner->isScanRunning();
        scanWindowOpen = true;
        scanDeadline = now + (scanning ? SCAN_WINDOW_MS : 0);
    }
    if (scanWindowOpen && static_cast<long>(now - scanDeadline) >= 0) {
        emitScanComplete();
    }
    if (grinderSyncRequested.exchange(false)) {
        syncGrinderProfile(false);
    }
    if (now - lastUpdate > UPDATE_INTERVAL_MS) {
        lastUpdate = now;
        update();
    }
}

void BluetoothDevicesPlugin::update() {
    if (!active)
        return;

    bool connectionLost = false;
    for (const BluetoothDeviceType type : DEVICE_TYPES) {
        auto &device = slot(type).device;
        if (device == nullptr) {
            continue;
        }
        if (!device->isConnected()) {
            // Drivers reconnect inside update() with a blocking connect(); drop the device and let the scan find it (GM-215).
            ESP_LOGW(TAG, "%s connection lost, resuming scan", bluetoothDeviceTypeName(type));
            emitDeviceEvent("bluetooth:disconnect", type, device->getDeviceAddress(), "name",
                            String(device->getDeviceName().c_str()));
            disconnect(type);
            connectionLost = true;
            continue;
        }
        device->update();
        pollDeviceMetadata(type);
    }
    if (connectionLost) {
        // A stopped scanner still lists the lost device; starting it clears the list so it is not "found" right away.
        scanner->initializeAsyncScan();
        return;
    }

    const auto discoveredDevices = scanner->getDiscoveredDevices();
    bool connectPending = false;
    for (const BluetoothDeviceType type : DEVICE_TYPES) {
        if (slot(type).device != nullptr) {
            continue;
        }
        const String saved = getSavedAddress(type);
        if (!slot(type).doConnect && saved != "") {
            for (const auto &d : discoveredDevices) {
                if (d.getType() == type && d.getAddress().toString() == saved.c_str()) {
                    ESP_LOGI(TAG, "Connecting to last known %s", bluetoothDeviceTypeName(type));
                    connect(d.getAddress().toString());
                    break;
                }
            }
        }
        connectPending = connectPending || slot(type).doConnect;
    }
    if (!connectPending) {
        maintainScan(millis());
    }
}

bool BluetoothDevicesPlugin::hasFreeSlot() const {
    for (const BluetoothDeviceType type : DEVICE_TYPES) {
        if (!isConnected(type)) {
            return true;
        }
    }
    return false;
}

// A missing scale is always looked for; other types only once one was paired, so scale-only setups scan as before.
bool BluetoothDevicesPlugin::wantsBackgroundScan() const {
    for (const BluetoothDeviceType type : DEVICE_TYPES) {
        if (slot(type).device != nullptr) {
            continue;
        }
        if (type == BluetoothDeviceType::SCALE || getSavedAddress(type) != "") {
            return true;
        }
    }
    return false;
}

// Keeps the scan alive and bounded while a device is missing, and stops it once nothing is being looked for.
void BluetoothDevicesPlugin::maintainScan(unsigned long now) {
    if (!wantsBackgroundScan() && !scanWindowOpen) {
        if (scanner->isScanRunning()) {
            scanner->stopAsyncScan();
        }
        scanRunningSince = 0;
        return;
    }
    if (!scanner->isScanRunning()) {
        scanRunningSince = 0;
        scanner->initializeAsyncScan();
        return;
    }
    if (scanRunningSince == 0) {
        scanRunningSince = now;
        return;
    }
    // The NimBLE scan is shared: a client connect (EBUSY) or a host reset stops it behind the scanner's back.
    if (!NimBLEDevice::getScan()->isScanning()) {
        ESP_LOGW(TAG, "Device scan stopped externally, restarting");
    } else if (scanWindowOpen || now - scanRunningSince < SCAN_REFRESH_MS) {
        return;
    }
    // stop() + clearResults() frees NimBLE's pending results, which otherwise grow for the whole session.
    scanner->restartAsyncScan();
    scanRunningSince = now;
}

void BluetoothDevicesPlugin::connect(const std::string &address, BluetoothDeviceType typeHint) {
    if (address.empty()) {
        ESP_LOGE(TAG, "Cannot connect with empty address");
        return;
    }
    if (controller == nullptr || scanner == nullptr) {
        ESP_LOGE(TAG, "Plugin not set up, cannot connect");
        return;
    }

    // The slot follows from the driver that claimed the device during the scan.
    BluetoothDeviceType type = typeHint;
    for (const auto &d : scanner->getDiscoveredDevices()) {
        if (d.getAddress().toString() == address) {
            type = d.getType();
            break;
        }
    }

    slot(type).address = address;
    slot(type).doConnect = true;
    if (getSavedAddress(type) != address.c_str()) {
        setSavedName(type, "");
    }
    setSavedAddress(type, address.c_str());
}

// Opens the scan window; automatic requests only scan for devices that are actually being looked for.
void BluetoothDevicesPlugin::requestScan(bool userRequested) {
    scanRequested = true;
    if (controller == nullptr || !(userRequested ? hasFreeSlot() : wantsBackgroundScan())) {
        return;
    }
    if (scanner == nullptr) {
        ESP_LOGE(TAG, "Scanner not initialized, cannot start scan");
        return;
    }
    scanner->initializeAsyncScan();
}

void BluetoothDevicesPlugin::forget(BluetoothDeviceType type) { slot(type).forgetRequested = true; }

void BluetoothDevicesPlugin::emitScanComplete() {
    scanWindowOpen = false;
    if (pluginManager == nullptr) {
        return;
    }
    const int count = scanner != nullptr ? static_cast<int>(scanner->getDiscoveredDevices().size()) : 0;
    pluginManager->trigger("bluetooth:scan:complete", "count", count);
}

void BluetoothDevicesPlugin::emitDeviceEvent(const char *id, BluetoothDeviceType type, const std::string &address,
                                             const char *key, const String &value) {
    if (pluginManager == nullptr) {
        return;
    }
    Event event;
    event.id = id;
    event.setString("type", bluetoothDeviceTypeName(type));
    event.setString("address", String(address.c_str()));
    event.setString(key, value);
    pluginManager->trigger(event);
}

void BluetoothDevicesPlugin::disconnect(BluetoothDeviceType type) {
    DeviceSlot &deviceSlot = slot(type);
    if (deviceSlot.device == nullptr) {
        return;
    }
    // Add small delay to let any pending callbacks complete
    delay(50);
    deviceSlot.device->disconnect();
    deviceSlot.device = nullptr;
    deviceSlot.address = "";
    deviceSlot.doConnect = false;
    // A different model may connect next, so its metadata has to be announced again.
    deviceSlot.lastBatteryLevel = BLUETOOTH_BATTERY_UNKNOWN;
}

void BluetoothDevicesPlugin::onProcessStart() const {
    BluetoothScale *connectedScale = scale();
    if (connectedScale != nullptr && connectedScale->isConnected()) {
        // Double tare with validation
        connectedScale->tare();
        delay(50);

        // Check if scale is still connected before second tare
        connectedScale = scale();
        if (connectedScale != nullptr && connectedScale->isConnected()) {
            connectedScale->tare();
        }
    }
}

void BluetoothDevicesPlugin::pollDeviceMetadata(BluetoothDeviceType type) {
    DeviceSlot &deviceSlot = slot(type);
    if (deviceSlot.device == nullptr || !deviceSlot.device->isConnected() || pluginManager == nullptr) {
        return;
    }
    // Fired on change only, so subscribers are not hammered at 1 Hz with duplicate values.
    if (deviceSlot.device->hasBatteryLevel()) {
        const uint8_t pct = deviceSlot.device->getBatteryLevel();
        if (pct != deviceSlot.lastBatteryLevel && pct != BLUETOOTH_BATTERY_UNKNOWN) {
            deviceSlot.lastBatteryLevel = pct;
            pluginManager->trigger(String(bluetoothDeviceTypeName(type)) + ":battery:change", "value", static_cast<int>(pct));
        }
    }
}

void BluetoothDevicesPlugin::tare() const { onProcessStart(); }

// Hands the selected profile's grinder settings to the grinder; unchanged settings are only resent when forced.
void BluetoothDevicesPlugin::syncGrinderProfile(bool force) {
    BluetoothGrinder *connectedGrinder = grinder();
    if (controller == nullptr || connectedGrinder == nullptr || !connectedGrinder->isConnected()) {
        return;
    }
    const Profile &profile = controller->getProfileManager()->getSelectedProfile();
    GrinderSettings settings;
    settings.grindSize = profile.grinder.grindSize;
    settings.rpm = profile.grinder.rpm;
    settings.feedRpm = profile.grinder.feedRpm;
    if (settings.isEmpty() || (!force && settings == lastGrinderSettings)) {
        return;
    }
    ESP_LOGI(TAG, "Sending grinder settings of profile %s", profile.label.c_str());
    lastGrinderSettings = settings;
    connectedGrinder->applySettings(settings);
}

// Blocking connect to the slot's pending address; the scan is stopped afterwards, false asks the caller to rescan.
bool BluetoothDevicesPlugin::establishConnection(BluetoothDeviceType type) {
    DeviceSlot &deviceSlot = slot(type);
    deviceSlot.doConnect = false;
    const std::string address = deviceSlot.address;
    if (address.empty()) {
        ESP_LOGE(TAG, "Cannot establish connection with empty address");
        return true;
    }

    ESP_LOGI(TAG, "Connecting to %s %s", bluetoothDeviceTypeName(type), address.c_str());

    // Connecting aborts the scan, so end the UI's scan window now instead of at its deadline.
    if (scanWindowOpen) {
        emitScanComplete();
    }
    scanner->stopAsyncScan();

    for (const auto &d : scanner->getDiscoveredDevices()) {
        if (d.getAddress().toString() != address) {
            continue;
        }

        deviceSlot.device = BluetoothDeviceRegistry::getInstance()->create(d);
        if (!deviceSlot.device || deviceSlot.device->getType() != type) {
            ESP_LOGE(TAG, "No driver for device %s", d.getName().c_str());
            deviceSlot.device = nullptr;
            emitDeviceEvent("bluetooth:connect:error", type, address, "reason", "unsupported");
            return true;
        }

        deviceSlot.device->setLogCallback([](std::string message) {
            if (!message.empty()) {
                Serial.print(message.c_str());
            }
        });

        if (BluetoothScale *newScale = deviceSlot.device->asScale()) {
            newScale->setWeightUpdatedCallback([](float weight) {
                // Skip measurements from interrupt context to avoid FreeRTOS deadlocks
                if (xPortInIsrContext()) {
                    return;
                }
                BLEDevices.onMeasurement(weight);
            });
        }

        if (!deviceSlot.device->connect()) {
            ESP_LOGW(TAG, "Failed to connect to %s, retrying scan", bluetoothDeviceTypeName(type));
            emitDeviceEvent("bluetooth:connect:error", type, address, "reason", "connect_failed");
            disconnect(type);
            return false;
        }

        const String name = deviceSlot.device->getDeviceName().c_str();
        if (getSavedName(type) != name) {
            setSavedName(type, name);
        }
        emitDeviceEvent("bluetooth:connect:success", type, address, "name", name);
        if (type == BluetoothDeviceType::GRINDER) {
            syncGrinderProfile(true);
        }
        return true;
    }

    ESP_LOGW(TAG, "Device %s not found in discovered devices", address.c_str());
    emitDeviceEvent("bluetooth:connect:error", type, address, "reason", "not_found");
    return false;
}

void BluetoothDevicesPlugin::onMeasurement(float value) {
    // Rate limiting to prevent callback flooding
    unsigned long now = millis();
    if (now - lastMeasurementTime < MIN_MEASUREMENT_INTERVAL_MS) {
        return; // Drop measurement to prevent flooding
    }
    lastMeasurementTime = now;

    if (controller == nullptr) {
        return;
    }

    // Don't process measurements when not active
    if (!active) {
        return;
    }

    // Validate the measurement value
    if (!isfinite(value) || value < -1000.0f || value > 10000.0f) {
        ESP_LOGW(TAG, "Invalid measurement value: %f, ignoring", value);
        return;
    }

    controller->onVolumetricMeasurement(value, VolumetricMeasurementSource::BLUETOOTH);

    // Native flow rate (e.g. Bookoo) goes out on the same tick, at the scale's own cadence.
    const BluetoothScale *connectedScale = scale();
    if (connectedScale != nullptr && connectedScale->hasFlowRate() && pluginManager != nullptr) {
        pluginManager->trigger("controller:volumetric-measurement:scale-flow:change", "value", connectedScale->getFlowRate());
    }
}

std::vector<DiscoveredDevice> BluetoothDevicesPlugin::getDiscoveredDevices() const {
    if (scanner == nullptr) {
        ESP_LOGW(TAG, "Scanner not initialized, returning empty device list");
        return std::vector<DiscoveredDevice>();
    }
    return scanner->getDiscoveredDevices();
}

String BluetoothDevicesPlugin::getSavedAddress(BluetoothDeviceType type) const {
    const Settings &settings = controller->getSettings();
    return type == BluetoothDeviceType::GRINDER ? settings.getSavedGrinder() : settings.getSavedScale();
}

String BluetoothDevicesPlugin::getSavedName(BluetoothDeviceType type) const {
    const Settings &settings = controller->getSettings();
    return type == BluetoothDeviceType::GRINDER ? settings.getSavedGrinderName() : settings.getSavedScaleName();
}

void BluetoothDevicesPlugin::setSavedAddress(BluetoothDeviceType type, const String &address) {
    Settings &settings = controller->getSettings();
    if (type == BluetoothDeviceType::GRINDER) {
        settings.setSavedGrinder(address);
    } else {
        settings.setSavedScale(address);
    }
}

void BluetoothDevicesPlugin::setSavedName(BluetoothDeviceType type, const String &name) {
    Settings &settings = controller->getSettings();
    if (type == BluetoothDeviceType::GRINDER) {
        settings.setSavedGrinderName(name);
    } else {
        settings.setSavedScaleName(name);
    }
}
