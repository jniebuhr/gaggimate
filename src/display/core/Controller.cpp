#include "Controller.h"
#include "../config.h"
#include "../drivers/LilyGo-T-RGB/LV_Helper.h"
#include "../plugins/HomekitPlugin.h"
#include "../plugins/MQTTPlugin.h"
#include "../plugins/WebUIPlugin.h"
#include "../plugins/mDNSPlugin.h"
#include "../ui/ui.h"
#include "constants.h"
#include <SPIFFS.h>
#include <WiFiClient.h>
#include <ctime>

Controller::Controller()
    : timer(nullptr), mode(MODE_BREW), currentTemp(0), activeUntil(0), grindActiveUntil(0), lastPing(0), lastProgress(0),
      lastAction(0), loaded(false), updating(false) {}

void Controller::setup() {
    mode = settings.getStartupMode();

    pluginManager = new PluginManager();
    if (settings.isHomekit())
        pluginManager->registerPlugin(new HomekitPlugin(settings.getWifiSsid(), settings.getWifiPassword()));
    else
        pluginManager->registerPlugin(new mDNSPlugin());
    if (settings.isHomeAssistant()) {
        pluginManager->registerPlugin(new MQTTPlugin());
    }
    pluginManager->registerPlugin(new WebUIPlugin());
    pluginManager->setup(this);

    setupPanel();

    if (!SPIFFS.begin(true)) {
        Serial.println("An Error has occurred while mounting LittleFS");
    }
}

void Controller::connect() {
    if (initialized) return;
    lastPing = millis();
    pluginManager->trigger("controller:startup");

    setupBluetooth();
    setupWifi();

    updateUiSettings();
    updateUiCurrentTemp();
    initialized = true;
}

void Controller::setupBluetooth() {
    clientController.initClient();
    clientController.registerTempReadCallback([this](const float temp) { onTempRead(temp); });
    pluginManager->trigger("controller:bluetooth:init");
}

void Controller::setupPanel() {
    // Initialize T-RGB, if the initialization fails, false will be returned.
    if (!panel.begin()) {
        for (uint8_t i = 0; i < 20; i++) {
            Serial.println("Error, failed to initialize T-RGB");
            delay(1000);
        }
        ESP.restart();
    }
    beginLvglHelper(panel);
    panel.setBrightness(16);
    ui_init();
    lv_obj_add_flag(ui_StandbyScreen_updateIcon, LV_OBJ_FLAG_HIDDEN);
}

void Controller::setupWifi() {
    if (settings.getWifiSsid() != "" && settings.getWifiPassword() != "") {
        WiFi.mode(WIFI_STA);
        WiFi.begin(settings.getWifiSsid(), settings.getWifiPassword());
        for (int attempts = 0; attempts < WIFI_CONNECT_ATTEMPTS; attempts++) {
            if (WiFi.status() == WL_CONNECTED) {
                break;
            }
            delay(500);
            Serial.print(".");
        }
        if (WiFi.status() == WL_CONNECTED) {
            Serial.println("");
            Serial.print("Connected to ");
            Serial.println(settings.getWifiSsid());
            Serial.print("IP address: ");
            Serial.println(WiFi.localIP());

            configTzTime(TIMEZONE, NTP_SERVER);
        } else {
            WiFi.disconnect(true, true);
            Serial.println("Timed out while connecting to WiFi");
        }
    }
    if (WiFi.status() != WL_CONNECTED) {
        isApConnection = true;
        WiFi.mode(WIFI_AP);
        WiFi.softAP(WIFI_AP_SSID);
        Serial.println("Started in AP mode");
        Serial.print("Connect to:");
        Serial.println(WIFI_AP_SSID);
        Serial.print("IP address: ");
        Serial.println(WiFi.localIP());
    }

    pluginManager->on("ota:update:start", [this](Event const &) {
        this->updating = true;
        _ui_screen_change(&ui_InitScreen, LV_SCR_LOAD_ANIM_NONE, 0, 0, &ui_InitScreen_screen_init);
        lv_label_set_text(ui_InitScreen_mainLabel, "Updating...");
        lv_timer_handler();
    });
    pluginManager->on("ota:update:end", [this](Event const &) { this->updating = false; });

    pluginManager->trigger("controller:wifi:connect", "AP", isApConnection ? 1 : 0);
}

