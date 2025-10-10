#include "Controller.h"
#include "ArduinoJson.h"
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
#include <display/plugins/BLEScalePlugin.h>
#include <display/plugins/BoilerFillPlugin.h>
#include <display/plugins/HomekitPlugin.h>
#include <display/plugins/LedControlPlugin.h>
#include <display/plugins/MQTTPlugin.h>
#include <display/plugins/ShotHistoryPlugin.h>
#include <display/plugins/SmartGrindPlugin.h>
#include <display/plugins/WebUIPlugin.h>
#include <display/plugins/mDNSPlugin.h>
#include <display/plugins/AutoWakeupPlugin.h>

const String LOG_TAG = F("Controller");

void Controller::setup() {
    mode = settings.getStartupMode();

    if (!SPIFFS.begin(true)) {
        Serial.println(F("An Error has occurred while mounting SPIFFS"));
    }

    pluginManager = new PluginManager();
    profileManager = new ProfileManager(SPIFFS, "/p", settings, pluginManager);
    profileManager->setup();
#ifndef GAGGIMATE_HEADLESS
    ui = new DefaultUI(this, pluginManager);
#endif
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
#else
    this->onScreenReady();
#endif

    xTaskCreatePinnedToCore(loopTask, "Controller::loopControl", configMINIMAL_STACK_SIZE * 6, this, 1, &taskHandle, 1);
}

void Controller::onScreenReady() { screenReady = true; }

void Controller::onTargetChange(ProcessTarget target) { settings.setVolumetricTarget(target == ProcessTarget::VOLUMETRIC); }

void Controller::connect() {
    if (initialized)
        return;
    pluginManager->trigger("controller:startup");

    setupWifi();
    setupBluetooth();
    pluginManager->on("ota:update:start", [this](Event const &) { this->updating = true; });
    pluginManager->on("ota:update:end", [this](Event const &) { this->updating = false; });

    updateLastAction();
    initialized = true;
}

void Controller::setupBluetooth() {
    clientController.init();
    
    // Initialize ping timing
    lastPing = millis();
    
    // Start scanning for BLE servers
    clientController.scan();
    
    pluginManager->trigger("controller:ready");
    
    // Register unified nanopb message callback
    clientController.registerMessageCallback([this](const GaggiMessage& message) {
        ESP_LOGV(LOG_TAG, "Received nanopb message with payload type: %d", message.which_payload);
        
        switch (message.which_payload) {
            case GaggiMessage_sensor_data_tag:
                {
                    const auto& sensor = message.payload.sensor_data;
                    ESP_LOGV(LOG_TAG, "Received sensor data: temp=%.2f, pressure=%.2f", sensor.temperature, sensor.pressure);
                    onTempRead(sensor.temperature);
                    this->pressure = sensor.pressure;
                    this->currentPuckFlow = sensor.puck_flow;
                    this->currentPumpFlow = sensor.pump_flow;
                    pluginManager->trigger("boiler:pressure:change", "value", sensor.pressure);
                    pluginManager->trigger("pump:puck-flow:change", "value", sensor.puck_flow);
                    pluginManager->trigger("pump:flow:change", "value", sensor.pump_flow);
                    pluginManager->trigger("pump:puck-resistance:change", "value", sensor.puck_resistance);
                }
                break;
                
            case GaggiMessage_brew_button_tag:
                handleBrewButton(message.payload.brew_button.button_state);
                break;
                
            case GaggiMessage_steam_button_tag:
                handleSteamButton(message.payload.steam_button.button_state);
                break;
                
            case GaggiMessage_error_tag:
                {
                    int error = message.payload.error.error_code;
                    if (error != ERROR_CODE_TIMEOUT && error != this->error) {
                        this->error = error;
                        deactivate();
                        setMode(MODE_STANDBY);
                        pluginManager->trigger(F("controller:error"));
                        ESP_LOGE(LOG_TAG, "Received error %d", error);
                    }
                }
                break;
                
            case GaggiMessage_autotune_result_tag:
                {
                    const auto& autotune = message.payload.autotune_result;
                    ESP_LOGI(LOG_TAG, "Received new autotune values: %.3f, %.3f, %.3f", autotune.kp, autotune.ki, autotune.kd);
                    char pid[30];
                    snprintf(pid, sizeof(pid), "%.3f,%.3f,%.3f", autotune.kp, autotune.ki, autotune.kd);
                    settings.setPid(String(pid));
                    pluginManager->trigger("controller:autotune:result");
                    autotuning = false;
                }
                break;
                
            case GaggiMessage_volumetric_tag:
                onVolumetricMeasurement(message.payload.volumetric.volume, VolumetricMeasurementSource::FLOW_ESTIMATION);
                break;
                
            case GaggiMessage_tof_tag:
                {
                    int value = message.payload.tof.distance;
                    tofDistance = value;
                    ESP_LOGV(LOG_TAG, "Received new TOF distance: %d", value);
                    pluginManager->trigger("controller:tof:change", "value", value);
                }
                break;
                
            case GaggiMessage_system_info_tag:
                {
                    // Handle nanopb system info - this is the working approach
                    String info = String(message.payload.system_info.info);
                    ESP_LOGI(LOG_TAG, "Received nanopb system_info message: '%s' (length: %d)", info.c_str(), info.length());
                    parseSystemInfo(info);
                    
                    // Setup pressure scale and pump coefficients after getting capabilities
                    setPressureScale();
                    setPumpModelCoeffs();
                    pluginManager->trigger("controller:bluetooth:connect");
                    
                }
                break;
                
            default:
                ESP_LOGW(LOG_TAG, "Received unknown message type: %d", message.which_payload);
                break;
        }
    });
    
    pluginManager->trigger("controller:bluetooth:init");
}

