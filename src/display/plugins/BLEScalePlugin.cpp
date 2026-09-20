#include "BLEScalePlugin.h"
#include "remote_scales.h"
#include "remote_scales_plugin_registry.h"
#include <NimBLEDevice.h>
#include <cmath> // For isfinite()
#include <display/core/Controller.h>
#include <scales/acaia.h>
#include <scales/bookoo.h>
#include <scales/decent.h>
#include <scales/difluid.h>
#include <scales/dot.h>
#include <scales/eclair.h>
#include <scales/eureka.h>
#include <scales/felicitaScale.h>
#include <scales/myscale.h>
#include <scales/timemore.h>
#include <scales/varia.h>
#include <scales/weighmybru.h>

void on_ble_measurement(float value) {
    if (&BLEScales != nullptr) {
        BLEScales.onMeasurement(value);
    }
}

BLEScalePlugin BLEScales;

BLEScalePlugin::BLEScalePlugin() = default;

BLEScalePlugin::~BLEScalePlugin() noexcept {
    try {
        active = false;
        if (taskHandle != nullptr) {
            vTaskDelete(taskHandle);
            taskHandle = nullptr;
        }
        releaseScale();
        if (scanner != nullptr) {
            scanner->stopAsyncScan();
            delay(50); // let the scan actually stop
            delete scanner;
            scanner = nullptr;
        }
    } catch (...) {
        // Swallow: destructors must not propagate exceptions.
    }
}

void BLEScalePlugin::setup(Controller *controller, PluginManager *manager) {
    if (controller == nullptr || manager == nullptr) {
        ESP_LOGE("BLEScalePlugin", "Invalid controller or manager passed to setup");
        return;
    }

    this->controller = controller;
    this->pluginManager = manager;
    this->pluginRegistry = RemoteScalesPluginRegistry::getInstance();

    // Apply scale plugins with error checking
    AcaiaScalesPlugin::apply();
    BookooScalesPlugin::apply();
    DecentScalesPlugin::apply();
    DifluidScalesPlugin::apply();
    EclairScalesPlugin::apply();
    EurekaScalesPlugin::apply();
    FelicitaScalePlugin::apply();
    TimemoreScalesPlugin::apply();
    VariaScalesPlugin::apply();
    WeighMyBrewScalePlugin::apply();
    myscalePlugin::apply();
    TimemoreDotScalesPlugin::apply();

    // Initialize scanner with error handling
    this->scanner = new (std::nothrow) RemoteScalesScanner();
    if (this->scanner == nullptr) {
        ESP_LOGE("BLEScalePlugin", "Failed to create RemoteScalesScanner - out of memory");
        return;
    }

    manager->on("controller:bluetooth:connect", [this](Event const &) {
        if (this->controller != nullptr && this->controller->getMode() != MODE_STANDBY) {
            ESP_LOGI("BLEScalePlugin", "Resuming scanning");
            setActive(true);
        }
    });
    manager->on("controller:bluetooth:disconnect", [this](Event const &) {
        ESP_LOGW("BLEScalePlugin", "Controller disconnected, stopping BLE scan");
        setActive(false);
    });
    manager->on("controller:brew:end", [this](Event const &) { stopTimerRequested = true; });
    manager->on("controller:mode:change", [this](Event const &event) {
        if (event.getInt("value") != MODE_STANDBY) {
            ESP_LOGI("BLEScalePlugin", "Resuming scanning");
            setActive(true);
        } else {
            setActive(false);
        }
    });

    // Core 0 next to NimBLE; the stack has to fit a driver's connect + GATT handshake.
    xTaskCreatePinnedToCore(taskEntry, "BLEScalePlugin::loop", configMINIMAL_STACK_SIZE * 10, this, 1, &taskHandle, 0);
}

// All scale work runs on the scale task; drivers connect with a blocking 30s NimBLE connect() (GM-215).
void BLEScalePlugin::loop() {}

void BLEScalePlugin::taskEntry(void *arg) {
    auto *plugin = static_cast<BLEScalePlugin *>(arg);
    while (true) {
        plugin->tick();
        vTaskDelay(pdMS_TO_TICKS(SCALE_TASK_INTERVAL_MS));
    }
}

