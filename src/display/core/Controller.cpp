#include "Controller.h"
#include "ArduinoJson.h"
#include "esp_sntp.h"
#include <SD_MMC.h>
#include <SPIFFS.h>
#include <ctime>
#include <display/config.h>
#include <display/core/constants.h>
#include <display/core/process/BrewProcess.h>
#include <display/core/process/GrindProcess.h>
#include <display/core/process/PumpProcess.h>
#include <display/core/process/SteamProcess.h>
#include <display/core/static_profiles.h>
#include <display/core/zones.h>
#include <display/plugins/AutoWakeupPlugin.h>
#include <display/plugins/BLEScalePlugin.h>
#include <display/plugins/BoilerFillPlugin.h>
#include <display/plugins/HomekitPlugin.h>
#include <display/plugins/LedControlPlugin.h>
#include <display/plugins/MQTTPlugin.h>
#include <display/plugins/ShotHistoryPlugin.h>
#include <display/plugins/SmartGrindPlugin.h>
#include <display/plugins/WebUIPlugin.h>
#include <display/plugins/mDNSPlugin.h>
#ifndef GAGGIMATE_HEADLESS
#include <display/drivers/AmoledDisplayDriver.h>
#include <display/drivers/LilyGoDriver.h>
#include <display/drivers/WaveshareDriver.h>
#endif

const String LOG_TAG = F("Controller");

void Controller::setup() {
    mode = settings.getStartupMode();
    
    // Initialize process mutex for thread-safe access
    processMutex = xSemaphoreCreateMutex();
    if (processMutex == nullptr) {
        ESP_LOGE(LOG_TAG, "Failed to create process mutex");
    }

    if (!SPIFFS.begin(true)) {
        Serial.println(F("An Error has occurred while mounting SPIFFS"));
    }

#ifndef GAGGIMATE_HEADLESS
    setupPanel();
#endif

    pluginManager = new PluginManager();
#ifndef GAGGIMATE_HEADLESS
    ui = new DefaultUI(this, driver, pluginManager);
    if (driver->supportsSDCard() && driver->installSDCard()) {
        sdcard = true;
        ESP_LOGI(LOG_TAG, "SD Card detected and mounted");
        ESP_LOGI(LOG_TAG, "Used: %lluMB, Capacity: %lluMB", SD_MMC.usedBytes() / 1024 / 1024, SD_MMC.cardSize() / 1024 / 1024);
    }
#endif
    FS *fs = &SPIFFS;
    if (sdcard) {
        fs = &SD_MMC;
    }
    beanManager = new BeanManager(fs, "/b");
    beanManager->setup();
    profileManager = new ProfileManager(fs, "/p", settings, pluginManager);
    profileManager->setup();
    if (settings.isHomekit())
        pluginManager->registerPlugin(new HomekitPlugin(settings.getWifiSsid(), settings.getWifiPassword()));
    else
        pluginManager->registerPlugin(new mDNSPlugin());
    if (settings.isBoilerFillActive()) {
        pluginManager->registerPlugin(new BoilerFillPlugin());
    }
    if (settings.isSmartGrindActive()) {
        pluginManager->registerPlugin(new SmartGrindPlugin());
    }
    if (settings.isHomeAssistant()) {
        pluginManager->registerPlugin(new MQTTPlugin());
    }
    pluginManager->registerPlugin(new WebUIPlugin());
    pluginManager->registerPlugin(&ShotHistory);
    pluginManager->registerPlugin(&BLEScales);
    pluginManager->registerPlugin(new LedControlPlugin());
    pluginManager->registerPlugin(new AutoWakeupPlugin());
    pluginManager->setup(this);

    pluginManager->on("profiles:profile:save", [this](Event const &event) {
        String id = event.getString("id");
        if (id == profileManager->getSelectedProfile().id) {
            this->handleProfileUpdate();
        }
    });

    pluginManager->on("profiles:profile:select", [this](Event const &event) { this->handleProfileUpdate(); });

#ifndef GAGGIMATE_HEADLESS
    ui->init();
#endif
    this->onScreenReady();

    updateLastAction();
    xTaskCreatePinnedToCore(loopTask, "Controller::loopControl", configMINIMAL_STACK_SIZE * 6, this, 1, &taskHandle, 1);
}

void Controller::onScreenReady() { screenReady = true; }

void Controller::onTargetToggle() { settings.setVolumetricTarget(!settings.isVolumetricTarget()); }

void Controller::onTargetChange(ProcessTarget target) { settings.setVolumetricTarget(target == ProcessTarget::VOLUMETRIC); }

void Controller::connect() {
    if (initialized)
        return;
    lastPing = millis();
    connectStartTime = millis();
    pluginManager->trigger("controller:startup");

    setupWifi();
    setupBluetooth();
    pluginManager->on("ota:update:start", [this](Event const &) { this->updating = true; });
    pluginManager->on("ota:update:end", [this](Event const &) { this->updating = false; });

    updateLastAction();
    initialized = true;
}

#ifndef GAGGIMATE_HEADLESS
void Controller::setupPanel() {
    if (LilyGoDriver::getInstance()->isCompatible()) {
        driver = LilyGoDriver::getInstance();
    } else if (AmoledDisplayDriver::getInstance()->isCompatible()) {
        driver = AmoledDisplayDriver::getInstance();
    } else if (WaveshareDriver::getInstance()->isCompatible()) {
        driver = WaveshareDriver::getInstance();
    } else {
        Serial.println("No compatible display driver found");
        delay(10000);
        ESP.restart();
    }
    driver->init();
}
#endif

