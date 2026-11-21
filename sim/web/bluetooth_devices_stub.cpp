// Sim stand-in for BluetoothDevicesPlugin (needs NimBLE): fakes a scale and a grinder for the Bluetooth tab and profile sync.
#include <display/core/Controller.h>
#include <display/core/ProfileManager.h>
#include <display/plugins/BluetoothDevicesPlugin.h>

// The simulated Bluetooth scale (sim/driver/SdlDriver.h): grams on it, or < 0 while it is switched off.
extern float g_simScaleTarget;
extern float g_simScaleOffset;

namespace {
constexpr unsigned long SIM_SCAN_WINDOW_MS = 1500;
constexpr std::array<BluetoothDeviceType, BLUETOOTH_DEVICE_TYPE_COUNT> DEVICE_TYPES = {BluetoothDeviceType::SCALE,
                                                                                       BluetoothDeviceType::GRINDER};

struct SimDevice {
    BluetoothDeviceType type;
    const char *address;
    const char *name;
    int rssi;
    uint8_t battery;
};
constexpr SimDevice SIM_DEVICES[] = {
    {BluetoothDeviceType::SCALE, "c0:ff:ee:00:00:01", "BOOKOO_SC_U 000001", -52, 80},
    {BluetoothDeviceType::GRINDER, "c0:ff:ee:00:00:02", "BOOKOO MT80 0A1B2C3D", -61, BLUETOOTH_BATTERY_UNKNOWN},
};

// The scale only advertises while the simulated scale is switched on (keys 0/3/4/5/6).
bool inRange(const SimDevice &device) { return device.type != BluetoothDeviceType::SCALE || g_simScaleTarget >= 0.0f; }

const SimDevice *findSimDevice(const std::string &address) {
    for (const SimDevice &device : SIM_DEVICES) {
        if (address == device.address) {
            return &device;
        }
    }
    return nullptr;
}
} // namespace

BluetoothDevicesPlugin BLEDevices;

BluetoothDevicesPlugin::BluetoothDevicesPlugin() {}
BluetoothDevicesPlugin::~BluetoothDevicesPlugin() {}

void BluetoothDevicesPlugin::setup(Controller *controller, PluginManager *manager) {
    this->controller = controller;
    this->pluginManager = manager;
    manager->on("controller:brew:prestart", [this](Event const &) { tare(); });
    manager->on("controller:grind:start", [this](Event const &) { tare(); });
    manager->on("profiles:profile:select", [this](Event const &) { grinderSyncRequested = true; });
}

void BluetoothDevicesPlugin::loop() {
    if (controller == nullptr) {
        return;
    }
    active = controller->getMode() != MODE_STANDBY;
    for (const BluetoothDeviceType type : DEVICE_TYPES) {
        DeviceSlot &deviceSlot = slot(type);
        if (deviceSlot.forgetRequested.exchange(false)) {
            setSavedAddress(type, "");
            setSavedName(type, "");
            deviceSlot.doConnect = false;
            disconnect(type);
        }
        if (deviceSlot.device != nullptr) {
            const SimDevice *simDevice = findSimDevice(deviceSlot.device->address);
            if (!active) {
                disconnect(type);
            } else if (simDevice == nullptr || !inRange(*simDevice)) {
                emitDeviceEvent("bluetooth:disconnect", type, deviceSlot.device->address, "name",
                                String(deviceSlot.device->name.c_str()));
                disconnect(type);
            }
            continue;
        }
        if (!active) {
            continue;
        }
        // Like the firmware, a saved device reconnects as soon as it is seen.
        const String saved = getSavedAddress(type);
        if (!deviceSlot.doConnect && saved != "") {
            const SimDevice *simDevice = findSimDevice(saved.c_str());
            if (simDevice != nullptr && simDevice->type == type && inRange(*simDevice)) {
                deviceSlot.address = saved.c_str();
                deviceSlot.doConnect = true;
            }
        }
        if (deviceSlot.doConnect) {
            establishConnection(type);
        }
    }
    const unsigned long now = millis();
    if (scanRequested.exchange(false)) {
        scanWindowOpen = true;
        scanDeadline = now + (hasFreeSlot() ? SIM_SCAN_WINDOW_MS : 0);
    }
    if (scanWindowOpen && static_cast<long>(now - scanDeadline) >= 0) {
        emitScanComplete();
    }
    if (grinderSyncRequested.exchange(false)) {
        syncGrinderProfile(false);
    }
}