void BLEScalePlugin::setActive(bool value) {
    active = value;
    if (value) {
        scanRequested = true;
    } else if (connecting) {
        // The host runs one connect at a time and cannot scan meanwhile; free it for the controller reconnect.
        ble_gap_conn_cancel();
    }
}

void BLEScalePlugin::tick() {
    if (scanner == nullptr)
        return;
    bool hasScale;
    {
        std::lock_guard<ScaleMutex> guard(scaleMutex);
        hasScale = scale != nullptr;
        connected = hasScale && scale->isConnected();
    }
    if (disconnectRequested.exchange(false) && hasScale) {
        releaseScale();
        hasScale = false;
    }
    const bool wantScan = scanRequested.exchange(false);
    if (!active) {
        if (hasScale) {
            releaseScale();
        }
        if (scanner->isScanRunning()) {
            scanner->stopAsyncScan();
        }
    } else if (doConnect && !hasScale) {
        // Never start a connect during a shot, and honour the pause after a lost link or failed attempt.
        if (!controller->isActive() && (!reconnectPaused || millis() - reconnectPausedAt >= SCALE_RECONNECT_PAUSE_MS))
            establishConnection();
    } else if (wantScan && !connected) {
        scanner->initializeAsyncScan();
    }
    processControlRequests();
    refreshScaleCaches();
    const unsigned long now = millis();
    if (now - lastUpdate > UPDATE_INTERVAL_MS) {
        lastUpdate = now;
        update();
    }
}

void BLEScalePlugin::processControlRequests() {
    // Only this worker performs GATT operations. Event/UI/AsyncTCP callers merely enqueue.
    if (stopTimerRequested.exchange(false)) {
        std::lock_guard<ScaleMutex> guard(scaleMutex);
        if (scale && scale->isConnected() && scale->hasTimerControl())
            scale->stopTimer();
    }
    if (cancelTareRequested.exchange(false)) {
        pendingTare = 0;
        activeTareTicket = 0;
        tareAttemptsRemaining = 0;
    }
    if (const uint32_t ticket = pendingTare.exchange(0)) {
        activeTareTicket = ticket;
        tareAttemptsRemaining = SCALE_TARE_ATTEMPTS;
        anyTareSucceeded = false;
        nextTareAttemptAt = millis();
    }
    const unsigned long tareNow = millis();
    if (tareAttemptsRemaining > 0 && static_cast<int32_t>(tareNow - nextTareAttemptAt) >= 0) {
        bool success = false;
        {
            std::lock_guard<ScaleMutex> guard(scaleMutex);
            if (scale && scale->isConnected())
                success = scale->tare();
        }
        anyTareSucceeded |= success;
        --tareAttemptsRemaining;
        if (tareAttemptsRemaining > 0) {
            nextTareAttemptAt = tareNow + SCALE_TARE_RETRY_INTERVAL_MS;
        } else {
            successfulTare = anyTareSucceeded;
            tareSentAt = millis();
            completedTare = activeTareTicket; // publish the aggregate result last
            activeTareTicket = 0;
        }
    }
}

void BLEScalePlugin::refreshScaleCaches() {
    {
        std::lock_guard<ScaleMutex> guard(scaleMutex);
        if (scale && connected && cachedHasFlowRate)
            cachedFlowRate = scale->getFlowRate();
    }
    const unsigned long now = millis();
    if (!controller->isActive() && now - lastRSSIUpdate >= 5000) {
        lastRSSIUpdate = now;
        controller->getClientController()->refreshRSSI();
        std::lock_guard<ScaleMutex> guard(scaleMutex);
        cachedRSSI = scale && scale->isConnected() ? scale->getRSSI() : 0;
    }
}