void Controller::setupBluetooth() {
    clientController.initClient();
    clientController.registerDisconnectCallback([this]() {
        if (initialized) {
            pluginManager->trigger("controller:bluetooth:disconnect");
            waitingForController = true;
            setMode(MODE_STANDBY);
        }
    });
    clientController.registerSensorCallback(
        [this](const float temp, const float pressure, const float puckFlow, const float pumpFlow, const float puckResistance) {
            onTempRead(temp);
            this->pressure = pressure;
            this->currentPuckFlow = puckFlow;
            this->currentPumpFlow = pumpFlow;
            pluginManager->trigger("boiler:pressure:change", "value", pressure);
            pluginManager->trigger("pump:puck-flow:change", "value", puckFlow);
            pluginManager->trigger("pump:flow:change", "value", pumpFlow);
            pluginManager->trigger("pump:puck-resistance:change", "value", puckResistance);
        });
    clientController.registerBrewBtnCallback([this](const int brewButtonStatus) { handleBrewButton(brewButtonStatus); });
    clientController.registerSteamBtnCallback([this](const int steamButtonStatus) { handleSteamButton(steamButtonStatus); });
    clientController.registerRemoteErrorCallback([this](const int error) {
        if (error != ERROR_CODE_TIMEOUT && error != this->error) {
            this->error = error;
            deactivate();
            setMode(MODE_STANDBY);
            pluginManager->trigger(F("controller:error"));
            ESP_LOGE(LOG_TAG, "Received error %d", error);
        }
    });
    clientController.registerAutotuneResultCallback([this](const float Kp, const float Ki, const float Kd, const float Kf) {
        ESP_LOGI(LOG_TAG, "Received autotune values: Kp=%.3f, Ki=%.3f, Kd=%.3f, Kf=%.3f (combined)", Kp, Ki, Kd, Kf);
        char pid[64];
        // Store in simplified format with combined Kf
        snprintf(pid, sizeof(pid), "%.3f,%.3f,%.3f,%.3f", Kp, Ki, Kd, Kf);
        settings.setPid(String(pid));
        pluginManager->trigger("controller:autotune:result");
        autotuning = false;
    });
    clientController.registerVolumetricMeasurementCallback(
        [this](const float value) { onVolumetricMeasurement(value, VolumetricMeasurementSource::FLOW_ESTIMATION); });
    clientController.registerTofMeasurementCallback([this](const int value) {
        tofDistance = value;
        ESP_LOGV(LOG_TAG, "Received new TOF distance: %d", value);
        pluginManager->trigger("controller:tof:change", "value", value);
    });
    pluginManager->trigger("controller:bluetooth:init");
}

void Controller::setupInfos() {
    const std::string info = clientController.readInfo();
    printf("System info: %s\n", info.c_str());
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, info);
    if (err) {
        printf("Error deserializing JSON: %s\n", err.c_str());
        systemInfo = SystemInfo{
            .hardware = "GaggiMate Standard 1.x", .version = "v1.0.0", .capabilities = {.dimming = false, .pressure = false}};
    } else {
        systemInfo = SystemInfo{.hardware = doc["hw"].as<String>(),
                                .version = doc["v"].as<String>(),
                                .capabilities = SystemCapabilities{
                                    .dimming = doc["cp"]["dm"].as<bool>(),
                                    .pressure = doc["cp"]["ps"].as<bool>(),
                                    .ledControl = doc["cp"]["led"].as<bool>(),
                                    .tof = doc["cp"]["tof"].as<bool>(),
                                }};
    }
}

void Controller::setupWifi() {
    if (settings.getWifiSsid() != "" && settings.getWifiPassword() != "") {
        WiFi.setHostname(settings.getMdnsName().c_str());
        WiFi.mode(WIFI_STA);
        WiFi.setAutoReconnect(true);
        WiFi.config(INADDR_NONE, INADDR_NONE, INADDR_NONE, INADDR_NONE);
        WiFi.begin(settings.getWifiSsid(), settings.getWifiPassword());
        WiFi.setTxPower(WIFI_POWER_19_5dBm);
        for (int attempts = 0; attempts < WIFI_CONNECT_ATTEMPTS; attempts++) {
            if (WiFi.status() == WL_CONNECTED) {
                break;
            }
            delay(500);
            Serial.print(".");
        }
        Serial.println("");
        if (WiFi.status() == WL_CONNECTED) {
            ESP_LOGI(LOG_TAG, "Connected to %s with IP address %s", settings.getWifiSsid().c_str(),
                     WiFi.localIP().toString().c_str());
            WiFi.onEvent([this](WiFiEvent_t, WiFiEventInfo_t) { pluginManager->trigger("controller:wifi:connect", "AP", 0); },
                         WiFiEvent_t::ARDUINO_EVENT_WIFI_STA_GOT_IP);
            WiFi.onEvent(
                [this](WiFiEvent_t, WiFiEventInfo_t info) {
                    ESP_LOGI(LOG_TAG, "Lost WiFi connection. Reason: %s",
                             WiFi.disconnectReasonName(static_cast<wifi_err_reason_t>(info.wifi_sta_disconnected.reason)));
                    pluginManager->trigger("controller:wifi:disconnect");
                },
                WiFiEvent_t::ARDUINO_EVENT_WIFI_STA_DISCONNECTED);
            configTzTime(resolve_timezone(settings.getTimezone()), NTP_SERVER);
            setenv("TZ", resolve_timezone(settings.getTimezone()), 1);
            tzset();
            sntp_set_sync_mode(SNTP_SYNC_MODE_SMOOTH);
            sntp_setservername(0, NTP_SERVER);
            sntp_init();
        } else {
            WiFi.disconnect(true, true);
            ESP_LOGI(LOG_TAG, "Timed out while connecting to WiFi");
            Serial.println("Timed out while connecting to WiFi");
        }
    }
    if (WiFi.status() != WL_CONNECTED) {
        isApConnection = true;
        WiFi.mode(WIFI_AP);
        WiFi.softAPConfig(WIFI_AP_IP, WIFI_AP_IP, WIFI_SUBNET_MASK);
        WiFi.softAP(WIFI_AP_SSID);
        WiFi.setTxPower(WIFI_POWER_19_5dBm);
        ESP_LOGI(LOG_TAG, "Started WiFi AP %s", WIFI_AP_SSID);
    }

    pluginManager->on("ota:update:start", [this](Event const &) { this->updating = true; });
    pluginManager->on("ota:update:end", [this](Event const &) { this->updating = false; });

    pluginManager->trigger("controller:wifi:connect", "AP", isApConnection ? 1 : 0);
}