void Controller::loop() {
    pluginManager->loop();

    if (clientController.isReadyForConnection()) {
        clientController.connectToServer();
        pluginManager->trigger("controller:bluetooth:connect");
        if (!loaded) {
            loaded = true;
            settings.getStartupMode() == MODE_BREW
                ? _ui_screen_change(&ui_BrewScreen, LV_SCR_LOAD_ANIM_NONE, 500, 0, &ui_BrewScreen_screen_init)
                : activateStandby();
        }
    }

    unsigned long now = millis();
    if (now - lastPing > PING_INTERVAL) {
        lastPing = now;
        clientController.sendPing();
    }

    if (now - lastProgress > PROGRESS_INTERVAL) {
        if (mode == MODE_BREW)
            updateProgress();
        else if (mode == MODE_STANDBY)
            updateStandby();
        clientController.sendTemperatureControl(getTargetTemp() + settings.getTemperatureOffset());
        clientController.sendPidSettings(settings.getPid());
        updateRelay();
        lastProgress = now;
    }

    if (activeUntil != 0 && now > activeUntil)
        deactivate();
    if (grindActiveUntil != 0 && now > grindActiveUntil)
        deactivateGrind();
    if (mode != MODE_STANDBY && now > lastAction + STANDBY_TIMEOUT_MS)
        activateStandby();
}

bool Controller::isUpdating() const { return updating; }

int Controller::getTargetTemp() {
    switch (mode) {
    case MODE_BREW:
        return settings.getTargetBrewTemp();
    case MODE_STEAM:
        return settings.getTargetSteamTemp();
    case MODE_WATER:
        return settings.getTargetWaterTemp();
    default:
        return 0;
    }
}

void Controller::setTargetTemp(int temperature) {
    switch (mode) {
    case MODE_BREW:
        settings.setTargetBrewTemp(temperature);
        break;
    case MODE_STEAM:
        settings.setTargetSteamTemp(temperature);
        break;
    case MODE_WATER:
        settings.setTargetWaterTemp(temperature);
        break;
    default:;
    }
    updateUiSettings();
    clientController.sendPidSettings(settings.getPid());
    clientController.sendTemperatureControl(getTargetTemp() + settings.getTemperatureOffset());
    pluginManager->trigger("boiler:targetTemperature:change", "value", getTargetTemp());
}

int Controller::getTargetDuration() const { return settings.getTargetDuration(); }

void Controller::setTargetDuration(int duration) {
    Event event = pluginManager->trigger("controller:targetDuration:change", "value", duration);
    settings.setTargetDuration(event.getInt("value"));
    updateUiSettings();
}

int Controller::getTargetGrindDuration() const { return settings.getTargetGrindDuration(); }

void Controller::setTargetGrindDuration(int duration) {
    Event event = pluginManager->trigger("controller:grindDuration:change", "value", duration);
    settings.setTargetGrindDuration(event.getInt("value"));
    updateUiSettings();
}

void Controller::raiseTemp() {
    int temp = getTargetTemp();
    temp = max(MIN_TEMP, min(temp + 1, MAX_TEMP));
    setTargetTemp(temp);
}

void Controller::lowerTemp() {
    int temp = getTargetTemp();
    temp = max(MIN_TEMP, min(temp - 1, MAX_TEMP));
    setTargetTemp(temp);
}

void Controller::updateRelay() {
    bool active = isActive();
    float pumpValue = active ? mode == MODE_STEAM ? 4.f : 100.f : 0.f;
    bool valve = (active && mode == MODE_BREW);

    clientController.sendPumpControl(pumpValue);
    clientController.sendValveControl(valve);
    clientController.sendAltControl(isGrindActive());
}

void Controller::updateUiActive() const {
    bool active = isActive();
    lv_imgbtn_set_src(ui_SteamScreen_goButton, LV_IMGBTN_STATE_RELEASED, nullptr, active ? &ui_img_1456692430 : &ui_img_445946954,
                      nullptr);
    lv_imgbtn_set_src(ui_WaterScreen_goButton, LV_IMGBTN_STATE_RELEASED, nullptr, active ? &ui_img_1456692430 : &ui_img_445946954,
                      nullptr);
    lv_imgbtn_set_src(ui_GrindScreen_startButton, LV_IMGBTN_STATE_RELEASED, nullptr,
                      isGrindActive() ? &ui_img_1456692430 : &ui_img_445946954, nullptr);
}

