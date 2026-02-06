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
        WiFi.config(INADDR_NONE, INADDR_NONE, INADDR_NONE, INADDR_NONE);
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

    if (clientController.isReadyForConnection()) {
        clientController.connectToServer();
        setupInfos();
        pluginManager->trigger("controller:bluetooth:connect");
        if (!loaded) {
            loaded = true;
            if (settings.getStartupMode() == MODE_STANDBY)
                activateStandby();

            ESP_LOGI(LOG_TAG, "setting pressure scale to %.2f\n", settings.getPressureScaling());
            setPressureScale();
            clientController.sendPidSettings(settings.getPid());
            clientController.sendPumpModelCoeffs(settings.getPumpModelCoeffs());

            pluginManager->trigger("controller:ready");
        }
    }

    unsigned long now = millis();

    // Disable ping as we send output control frequently
    // if (now - lastPing > PING_INTERVAL) {
    //     lastPing = now;
    //     clientController.sendPing();
    // }

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
            updateLastAction();
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
    clientController.sendAutotune(testTime, samples);
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
    if (settings.isVolumetricTarget() && isVolumetricAvailable()) {
        profileManager->getSelectedProfile().adjustVolumetricTarget(1);
    } else {
        profileManager->getSelectedProfile().adjustDuration(1);
    }
    handleProfileUpdate();
}

void Controller::lowerBrewTarget() {
    if (settings.isVolumetricTarget() && isVolumetricAvailable()) {
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
    float targetTemp = getTargetTemp();
    if (targetTemp > .0f) {
        targetTemp = targetTemp + static_cast<float>(settings.getTemperatureOffset());
    }

    // Check if alt relay should be active based on process type and alt relay function setting
    bool altRelayActive = false;
    if (isActive() && currentProcess->isAltRelayActive()) {
        if (currentProcess->getType() == MODE_GRIND && settings.getAltRelayFunction() == ALT_RELAY_GRIND) {
            altRelayActive = true;
        }
    }

    clientController.sendAltControl(altRelayActive);
    if (isActive() && systemInfo.capabilities.pressure) {
        if (currentProcess->getType() == MODE_STEAM) {
            targetPressure = settings.getSteamPumpCutoff();
            targetFlow = currentProcess->getPumpValue() * 0.1f;
            clientController.sendAdvancedOutputControl(false, targetTemp, false, targetPressure, targetFlow);
            return;
        }
        //shut off pump if pressure if higher than 5 bar in water mode, to avoid high pressure.
        if (currentProcess->getType() == MODE_WATER) {
            clientController.sendAdvancedOutputControl(false, targetTemp, false, 5.0f, 0.0f);
            return;
        }
        if (currentProcess->getType() == MODE_BREW) {
            auto *brewProcess = static_cast<BrewProcess *>(currentProcess);
            if (brewProcess->isAdvancedPump()) {
                clientController.sendAdvancedOutputControl(brewProcess->isRelayActive(), targetTemp,
                                                           brewProcess->getPumpTarget() == PumpTarget::PUMP_TARGET_PRESSURE,
                                                           brewProcess->getPumpPressure(), brewProcess->getPumpFlow());
                targetPressure = brewProcess->getPumpPressure();
                targetFlow = brewProcess->getPumpFlow();
                return;
            }
        }
    }
    targetPressure = 0.0f;
    targetFlow = 0.0f;
    clientController.sendOutputControl(isActive() && currentProcess->isRelayActive(),
                                       isActive() ? currentProcess->getPumpValue() : 0, targetTemp);
}

void Controller::activate() {
    if (isActive())
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
    settings.addFavoritedProfile(profile.id);
    profileManager->saveProfile(profileManager->getSelectedProfile());
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