void Controller::parseSystemInfo(const String& info) {
    ESP_LOGI(LOG_TAG, "Parsing system info: %s", info.c_str());
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, info);
    if (err) {
        ESP_LOGW(LOG_TAG, "Error deserializing system info JSON: %s", err.c_str());
        systemInfo = SystemInfo{
            .hardware = "GaggiMate Standard 1.x", .version = "v1.0.0", .capabilities = {.dimming = false, .pressure = false}};
    } else {
        ESP_LOGI(LOG_TAG, "Successfully parsed system info - hw: %s, v: %s, dm: %s, ps: %s, led: %s, tof: %s", 
                 doc["hw"].as<String>().c_str(), 
                 doc["v"].as<String>().c_str(),
                 doc["cp"]["dm"].as<bool>() ? "true" : "false",
                 doc["cp"]["ps"].as<bool>() ? "true" : "false", 
                 doc["cp"]["led"].as<bool>() ? "true" : "false",
                 doc["cp"]["tof"].as<bool>() ? "true" : "false");
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
        WiFi.mode(WIFI_STA);
        WiFi.begin(settings.getWifiSsid(), settings.getWifiPassword());
        WiFi.setTxPower(WIFI_POWER_19_5dBm);
        WiFi.setAutoReconnect(true);
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
                    ESP_LOGI(LOG_TAG, "Lost WiFi connection. Reason: %d", info.wifi_sta_disconnected.reason);
                    pluginManager->trigger("controller:wifi:disconnect");
                },
                WiFiEvent_t::ARDUINO_EVENT_WIFI_STA_DISCONNECTED);
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

    if (clientController.isReadyForConnection()) {
        if (!clientController.isConnected() && clientController.connect()) {
            
            
            // System info will be received automatically via nanopb message on connection
            // No need to read BLE characteristic - just proceed with initialization
            
            if (!loaded) {
                ESP_LOGI(LOG_TAG, "First connection or reconnection - performing full initialization");
                loaded = true;
                if (settings.getStartupMode() == MODE_STANDBY)
                    activateStandby();

                // Parse PID string and send individual parameters
                String pidStr = settings.getPid();
                float kp = 0, ki = 0, kd = 0;
                sscanf(pidStr.c_str(), "%f,%f,%f", &kp, &ki, &kd);
                if (clientController.isConnected()) {
                    ESP_LOGI(LOG_TAG, "Sending PID settings: kp=%.2f, ki=%.2f, kd=%.2f", kp, ki, kd);
                    clientController.sendPidSettings(kp, ki, kd);
                }

                pluginManager->trigger("controller:ready");
            }
        }
    } else if (!clientController.isConnected() && !clientController.isReadyForConnection()) {
        // If not connected and not ready for connection, restart scanning
        static unsigned long lastScanTime = 0;
        unsigned long now = millis();
        if (now - lastScanTime > 5000) { // Scan every 5 seconds when disconnected
            lastScanTime = now;
            ESP_LOGI(LOG_TAG, "BLE disconnected, restarting scan...");
            
            // Reset loaded flag for next connection - ensure full re-initialization
            loaded = false;
            
            clientController.scan();
        }
    }

    // Send periodic pings for safety check (keep existing functionality)
    unsigned long now = millis();
    if (now - lastPing > PING_INTERVAL) {
        lastPing = now;
        clientController.sendPing();
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

        // Handle current process
        if (currentProcess != nullptr) {
            if (currentProcess->getType() == MODE_BREW) {
                auto brewProcess = static_cast<BrewProcess *>(currentProcess);
                brewProcess->updatePressure(pressure);
                brewProcess->updateFlow(currentPumpFlow);
            }
            currentProcess->progress();
            if (!isActive()) {
                deactivate();
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
                    settings.setBrewDelay(brewProcess->getNewDelayTime());
                }
            } else if (lastProcess->getType() == MODE_GRIND) {
                if (auto *grindProcess = static_cast<GrindProcess *>(lastProcess);
                    grindProcess->target == ProcessTarget::VOLUMETRIC) {
                    settings.setGrindDelay(grindProcess->getNewDelayTime());
                }
            }
        }
        lastProgress = now;
    }

    if (grindActiveUntil != 0 && now > grindActiveUntil)
        deactivateGrind();
    if (mode != MODE_STANDBY && now > lastAction + settings.getStandbyTimeout())
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
    if (isActive() || !isReady()) {
        return;
    }
    if (mode != MODE_STANDBY) {
        activateStandby();
    }
    autotuning = true;
    if (clientController.isConnected()) {
        clientController.sendAutotune(testTime, samples);
    }
    pluginManager->trigger("controller:autotune:start");
}