bool BluetoothDevicesPlugin::establishConnection(BluetoothDeviceType type) {
    DeviceSlot &deviceSlot = slot(type);
    deviceSlot.doConnect = false;
    const std::string address = deviceSlot.address;
    const SimDevice *simDevice = findSimDevice(address);
    if (simDevice == nullptr || simDevice->type != type || !inRange(*simDevice)) {
        emitDeviceEvent("bluetooth:connect:error", type, address, "reason", "not_found");
        return false;
    }
    if (type == BluetoothDeviceType::GRINDER) {
        deviceSlot.device = std::make_unique<BluetoothGrinder>();
    } else {
        deviceSlot.device = std::make_unique<BluetoothScale>();
    }
    deviceSlot.device->address = simDevice->address;
    deviceSlot.device->name = simDevice->name;
    deviceSlot.device->rssi = simDevice->rssi;
    deviceSlot.device->battery = simDevice->battery;
    setSavedName(type, simDevice->name);
    emitDeviceEvent("bluetooth:connect:success", type, address, "name", simDevice->name);
    if (type == BluetoothDeviceType::GRINDER) {
        syncGrinderProfile(true);
    }
    return true;
}

void BluetoothDevicesPlugin::connect(const std::string &address, BluetoothDeviceType typeHint) {
    if (controller == nullptr || address.empty()) {
        return;
    }
    const SimDevice *simDevice = findSimDevice(address);
    const BluetoothDeviceType type = simDevice != nullptr ? simDevice->type : typeHint;
    slot(type).address = address;
    slot(type).doConnect = true;
    setSavedAddress(type, address.c_str());
}

void BluetoothDevicesPlugin::requestScan(bool) { scanRequested = true; }

void BluetoothDevicesPlugin::forget(BluetoothDeviceType type) { slot(type).forgetRequested = true; }

void BluetoothDevicesPlugin::disconnect(BluetoothDeviceType type) {
    slot(type).device = nullptr;
    slot(type).address = "";
    slot(type).doConnect = false;
}

bool BluetoothDevicesPlugin::hasFreeSlot() const {
    for (const BluetoothDeviceType type : DEVICE_TYPES) {
        if (!isConnected(type)) {
            return true;
        }
    }
    return false;
}

void BluetoothDevicesPlugin::emitScanComplete() {
    scanWindowOpen = false;
    pluginManager->trigger("bluetooth:scan:complete", "count", static_cast<int>(getDiscoveredDevices().size()));
}

void BluetoothDevicesPlugin::emitDeviceEvent(const char *id, BluetoothDeviceType type, const std::string &address,
                                             const char *key, const String &value) {
    Event event;
    event.id = id;
    event.setString("type", bluetoothDeviceTypeName(type));
    event.setString("address", String(address.c_str()));
    event.setString(key, value);
    pluginManager->trigger(event);
}

// The fake grinder takes the settings at once, limited to the Motto 80's ranges like the real driver does.
void BluetoothDevicesPlugin::syncGrinderProfile(bool force) {
    BluetoothGrinder *connectedGrinder = grinder();
    if (connectedGrinder == nullptr) {
        return;
    }
    const Profile &profile = controller->getProfileManager()->getSelectedProfile();
    GrinderSettings settings;
    settings.grindSize = profile.grinder.grindSize;
    settings.rpm = profile.grinder.rpm;
    settings.feedRpm = profile.grinder.feedRpm;
    settings.dose = profile.dose > 0.0f ? profile.dose : -1.0f;
    settings.label = profile.label.c_str();
    if (settings.isEmpty() || (!force && settings == lastGrinderSettings)) {
        return;
    }
    lastGrinderSettings = settings;
    if (settings.hasGrindSize())
        connectedGrinder->reported.grindSize = std::min(std::max(settings.grindSize, 0.0f), 999.0f);
    if (settings.hasRpm())
        connectedGrinder->reported.rpm = std::min(std::max(settings.rpm, 500), 1500);
    if (settings.hasFeedRpm())
        connectedGrinder->reported.feedRpm = std::min(std::max(settings.feedRpm, 10), 65);
}

std::vector<DiscoveredDevice> BluetoothDevicesPlugin::getDiscoveredDevices() const {
    std::vector<DiscoveredDevice> devices;
    for (const SimDevice &simDevice : SIM_DEVICES) {
        if (!inRange(simDevice) || isConnected(simDevice.type)) {
            continue;
        }
        DiscoveredDevice device;
        device._addr.addr = simDevice.address;
        device._name = simDevice.name;
        device._rssi = simDevice.rssi;
        device._type = simDevice.type;
        devices.push_back(device);
    }
    return devices;
}

void BluetoothDevicesPlugin::onMeasurement(float) {}

// The simulated scale zeroes on the firmware's tare requests.
void BluetoothDevicesPlugin::tare() const {
    if (g_simScaleTarget >= 0.0f)
        g_simScaleOffset = g_simScaleTarget;
}

String BluetoothDevicesPlugin::getSavedAddress(BluetoothDeviceType type) const {
    const Settings &settings = controller->getSettings();
    return type == BluetoothDeviceType::GRINDER ? settings.getSavedGrinder() : settings.getSavedScale();
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