void Controller::loop() {
    pluginManager->loop();

    if (screenReady) {
        connect();
    }

    unsigned long now = millis();

    // If BLE scanning has been running for a while without finding the controller,
    // notify the UI so it can update the startup label accordingly.
    if (!waitingForController && initialized && !clientController.isConnected() &&
        (long)(now - connectStartTime) > CONTROLLER_WAITING_TIMEOUT_MS) {
        waitingForController = true;
        pluginManager->trigger("controller:bluetooth:waiting");
    }

    if (clientController.isReadyForConnection() && clientController.connectToServer()) {
        waitingForController = false;
        setupInfos();
        ESP_LOGI(LOG_TAG, "setting pressure scale to %.2f\n", settings.getPressureScaling());
        setPressureScale();
        clientController.sendPidSettings(settings.getPid());
        clientController.sendPumpModelCoeffs(settings.getPumpModelCoeffs());
        if (!loaded) {
            loaded = true;
            if (settings.getStartupMode() == MODE_STANDBY)
                activateStandby();

            pluginManager->trigger("controller:ready");
        }
        pluginManager->trigger("controller:bluetooth:connect");
    }

    if (isErrorState()) {
        return;
    }

    if (now - lastProgress > PROGRESS_INTERVAL) {
        // Check if steam is ready
        if (mode == MODE_STEAM && !steamReady && currentTemp + 5.f > getTargetTemp()) {
            activate();
            steamReady = true;
        }

        // Handle current process with mutex protection
        if (xSemaphoreTake(processMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            if (currentProcess != nullptr) {
                updateLastAction();
                if (currentProcess->getType() == MODE_BREW) {
                    auto brewProcess = static_cast<BrewProcess *>(currentProcess);
                    brewProcess->updatePressure(pressure);
                    brewProcess->updateFlow(currentPumpFlow);
                }
                currentProcess->progress();
                bool stillActive = currentProcess->isActive();
                xSemaphoreGive(processMutex);
                
                if (!stillActive) {
                    deactivate();
                }
            } else {
                xSemaphoreGive(processMutex);
            }
        }

        // Handle last process - Calculate auto delay
        if (lastProcess != nullptr && !lastProcess->isComplete()) {
            lastProcess->progress();
        }
        if (lastProcess != nullptr && lastProcess->isComplete() && !processCompleted && settings.isDelayAdjust()) {
            processCompleted = true;
            if (lastProcess->getType() == MODE_BREW) {
                if (auto *brewProcess = static_cast<BrewProcess *>(lastProcess);
                    brewProcess->target == ProcessTarget::VOLUMETRIC) {
                    double newDelay = brewProcess->getNewDelayTime();
                    if (newDelay >= 0) {
                        settings.setBrewDelay(newDelay);
                    }
                }
            } else if (lastProcess->getType() == MODE_GRIND) {
                if (auto *grindProcess = static_cast<GrindProcess *>(lastProcess);
                    grindProcess->target == ProcessTarget::VOLUMETRIC) {
                    double newDelay = grindProcess->getNewDelayTime();
                    if (newDelay >= 0) {
                        settings.setGrindDelay(newDelay);
                    }
                }
            }
        }
        lastProgress = now;
    }

    if (grindActiveUntil != 0 && (long)(now - grindActiveUntil) > 0)
        deactivateGrind();
    if (mode != MODE_STANDBY && settings.getStandbyTimeout() > 0 && (long)(now - lastAction) > settings.getStandbyTimeout())
        activateStandby();
}

void Controller::loopControl() {
    if (initialized) {
        updateControl();
    }
}

bool Controller::isUpdating() const { return updating; }

bool Controller::isAutotuning() const { return autotuning; }

bool Controller::isReady() const { return !isUpdating() && !isErrorState() && !isAutotuning(); }

bool Controller::isVolumetricAvailable() const {
#ifdef NIGHTLY_BUILD
    return isBluetoothScaleHealthy() || systemInfo.capabilities.dimming;
#else
    return isBluetoothScaleHealthy();
#endif
}

void Controller::autotune(int testTime, int samples) {
    if (isActiveSafe() || !isReady()) {
        return;
    }
    if (mode != MODE_STANDBY) {
        activateStandby();
    }
    autotuning = true;
    clientController.sendAutotune(testTime, samples);
    pluginManager->trigger("controller:autotune:start");
}

void Controller::startProcess(Process *process) {
    if (!isReady()) {
        delete process;
        return;
    }
    
    // Acquire mutex first to prevent TOCTOU race condition
    // Use portMAX_DELAY (blocking) with ESP_LOGE: failure here is critical and should never happen
    if (xSemaphoreTake(processMutex, portMAX_DELAY) != pdTRUE) {
        ESP_LOGE(LOG_TAG, "Failed to acquire mutex in startProcess");
        delete process;
        return;
    }
    
    // Check if process is already active while holding the mutex
    if (currentProcess != nullptr && currentProcess->isActive()) {
        xSemaphoreGive(processMutex);
        delete process;
        return;
    }
    
    processCompleted = false;
    this->currentProcess = process;
    
    xSemaphoreGive(processMutex);
    
    pluginManager->trigger("controller:process:start");
    updateLastAction();
}

float Controller::getTargetTemp() const {
    if (xSemaphoreTake(processMutex, pdMS_TO_TICKS(10)) != pdTRUE) {
        // If we can't get mutex, return safe default based on mode
        switch (mode) {
        case MODE_BREW:
        case MODE_GRIND:
            return profileManager->getSelectedProfile().temperature;
        case MODE_STEAM:
            return settings.getTargetSteamTemp();
        case MODE_WATER:
            return settings.getTargetWaterTemp();
        default:
            return 0;
        }
    }
    
    Process *proc = currentProcess;
    float result = 0;
    
    switch (mode) {
    case MODE_BREW:
    case MODE_GRIND:
        if (proc != nullptr && proc->isActive() && proc->getType() == MODE_BREW) {
            auto brewProcess = static_cast<BrewProcess *>(proc);
            result = brewProcess->getTemperature();
        } else {
            result = profileManager->getSelectedProfile().temperature;
        }
        break;
    case MODE_STEAM:
        result = settings.getTargetSteamTemp();
        break;
    case MODE_WATER:
        result = settings.getTargetWaterTemp();
        break;
    default:
        result = 0;
        break;
    }
    
    xSemaphoreGive(processMutex);
    return result;
}

void Controller::setTargetTemp(float temperature) {
    pluginManager->trigger("boiler:targetTemperature:change", "value", temperature);
    switch (mode) {
    case MODE_BREW:
    case MODE_GRIND:
        profileManager->getSelectedProfile().temperature = temperature;
        break;
    case MODE_STEAM:
        settings.setTargetSteamTemp(static_cast<int>(temperature));
        break;
    case MODE_WATER:
        settings.setTargetWaterTemp(static_cast<int>(temperature));
        break;
    default:;
    }
    updateLastAction();
}

void Controller::setPressureScale(void) {
    if (systemInfo.capabilities.pressure) {
        clientController.setPressureScale(settings.getPressureScaling());
    }
}

void Controller::setPumpModelCoeffs(void) {
    if (systemInfo.capabilities.dimming) {
        clientController.sendPumpModelCoeffs(settings.getPumpModelCoeffs());
    }
}

int Controller::getTargetGrindDuration() const { return settings.getTargetGrindDuration(); }

void Controller::setTargetGrindDuration(int duration) {
    Event event = pluginManager->trigger("controller:grindDuration:change", "value", duration);
    settings.setTargetGrindDuration(event.getInt("value"));
    updateLastAction();
}

void Controller::setTargetGrindVolume(double volume) {
    Event event = pluginManager->trigger("controller:grindVolume:change", "value", static_cast<float>(volume));
    settings.setTargetGrindVolume(event.getFloat("value"));
    updateLastAction();
}

void Controller::raiseTemp() {
    float temp = getTargetTemp();
    temp = constrain(temp + 1.0f, MIN_TEMP, MAX_TEMP);
    setTargetTemp(temp);
}

void Controller::lowerTemp() {
    float temp = getTargetTemp();
    temp = constrain(temp - 1.0f, MIN_TEMP, MAX_TEMP);
    setTargetTemp(temp);
}

void Controller::raiseBrewTarget() {
    if (isVolumetricAvailable() && profileManager->getSelectedProfile().isVolumetric()) {
        profileManager->getSelectedProfile().adjustVolumetricTarget(1);
    } else {
        profileManager->getSelectedProfile().adjustDuration(1);
    }
    handleProfileUpdate();
}

void Controller::lowerBrewTarget() {
    if (isVolumetricAvailable() && profileManager->getSelectedProfile().isVolumetric()) {
        profileManager->getSelectedProfile().adjustVolumetricTarget(-1);
    } else {
        profileManager->getSelectedProfile().adjustDuration(-1);
    }
    handleProfileUpdate();
}

void Controller::raiseGrindTarget() {
    if (settings.isVolumetricTarget() && isVolumetricAvailable()) {
        double newTarget = settings.getTargetGrindVolume() + 0.5;
        if (newTarget > BREW_MAX_VOLUMETRIC) {
            newTarget = BREW_MAX_VOLUMETRIC;
        }
        setTargetGrindVolume(newTarget);
    } else {
        int newDuration = getTargetGrindDuration() + 1000;
        if (newDuration > BREW_MAX_DURATION_MS) {
            newDuration = BREW_MAX_DURATION_MS;
        }
        setTargetGrindDuration(newDuration);
    }
}

void Controller::lowerGrindTarget() {
    if (settings.isVolumetricTarget() && isVolumetricAvailable()) {
        double newTarget = settings.getTargetGrindVolume() - 0.5;
        if (newTarget < BREW_MIN_VOLUMETRIC) {
            newTarget = BREW_MIN_VOLUMETRIC;
        }
        setTargetGrindVolume(newTarget);
    } else {
        int newDuration = getTargetGrindDuration() - 1000;
        if (newDuration < BREW_MIN_DURATION_MS) {
            newDuration = BREW_MIN_DURATION_MS;
        }
        setTargetGrindDuration(newDuration);
    }
}

void Controller::updateControl() {
    // Thread-safe access to currentProcess with mutex protection
    // Hold mutex for entire duration to prevent use-after-free
    if (xSemaphoreTake(processMutex, pdMS_TO_TICKS(10)) != pdTRUE) {
        return; // Skip this update if we can't get the mutex quickly
    }
    
    Process *proc = currentProcess;
    bool active = proc != nullptr && proc->isActive();
    
    // Copy values we need while holding the mutex to minimize lock time
    bool isAltRelayActive = false;
    int procType = -1;
    float pumpValue = 0.0f;
    bool relayActive = false;
    bool isAdvancedPump = false;
    bool brewPumpTargetIsPressure = false;
    float brewPumpPressure = 0.0f;
    float brewPumpFlow = 0.0f;
    float targetTemp = 0.0f;
    
    if (active) {
        procType = proc->getType();
        pumpValue = proc->getPumpValue();
        relayActive = proc->isRelayActive();
        isAltRelayActive = proc->isAltRelayActive();
        
        if (procType == MODE_BREW) {
            auto *brewProcess = static_cast<BrewProcess *>(proc);
            isAdvancedPump = brewProcess->isAdvancedPump();
            if (isAdvancedPump) {
                brewPumpTargetIsPressure = (brewProcess->getPumpTarget() == PumpTarget::PUMP_TARGET_PRESSURE);
                brewPumpPressure = brewProcess->getPumpPressure();
                brewPumpFlow = brewProcess->getPumpFlow();
            }
            targetTemp = brewProcess->getTemperature();
        }
    }
    
    // Get target temp while still holding mutex to avoid race condition
    // Inline the logic from getTargetTemp() to avoid deadlock
    if (targetTemp == 0.0f) {
        switch (mode) {
        case MODE_BREW:
        case MODE_GRIND:
            targetTemp = profileManager->getSelectedProfile().temperature;
            break;
        case MODE_STEAM:
            targetTemp = settings.getTargetSteamTemp();
            break;
        case MODE_WATER:
            targetTemp = settings.getTargetWaterTemp();
            break;
        default:
            targetTemp = 0;
            break;
        }
    }
    
    // Release mutex now that we've copied all needed values
    xSemaphoreGive(processMutex);

    if (targetTemp > .0f) {
        targetTemp = targetTemp + static_cast<float>(settings.getTemperatureOffset());
    }

    bool altRelayActive = false;
    if (active && isAltRelayActive) {
        if (procType == MODE_GRIND && settings.getAltRelayFunction() == ALT_RELAY_GRIND) {
            altRelayActive = true;
        }
    }

    clientController.sendAltControl(altRelayActive);
    if (active && systemInfo.capabilities.pressure) {
        if (procType == MODE_STEAM) {
            targetPressure = settings.getSteamPumpCutoff();
            targetFlow = pumpValue * 0.1f;
            clientController.sendAdvancedOutputControl(false, targetTemp, false, targetPressure, targetFlow);
            return;
        }
        if (procType == MODE_BREW) {
            if (isAdvancedPump) {
                clientController.sendAdvancedOutputControl(relayActive, targetTemp,
                                                           brewPumpTargetIsPressure,
                                                           brewPumpPressure, brewPumpFlow);
                targetPressure = brewPumpPressure;
                targetFlow = brewPumpFlow;
                return;
            }
        }
    }
    targetPressure = 0.0f;
    targetFlow = 0.0f;
    clientController.sendOutputControl(active && relayActive, active ? pumpValue : 0, targetTemp);
}

void Controller::activate() {
    if (isActiveSafe())
        return;
    clear();
    clientController.tare();
    if (isVolumetricAvailable()) {
#ifdef NIGHTLY_BUILD
        currentVolumetricSource =
            isBluetoothScaleHealthy() ? VolumetricMeasurementSource::BLUETOOTH : VolumetricMeasurementSource::FLOW_ESTIMATION;
#else
        currentVolumetricSource = VolumetricMeasurementSource::BLUETOOTH;
#endif
        if (mode == MODE_BREW) {
            pluginManager->trigger("controller:brew:prestart");
        }
    }
    delay(200);
    switch (mode) {
    case MODE_BREW:
        startProcess(new BrewProcess(profileManager->getSelectedProfile(),
                                     profileManager->getSelectedProfile().isVolumetric() && isVolumetricAvailable()
                                         ? ProcessTarget::VOLUMETRIC
                                         : ProcessTarget::TIME,
                                     settings.getBrewDelay()));
        break;
    case MODE_STEAM:
        startProcess(new SteamProcess(STEAM_SAFETY_DURATION_MS, settings.getSteamPumpPercentage()));
        break;
    case MODE_WATER:
        startProcess(new PumpProcess());
        break;
    default:;
    }
    
    // Check if we started a brew process (with mutex protection)
    bool isBrewProcess = false;
    if (xSemaphoreTake(processMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
        isBrewProcess = currentProcess != nullptr && currentProcess->getType() == MODE_BREW;
        xSemaphoreGive(processMutex);
    }
    
    if (isBrewProcess) {
        pluginManager->trigger("controller:brew:start");
    }
}

void Controller::deactivate() {
    // Use portMAX_DELAY (blocking) with ESP_LOGE: failure here is critical and should never happen
    if (xSemaphoreTake(processMutex, portMAX_DELAY) != pdTRUE) {
        ESP_LOGE(LOG_TAG, "Failed to acquire mutex in deactivate");
        return;
    }
    
    if (currentProcess == nullptr) {
        xSemaphoreGive(processMutex);
        return;
    }
    delete lastProcess;
    lastProcess = currentProcess;
    currentProcess = nullptr;
    
    xSemaphoreGive(processMutex);
    if (lastProcess->getType() == MODE_BREW) {
        pluginManager->trigger("controller:brew:end");
    } else if (lastProcess->getType() == MODE_GRIND) {
        pluginManager->trigger("controller:grind:end");
    }
    pluginManager->trigger("controller:process:end");
    updateLastAction();
}

void Controller::clear() {
    processCompleted = true;
    
    // Protect lastProcess access with mutex to prevent race with getProcessSnapshot() and onVolumetricMeasurement()
    if (xSemaphoreTake(processMutex, portMAX_DELAY) != pdTRUE) {
        ESP_LOGE(LOG_TAG, "Failed to acquire mutex in clear");
        return;
    }
    
    if (lastProcess != nullptr && lastProcess->getType() == MODE_BREW) {
        pluginManager->trigger("controller:brew:clear");
    }
    delete lastProcess;
    lastProcess = nullptr;
    
    xSemaphoreGive(processMutex);
    
    currentVolumetricSource = VolumetricMeasurementSource::INACTIVE;
}

void Controller::activateGrind() {
    pluginManager->trigger("controller:grind:start");
    if (isGrindActive())
        return;
    clear();
    if (settings.isVolumetricTarget() && isVolumetricAvailable()) {
        currentVolumetricSource = VolumetricMeasurementSource::BLUETOOTH;
        startProcess(new GrindProcess(ProcessTarget::VOLUMETRIC, 0, settings.getTargetGrindVolume(), settings.getGrindDelay()));
    } else {
        startProcess(
            new GrindProcess(ProcessTarget::TIME, settings.getTargetGrindDuration(), settings.getTargetGrindVolume(), 0.0));
    }
}

void Controller::deactivateGrind() {
    deactivate();
    clear();
}

void Controller::activateStandby() {
    setMode(MODE_STANDBY);
    deactivate();
}

void Controller::deactivateStandby() {
    deactivate();
    setMode(MODE_BREW);
}

bool Controller::isActive() const {
    // Use consistent timeout to prevent deadlocks in UI/event loops
    if (xSemaphoreTake(processMutex, pdMS_TO_TICKS(UI_MUTEX_TIMEOUT_MS)) != pdTRUE) {
        // For UI/display code: return false on timeout to avoid false positives
        ESP_LOGW(LOG_TAG, "Mutex timeout in isActive - returning false (UI-safe: assume inactive)");
        return false;
    }
    
    Process *proc = currentProcess;
    bool result = proc != nullptr && proc->isActive();
    
    xSemaphoreGive(processMutex);
    return result;
}

bool Controller::isActiveSafe() const {
    // Use consistent timeout to prevent deadlocks in UI/event loops
    if (xSemaphoreTake(processMutex, pdMS_TO_TICKS(UI_MUTEX_TIMEOUT_MS)) != pdTRUE) {
        // CRITICAL: Return true on timeout to prevent activate()/onFlush() from calling clear()
        // while a process may actually be running. False negatives are safer than false positives.
        ESP_LOGW(LOG_TAG, "Mutex timeout in isActiveSafe - returning true (conservative: assume active)");
        return true;
    }
    
    Process *proc = currentProcess;
    bool result = proc != nullptr && proc->isActive();
    
    xSemaphoreGive(processMutex);
    return result;
}

bool Controller::isGrindActive() const {
    // Use consistent timeout to prevent deadlocks in UI/event loops
    if (xSemaphoreTake(processMutex, pdMS_TO_TICKS(UI_MUTEX_TIMEOUT_MS)) != pdTRUE) {
        ESP_LOGW(LOG_TAG, "Mutex timeout in isGrindActive - returning false (process may be active)");
        return false;
    }
    
    Process *proc = currentProcess;
    bool result = proc != nullptr && proc->isActive() && proc->getType() == MODE_GRIND;
    
    xSemaphoreGive(processMutex);
    return result;
}

int Controller::getProcessType() const {
    if (xSemaphoreTake(processMutex, pdMS_TO_TICKS(UI_MUTEX_TIMEOUT_MS)) != pdTRUE) {
        ESP_LOGW(LOG_TAG, "Mutex timeout in getProcessType - returning -1");
        return -1;
    }
    
    int type = -1;
    if (currentProcess != nullptr) {
        type = currentProcess->getType();
    }
    
    xSemaphoreGive(processMutex);
    return type;
}

uint8_t Controller::getBrewProcessPhaseIndex() const {
    if (xSemaphoreTake(processMutex, pdMS_TO_TICKS(UI_MUTEX_TIMEOUT_MS)) != pdTRUE) {
        ESP_LOGW(LOG_TAG, "Mutex timeout in getBrewProcessPhaseIndex - returning 0");
        return 0;
    }
    
    uint8_t phaseIndex = 0;
    if (currentProcess != nullptr && currentProcess->getType() == MODE_BREW) {
        auto *brewProcess = static_cast<BrewProcess *>(currentProcess);
        phaseIndex = static_cast<uint8_t>(brewProcess->phaseIndex);
    }
    
    xSemaphoreGive(processMutex);
    return phaseIndex;
}

bool Controller::isBrewProcessVolumetric() const {
    if (xSemaphoreTake(processMutex, pdMS_TO_TICKS(UI_MUTEX_TIMEOUT_MS)) != pdTRUE) {
        ESP_LOGW(LOG_TAG, "Mutex timeout in isBrewProcessVolumetric - returning false");
        return false;
    }
    
    bool isVolumetric = false;
    if (currentProcess != nullptr && currentProcess->getType() == MODE_BREW) {
        auto *brewProcess = static_cast<BrewProcess *>(currentProcess);
        isVolumetric = brewProcess->target == ProcessTarget::VOLUMETRIC &&
                      brewProcess->currentPhase.hasVolumetricTarget() && isVolumetricAvailable();
    }
    
    xSemaphoreGive(processMutex);
    return isVolumetric;
}

bool Controller::isBrewProcessUtility() const {
    if (xSemaphoreTake(processMutex, pdMS_TO_TICKS(UI_MUTEX_TIMEOUT_MS)) != pdTRUE) {
        ESP_LOGW(LOG_TAG, "Mutex timeout in isBrewProcessUtility - returning false");
        return false;
    }
    
    bool isUtility = false;
    if (currentProcess != nullptr && currentProcess->getType() == MODE_BREW) {
        auto *brewProcess = static_cast<BrewProcess *>(currentProcess);
        isUtility = brewProcess->isUtility();
    }
    
    xSemaphoreGive(processMutex);
    return isUtility;
}

ProcessSnapshot Controller::getProcessSnapshot() const {
    ProcessSnapshot snapshot;
    
    // Use consistent timeout strategy to prevent deadlocks
    if (xSemaphoreTake(processMutex, pdMS_TO_TICKS(UI_MUTEX_TIMEOUT_MS)) != pdTRUE) {
        ESP_LOGW(LOG_TAG, "Mutex timeout in getProcessSnapshot - returning empty snapshot");
        return snapshot;
    }
    
    Process *proc = currentProcess;
    if (proc == nullptr) {
        proc = lastProcess;
    }
    
    if (proc != nullptr) {
        snapshot.exists = true;
        snapshot.isActive = proc->isActive();
        snapshot.isComplete = proc->isComplete();
        snapshot.type = proc->getType();
        // Note: These fields are only available in BrewProcess, not in base Process class
        if (proc->getType() == MODE_BREW) {
            auto *brew = static_cast<BrewProcess *>(proc);
            snapshot.started = brew->processStarted;
            snapshot.finished = brew->finished;
        } else {
            snapshot.started = 0;
            snapshot.finished = 0;
        }
        
        if (proc->getType() == MODE_BREW) {
            auto *brew = static_cast<BrewProcess *>(proc);
            snapshot.isBrew = true;
            snapshot.phaseIndex = static_cast<uint8_t>(brew->phaseIndex);
            snapshot.phaseName = brew->currentPhase.name;
            snapshot.phaseType = static_cast<int>(brew->currentPhase.phase);
            snapshot.currentPhaseStarted = brew->currentPhaseStarted;
            snapshot.currentVolume = brew->currentVolume;
            snapshot.target = brew->target;
            snapshot.hasVolumetricTarget = brew->currentPhase.hasVolumetricTarget();
            if (snapshot.hasVolumetricTarget) {
                Target t = brew->currentPhase.getVolumetricTarget();
                snapshot.volumetricTargetValue = t.value;
            }
            snapshot.phaseDuration = brew->getPhaseDuration();
            snapshot.phaseCount = brew->profile.phases.size();
            snapshot.totalDuration = brew->getTotalDuration();
            snapshot.brewVolume = brew->getBrewVolume();
            if (brew->processPhase != ProcessPhase::FINISHED) {
                snapshot.isAdvancedPump = brew->isAdvancedPump();
                if (snapshot.isAdvancedPump) {
                    snapshot.pumpPressure = brew->getPumpPressure();
                }
            }
        } else if (proc->getType() == MODE_GRIND) {
            snapshot.isGrind = true;
            auto *grind = static_cast<GrindProcess *>(proc);
            snapshot.target = grind->target;
            snapshot.grindVolume = grind->grindVolume;
            snapshot.grindTime = grind->time;
            snapshot.currentVolume = grind->currentVolume;
        }
    }
    
    xSemaphoreGive(processMutex);
    return snapshot;
}

int Controller::getMode() const { return mode; }

void Controller::setMode(int newMode) {
    Event modeEvent = pluginManager->trigger("controller:mode:change", "value", newMode);
    mode = modeEvent.getInt("value");
    steamReady = false;

    updateLastAction();
    setTargetTemp(getTargetTemp());
}

void Controller::onTempRead(float temperature) {
    float temp = temperature - static_cast<float>(settings.getTemperatureOffset());
    Event event = pluginManager->trigger("boiler:currentTemperature:change", "value", temp);
    currentTemp = event.getFloat("value");
}

void Controller::updateLastAction() { lastAction = millis(); }

void Controller::onOTAUpdate() {
    activateStandby();
    updating = true;
}

void Controller::onProfileSave() const { profileManager->saveProfile(profileManager->getSelectedProfile()); }

void Controller::onProfileSaveAsNew() {
    Profile &profile = profileManager->getSelectedProfile();
    profile.label = "Copy of " + profileManager->getSelectedProfile().label;
    profile.id = generateShortID();
    settings.setSelectedProfile(profile.id);
    profileManager->saveProfile(profileManager->getSelectedProfile());
    profileManager->addFavoritedProfile(profile.id);
}

void Controller::onVolumetricMeasurement(double measurement, VolumetricMeasurementSource source) {
    pluginManager->trigger(source == VolumetricMeasurementSource::FLOW_ESTIMATION
                               ? F("controller:volumetric-measurement:estimation:change")
                               : F("controller:volumetric-measurement:bluetooth:change"),
                           "value", static_cast<float>(measurement));
    if (source == VolumetricMeasurementSource::BLUETOOTH) {
        lastBluetoothMeasurement = millis();
    }

    if (currentVolumetricSource != source) {
        ESP_LOGD(LOG_TAG, "Ignoring volumetric measurement, source does not match");
        return;
    }
    
    // Update volume with mutex protection for both currentProcess and lastProcess
    if (xSemaphoreTake(processMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
        if (currentProcess != nullptr) {
            currentProcess->updateVolume(measurement);
        }
        // Also update lastProcess while holding mutex to prevent race with clear()
        if (lastProcess != nullptr && !lastProcess->isComplete()) {
            lastProcess->updateVolume(measurement);
        }
        xSemaphoreGive(processMutex);
    }
}

bool Controller::isBluetoothScaleHealthy() const {
    long timeSinceLastBluetooth = (long)(millis() - lastBluetoothMeasurement);
    return (timeSinceLastBluetooth < BLUETOOTH_GRACE_PERIOD_MS) || volumetricOverride;
}

void Controller::onFlush() {
    if (isActiveSafe()) {
        return;
    }
    clear();
    startProcess(new BrewProcess(FLUSH_PROFILE, ProcessTarget::TIME, settings.getBrewDelay()));
    pluginManager->trigger("controller:brew:start");
}

void Controller::onVolumetricDelete() {
    if (profileManager->getSelectedProfile().isVolumetric()) {
        profileManager->getSelectedProfile().removeVolumetricTarget();
    }
}

void Controller::handleBrewButton(int brewButtonStatus) {
    printf("current screen %d, brew button %d\n", getMode(), brewButtonStatus);
    if (brewButtonStatus) {
        switch (getMode()) {
        case MODE_STANDBY:
            deactivateStandby();
            break;
        case MODE_BREW:
            if (!isActiveSafe()) {
                deactivateStandby();
                clear();
                activate();
            } else if (settings.isMomentaryButtons()) {
                deactivate();
                clear();
            }
            break;
        case MODE_WATER:
            activate();
            break;
        case MODE_STEAM:
            deactivate();
            setMode(MODE_BREW);
        default:
            break;
        }
    } else if (!settings.isMomentaryButtons()) {
        if (getMode() == MODE_BREW) {
            if (isActiveSafe()) {
                deactivate();
                clear();
            } else {
                clear();
            }
        } else if (getMode() == MODE_WATER) {
            deactivate();
        }
    }
}

void Controller::handleSteamButton(int steamButtonStatus) {
    printf("current screen %d, steam button %d\n", getMode(), steamButtonStatus);
    if (steamButtonStatus) {
        switch (getMode()) {
        case MODE_STANDBY:
            setMode(MODE_STEAM);
            break;
        case MODE_BREW:
            setMode(MODE_STEAM);
            break;
        default:
            break;
        }
    } else if (!settings.isMomentaryButtons() && getMode() == MODE_STEAM) {
        deactivate();
        setMode(MODE_BREW);
    }
}

void Controller::handleProfileUpdate() {
    pluginManager->trigger("boiler:targetTemperature:change", "value", profileManager->getSelectedProfile().temperature);
    pluginManager->trigger("controller:targetDuration:change", "value", profileManager->getSelectedProfile().getTotalDuration());
    pluginManager->trigger("controller:targetVolume:change", "value", profileManager->getSelectedProfile().getTotalVolume());
}

void Controller::loopTask(void *arg) {
    TickType_t lastWake = xTaskGetTickCount();
    auto *controller = static_cast<Controller *>(arg);
    while (true) {
        controller->loopControl();
        xTaskDelayUntil(&lastWake, pdMS_TO_TICKS(controller->getMode() == MODE_STANDBY ? 1000 : 100));
    }
}