void Controller::startProcess(Process *process) {
    if (isActive() || !isReady())
        return;
    processCompleted = false;
    this->currentProcess = process;
    pluginManager->trigger("controller:process:start");
    updateLastAction();
}

float Controller::getTargetTemp() const {
    switch (mode) {
    case MODE_BREW:
    case MODE_GRIND:
        if (isActive() && currentProcess != nullptr && currentProcess->getType() == MODE_BREW) {
            auto brewProcess = static_cast<BrewProcess *>(currentProcess);
            return brewProcess->getTemperature();
        }
        return profileManager->getSelectedProfile().temperature;
    case MODE_STEAM:
        return settings.getTargetSteamTemp();
    case MODE_WATER:
        return settings.getTargetWaterTemp();
    default:
        return 0;
    }
}

void Controller::setTargetTemp(float temperature) {
    pluginManager->trigger("boiler:targetTemperature:change", "value", temperature);
    switch (mode) {
    case MODE_BREW:
    case MODE_GRIND:
        // Update current profile
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
    if (systemInfo.capabilities.pressure && clientController.isConnected()) {
        clientController.sendPressureScale(settings.getPressureScaling());
    }
}

void Controller::setPumpModelCoeffs(void) {
    if (systemInfo.capabilities.dimming) {
        // Parse pump model coefficients string and send individual parameters
        String pumpStr = settings.getPumpModelCoeffs();
        float a = 0, b = 0, c = 0, d = 0;
        sscanf(pumpStr.c_str(), "%f,%f,%f,%f", &a, &b, &c, &d);
        clientController.sendPumpModelCoeffs(a, b, c, d);
    }
}

int Controller::getTargetDuration() const { return settings.getTargetDuration(); }

void Controller::setTargetDuration(int duration) {
    Event event = pluginManager->trigger("controller:targetDuration:change", "value", duration);
    settings.setTargetDuration(event.getInt("value"));
    updateLastAction();
}

void Controller::setTargetVolume(int volume) {
    Event event = pluginManager->trigger("controller:targetVolume:change", "value", volume);
    settings.setTargetVolume(event.getInt("value"));
    updateLastAction();
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
    if (settings.isVolumetricTarget() && isVolumetricAvailable()) {
        int newTarget = settings.getTargetVolume() + 1;
        if (newTarget > BREW_MAX_VOLUMETRIC) {
            newTarget = BREW_MAX_VOLUMETRIC;
        }
        setTargetVolume(newTarget);
    } else {
        int newDuration = getTargetDuration() + 1000;
        if (newDuration > BREW_MAX_DURATION_MS) {
            newDuration = BREW_MIN_DURATION_MS;
        }
        setTargetDuration(newDuration);
    }
}

void Controller::lowerBrewTarget() {
    if (settings.isVolumetricTarget() && isVolumetricAvailable()) {
        int newTarget = settings.getTargetVolume() - 1;
        if (newTarget < BREW_MIN_VOLUMETRIC) {
            newTarget = BREW_MIN_VOLUMETRIC;
        }
        setTargetVolume(newTarget);
    } else {
        int newDuration = getTargetDuration() - 1000;
        if (newDuration < BREW_MIN_DURATION_MS) {
            newDuration = BREW_MIN_DURATION_MS;
        }
        setTargetDuration(newDuration);
    }
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
    // Don't send control messages if BLE is not connected
    if (!clientController.isConnected()) {
        return;
    }
    
    float targetTemp = getTargetTemp();
    if (targetTemp > .0f) {
        targetTemp = targetTemp + static_cast<float>(settings.getTemperatureOffset());
    }
    
    bool altRelayActive = isActive() && currentProcess->isAltRelayActive();
    
    if (isActive() && systemInfo.capabilities.pressure) {
        if (currentProcess->getType() == MODE_STEAM) {
            targetPressure = settings.getSteamPumpCutoff();
            targetFlow = currentProcess->getPumpValue() * 0.1f;
            clientController.sendAdvancedOutputControl(true, altRelayActive, true, targetTemp, false, targetPressure, targetFlow);
            return;
        }
        if (currentProcess->getType() == MODE_BREW) {
            auto *brewProcess = static_cast<BrewProcess *>(currentProcess);
            if (brewProcess->isAdvancedPump()) {
                bool pressure_target = brewProcess->getPumpTarget() == PumpTarget::PUMP_TARGET_PRESSURE;
                clientController.sendAdvancedOutputControl(true, brewProcess->isRelayActive(), true, targetTemp,
                                                           pressure_target, brewProcess->getPumpPressure(), brewProcess->getPumpFlow());
                targetPressure = brewProcess->getPumpPressure();
                targetFlow = brewProcess->getPumpFlow();
                return;
            }
        }
    }
    targetPressure = 0.0f;
    targetFlow = 0.0f;
    bool relayActive = isActive() && currentProcess->isRelayActive();
    float pumpValue = isActive() ? currentProcess->getPumpValue() : 0;
    clientController.sendOutputControl(true, relayActive, true, targetTemp, pumpValue);
}

void Controller::activate() {
    if (isActive())
        return;
    clear();
    if (clientController.isConnected()) {
        clientController.sendTare();
    }
    if (isVolumetricAvailable()) {
#ifdef NIGHTLY_BUILD
        currentVolumetricSource =
            isBluetoothScaleHealthy() ? VolumetricMeasurementSource::BLUETOOTH : VolumetricMeasurementSource::FLOW_ESTIMATION;
#else
        currentVolumetricSource = VolumetricMeasurementSource::BLUETOOTH;
#endif
        pluginManager->trigger("controller:brew:prestart");
    }
    delay(200);
    switch (mode) {
    case MODE_BREW:
        startProcess(new BrewProcess(profileManager->getSelectedProfile(),
                                     settings.isVolumetricTarget() && isVolumetricAvailable() ? ProcessTarget::VOLUMETRIC
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
    if (currentProcess->getType() == MODE_BREW) {
        pluginManager->trigger("controller:brew:start");
    }
}

void Controller::deactivate() {
    if (currentProcess == nullptr) {
        return;
    }
    delete lastProcess;
    lastProcess = currentProcess;
    currentProcess = nullptr;
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
    if (lastProcess != nullptr && lastProcess->getType() == MODE_BREW) {
        pluginManager->trigger("controller:brew:clear");
    }
    delete lastProcess;
    lastProcess = nullptr;
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

bool Controller::isActive() const { return currentProcess != nullptr && currentProcess->isActive(); }

bool Controller::isGrindActive() const { return isActive() && currentProcess->getType() == MODE_GRIND; }

int Controller::getMode() const { return mode; }

void Controller::setMode(int newMode) {
    steamReady = false;
    Event modeEvent = pluginManager->trigger("controller:mode:change", "value", newMode);
    mode = modeEvent.getInt("value");

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
    if (currentProcess != nullptr) {
        currentProcess->updateVolume(measurement);
    }
    if (lastProcess != nullptr) {
        lastProcess->updateVolume(measurement);
    }
}

bool Controller::isBluetoothScaleHealthy() const {
    unsigned long timeSinceLastBluetooth = millis() - lastBluetoothMeasurement;
    return (timeSinceLastBluetooth < BLUETOOTH_GRACE_PERIOD_MS) || volumetricOverride;
}

void Controller::onFlush() {
    if (isActive()) {
        return;
    }
    clear();
    startProcess(new BrewProcess(FLUSH_PROFILE, ProcessTarget::TIME, settings.getBrewDelay()));
    pluginManager->trigger("controller:brew:start");
}

void Controller::handleBrewButton(int brewButtonStatus) {
    printf("current screen %d, brew button %d\n", getMode(), brewButtonStatus);
    if (brewButtonStatus) {
        switch (getMode()) {
        case MODE_STANDBY:
            deactivateStandby();
            break;
        case MODE_BREW:
            if (!isActive()) {
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
            if (isActive()) {
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
}

void Controller::loopTask(void *arg) {
    auto *controller = static_cast<Controller *>(arg);
    while (true) {
        controller->loopControl();
        vTaskDelay(100 / portTICK_PERIOD_MS);
    }
}