void BLEScalePlugin::update() {
    bool hasScale;
    bool hasConnectedScale;
    {
        std::lock_guard<ScaleMutex> guard(scaleMutex);
        hasScale = scale != nullptr;
        hasConnectedScale = hasScale && scale->isConnected();
        connected = hasConnectedScale;
    }

    if (!active)
        return;

    if (hasScale) {
        if (!hasConnectedScale) {
            // Never update() a lost scale: drivers reconnect in there with a blocking connect(); the scan finds it again.
            ESP_LOGW("BLEScalePlugin", "Scale connection lost, resuming scan");
            reconnectPaused = true;
            reconnectPausedAt = millis();
            releaseScale();
            scanner->initializeAsyncScan();
            return;
        }
        {
            std::lock_guard<ScaleMutex> guard(scaleMutex);
            scale->update();
        }
        pollScaleMetadata();
    } else if (!doConnect && controller->getSettings().getSavedScale() != "") {
        auto discoveredScales = scanner->getDiscoveredScales();
        for (const auto &d : discoveredScales) {
            if (d.getAddress().toString() == controller->getSettings().getSavedScale().c_str()) {
                ESP_LOGI("BLEScalePlugin", "Connecting to last known scale");
                connect(d.getAddress().toString());
                break;
            }
        }
    }
}

void BLEScalePlugin::connect(const std::string &uuid) {
    if (uuid.empty()) {
        ESP_LOGE("BLEScalePlugin", "Cannot connect with empty UUID");
        return;
    }
    if (controller == nullptr) {
        ESP_LOGE("BLEScalePlugin", "Controller is null, cannot save scale setting");
        return;
    }

    {
        std::lock_guard<std::mutex> guard(uuidMutex);
        this->uuid = uuid;
    }
    doConnect = true;
    controller->getSettings().setSavedScale(uuid.data());
}

void BLEScalePlugin::scan() const {
    if (scanner == nullptr) {
        ESP_LOGE("BLEScalePlugin", "Scanner not initialized, cannot start scan");
        return;
    }
    scanRequested = true;
}

void BLEScalePlugin::disconnect() {
    doConnect = false;
    disconnectRequested = true;
}

void BLEScalePlugin::releaseScale() {
    std::unique_ptr<RemoteScales> old;
    {
        std::lock_guard<ScaleMutex> guard(scaleMutex);
        old = std::move(scale);
        connected = false;
        doConnect = false;
        cachedRSSI = 0;
        pendingTare = 0;
        activeTareTicket = 0;
        tareAttemptsRemaining = 0;
        {
            std::lock_guard<std::mutex> sampleGuard(measurementMutex);
            measurementPending = false;
        }
        cachedHasBattery = false;
        cachedHasFlowRate = false;
        cachedBattery = REMOTE_SCALES_BATTERY_UNKNOWN;
        // Reset metadata caches so a newly connected (possibly different) scale re-emits its change events.
        lastBatteryLevel = REMOTE_SCALES_BATTERY_UNKNOWN;
        lastWeightUnit = ScaleWeightUnit::UNKNOWN;
        warnedOunceMidBrew = false;
    }
    if (old != nullptr) {
        vTaskDelay(pdMS_TO_TICKS(50)); // let pending notify callbacks drain before the client is deleted
        old->disconnect();
    }
}

uint32_t BLEScalePlugin::requestTare() const {
    uint32_t ticket = ++nextTare;
    if (ticket == 0)
        ticket = ++nextTare;
    cancelTareRequested = false;
    pendingTare = ticket;
    return ticket;
}

void BLEScalePlugin::cancelTare() const {
    pendingTare = 0;
    cancelTareRequested = true;
}

void BLEScalePlugin::pollScaleMetadata() {
    if (pluginManager == nullptr)
        return;
    // Battery % -- fire only on change, and outside the lock so handlers can call back into the plugin.
    uint8_t pct = REMOTE_SCALES_BATTERY_UNKNOWN;
    {
        std::lock_guard<ScaleMutex> guard(scaleMutex);
        if (scale == nullptr || !scale->isConnected() || !scale->hasBatteryLevel())
            return;
        pct = scale->getBatteryLevel();
        cachedBattery = pct;
        if (pct == lastBatteryLevel || pct == REMOTE_SCALES_BATTERY_UNKNOWN)
            return;
        lastBatteryLevel = pct;
    }
    pluginManager->trigger("scale:battery:change", "value", static_cast<int>(pct));
}

void BLEScalePlugin::tare() const { requestTare(); }