void Controller::updateUiSettings() {
    int16_t setTemp = getTargetTemp();
    const int16_t angleRange = 3160;
    double percentage = ((double)setTemp) / ((double)MAX_TEMP);
    int16_t angle = (percentage * ((double)angleRange)) - angleRange / 2;
    lv_img_set_angle(ui_BrewScreen_tempTarget, angle);
    lv_img_set_angle(ui_StatusScreen_tempTarget, angle);
    lv_img_set_angle(ui_MenuScreen_tempTarget, angle);
    lv_img_set_angle(ui_SteamScreen_tempTarget, angle);
    lv_img_set_angle(ui_WaterScreen_tempTarget, angle);
    lv_img_set_angle(ui_GrindScreen_tempTarget, angle);

    lv_label_set_text_fmt(ui_StatusScreen_targetTemp, "%d°C", settings.getTargetBrewTemp());
    lv_label_set_text_fmt(ui_BrewScreen_targetTemp, "%d°C", settings.getTargetBrewTemp());
    lv_label_set_text_fmt(ui_SteamScreen_targetTemp, "%d°C", settings.getTargetSteamTemp());
    lv_label_set_text_fmt(ui_WaterScreen_targetTemp, "%d°C", settings.getTargetWaterTemp());

    double secondsDouble = settings.getTargetDuration() / 1000.0;
    auto minutes = (int)(secondsDouble / 60.0 - 0.5);
    auto seconds = (int)secondsDouble % 60;
    lv_label_set_text_fmt(ui_BrewScreen_targetDuration, "%2d:%02d", minutes, seconds);
    lv_label_set_text_fmt(ui_StatusScreen_targetDuration, "%2d:%02d", minutes, seconds);

    secondsDouble = settings.getTargetGrindDuration() / 1000.0;
    minutes = (int)(secondsDouble / 60.0 - 0.5);
    seconds = (int)secondsDouble % 60;
    lv_label_set_text_fmt(ui_GrindScreen_targetDuration, "%2d:%02d", minutes, seconds);

    updateLastAction();
}

void Controller::updateUiCurrentTemp() const {
    int temp = currentTemp;
    lv_arc_set_value(ui_BrewScreen_tempGauge, temp);
    lv_arc_set_value(ui_StatusScreen_tempGauge, temp);
    lv_arc_set_value(ui_MenuScreen_tempGauge, temp);
    lv_arc_set_value(ui_SteamScreen_tempGauge, temp);
    lv_arc_set_value(ui_WaterScreen_tempGauge, temp);
    lv_arc_set_value(ui_GrindScreen_tempGauge, temp);

    lv_label_set_text_fmt(ui_BrewScreen_tempText, "%d°C", temp);
    lv_label_set_text_fmt(ui_StatusScreen_tempText, "%d°C", temp);
    lv_label_set_text_fmt(ui_MenuScreen_tempText, "%d°C", temp);
    lv_label_set_text_fmt(ui_SteamScreen_tempText, "%d°C", temp);
    lv_label_set_text_fmt(ui_WaterScreen_tempText, "%d°C", temp);
    lv_label_set_text_fmt(ui_GrindScreen_tempText, "%d°C", temp);
}

void Controller::updateProgress() const {
    unsigned long now = millis();
    unsigned long progress = now - (activeUntil - settings.getTargetDuration());
    double secondsDouble = settings.getTargetDuration() / 1000.0;
    auto minutes = (int)(secondsDouble / 60.0 - 0.5);
    auto seconds = (int)secondsDouble % 60;
    double progressSecondsDouble = progress / 1000.0;
    auto progressMinutes = (int)(progressSecondsDouble / 60.0 - 0.5);
    auto progressSeconds = (int)progressSecondsDouble % 60;
    lv_bar_set_range(ui_StatusScreen_progressBar, 0, (int)secondsDouble);
    lv_bar_set_value(ui_StatusScreen_progressBar, progress / 1000, LV_ANIM_OFF);
    lv_label_set_text_fmt(ui_StatusScreen_progressLabel, "%2d:%02d / %2d:%02d", progressMinutes, progressSeconds, minutes,
                          seconds);
}