void BLEScalePlugin::establishConnection() {
    std::string target;
    {
        std::lock_guard<std::mutex> guard(uuidMutex);
        target = uuid;
    }
    // A failed attempt clears the request; update() re-requests the saved scale once the scan sees it again.
    doConnect = false;
    if (target.empty()) {
        ESP_LOGE("BLEScalePlugin", "Cannot establish connection with empty UUID");
        return;
    }

    ESP_LOGI("BLEScalePlugin", "Connecting to %s", target.c_str());
    scanner->stopAsyncScan();

    std::unique_ptr<RemoteScales> candidate;
    for (const auto &d : scanner->getDiscoveredScales()) {
        if (d.getAddress().toString() != target)
            continue;
        auto factory = RemoteScalesFactory::getInstance();
        if (factory != nullptr)
            candidate = factory->create(d);
        break;
    }
    if (candidate == nullptr) {
        ESP_LOGW("BLEScalePlugin", "Device %s not found in discovered scales", target.c_str());
        scanner->initializeAsyncScan();
        return;
    }

    candidate->setLogCallback([](std::string message) {
        if (!message.empty()) {
            Serial.print(message.c_str());
        }
    });
    candidate->setWeightUpdatedCallback([](float weight) {
        if (xPortInIsrContext()) {
            return; // skip: taking FreeRTOS locks from an ISR deadlocks
        }
        BLEScales.onMeasurement(weight);
    });

    // Connect without the lock held: this blocks for up to NimBLE's 30s connect timeout.
    const unsigned long started = millis();
    connecting = true;
    const bool connectResult = candidate->connect();
    connecting = false;
    ESP_LOGI("BLEScalePlugin", "Scale connect %s after %lums", connectResult ? "succeeded" : "failed", millis() - started);
    reconnectPaused = !connectResult;
    reconnectPausedAt = millis();

    if (!connectResult || !active) {
        ESP_LOGW("BLEScalePlugin", "Failed to connect to scale, retrying scan");
        candidate->disconnect();
        candidate.reset();
        if (active)
            scanner->initializeAsyncScan();
        return;
    }
    std::lock_guard<ScaleMutex> guard(scaleMutex);
    scale = std::move(candidate);
    cachedHasBattery = scale->hasBatteryLevel();
    cachedHasFlowRate = scale->hasFlowRate();
    connected = true;
}

void BLEScalePlugin::onMeasurement(float value) const {
    // Rate limiting to prevent callback flooding
    unsigned long now = millis();
    if (now - lastMeasurementTime < MIN_MEASUREMENT_INTERVAL_MS) {
        return; // Drop measurement to prevent flooding
    }
    lastMeasurementTime = now;

    // Multiple safety checks to prevent crashes
    if (controller == nullptr) {
        return; // Silently ignore if controller is null
    }

    // Check if we're being destroyed or in an unsafe state
    if (!active) {
        return; // Don't process measurements when not active
    }

    // Validate the measurement value
    if (!isfinite(value) || value < -1000.0f || value > 10000.0f) {
        ESP_LOGW("BLEScalePlugin", "Invalid measurement value: %f, ignoring", value);
        return;
    }

    if (!connected)
        return; // Ignore synthetic connect-time zeros and notifications from a retired connection.
    std::unique_lock<std::mutex> lock(measurementMutex, std::try_to_lock);
    if (!lock)
        return;
    measurement = value;
    measurementAt = now;
    measurementPending = true;
}

void BLEScalePlugin::processMeasurements() {
    float value;
    unsigned long receivedAt;
    {
        std::lock_guard<std::mutex> lock(measurementMutex);
        if (!measurementPending)
            return;
        value = measurement;
        receivedAt = measurementAt;
        measurementPending = false;
    }
    if (connected && controller) {
        controller->onVolumetricMeasurement(value, VolumetricMeasurementSource::BLUETOOTH, receivedAt);
        if (cachedHasFlowRate && pluginManager)
            pluginManager->trigger("controller:volumetric-measurement:scale-flow:change", "value", cachedFlowRate.load());
    }
}

std::vector<DiscoveredDevice> BLEScalePlugin::getDiscoveredScales() const {
    if (scanner == nullptr) {
        ESP_LOGW("BLEScalePlugin", "Scanner not initialized, returning empty device list");
        return std::vector<DiscoveredDevice>();
    }
    return scanner->getDiscoveredScales();
}