void Controller::updateStandby() {
    if (!isApConnection) {
        struct tm timeinfo;
        if (getLocalTime(&timeinfo)) {
            char time[6];
            strftime(time, 6, "%H:%M", &timeinfo);
            lv_label_set_text(ui_StandbyScreen_time, time);
            lv_obj_clear_flag(ui_StandbyScreen_time, LV_OBJ_FLAG_HIDDEN);
        }
    } else {
        lv_obj_add_flag(ui_StandbyScreen_time, LV_OBJ_FLAG_HIDDEN);
    }
    clientController.isConnected() ? lv_obj_clear_flag(ui_StandbyScreen_bluetoothIcon, LV_OBJ_FLAG_HIDDEN)
                                   : lv_obj_add_flag(ui_StandbyScreen_bluetoothIcon, LV_OBJ_FLAG_HIDDEN);
    !isApConnection &&WiFi.status() == WL_CONNECTED ? lv_obj_clear_flag(ui_StandbyScreen_wifiIcon, LV_OBJ_FLAG_HIDDEN)
                                                    : lv_obj_add_flag(ui_StandbyScreen_wifiIcon, LV_OBJ_FLAG_HIDDEN);
}

void Controller::activate() {
    if (isActive())
        return;
    unsigned long duration = 0;
    switch (mode) {
    case MODE_BREW:
        duration = settings.getTargetDuration();
        break;
    case MODE_STEAM:
        duration = STEAM_SAFETY_DURATION_MS;
        break;
    case MODE_WATER:
        duration = HOT_WATER_SAFETY_DURATION_MS;
        break;
    default:;
    }
    activeUntil = millis() + duration;
    updateUiActive();
    updateRelay();
    updateLastAction();
}

void Controller::deactivate() {
    activeUntil = 0;
    updateUiActive();
    if (mode == MODE_BREW) {
        _ui_screen_change(&ui_BrewScreen, LV_SCR_LOAD_ANIM_NONE, 500, 0, &ui_BrewScreen_screen_init);
    }
    updateRelay();
    updateLastAction();
}

void Controller::activateGrind() {
    pluginManager->trigger("controller:grind:start");
    if (isGrindActive())
        return;
    unsigned long duration = settings.getTargetGrindDuration();
    grindActiveUntil = millis() + duration;
    updateUiActive();
    updateRelay();
    updateLastAction();
}

void Controller::deactivateGrind() {
    pluginManager->trigger("controller:grind:stop");
    grindActiveUntil = 0;
    updateUiActive();
    updateRelay();
    updateLastAction();
}

void Controller::activateStandby() {
    setMode(MODE_STANDBY);
    deactivate();
    _ui_screen_change(&ui_StandbyScreen, LV_SCR_LOAD_ANIM_NONE, 500, 0, &ui_StandbyScreen_screen_init);
}

void Controller::deactivateStandby() {
    deactivate();
    setMode(MODE_BREW);
    _ui_screen_change(&ui_BrewScreen, LV_SCR_LOAD_ANIM_NONE, 500, 0, &ui_BrewScreen_screen_init);
}

bool Controller::isActive() const { return activeUntil > millis(); }

bool Controller::isGrindActive() const { return grindActiveUntil > millis(); }

int Controller::getMode() const { return mode; }

void Controller::setMode(int newMode) {
    Event modeEvent = pluginManager->trigger("controller:mode:change", "value", newMode);
    mode = modeEvent.getInt("value");
    updateUiSettings();
    setTargetTemp(getTargetTemp());
}

void Controller::onTempRead(float temperature) {
    float temp = temperature - settings.getTemperatureOffset();
    Event event = pluginManager->trigger("boiler:currentTemperature:change", "value", temp);
    currentTemp = event.getFloat("value");
    updateUiCurrentTemp();
}

void Controller::updateLastAction() { lastAction = millis(); }

void Controller::onOTAUpdate() {
    activateStandby();
    updating = true;
}
