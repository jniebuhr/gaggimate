#include "Settings.h"

Settings::Settings() {
    preferences.begin(PREFERENCES_KEY, true);
    startupMode = preferences.getInt("sm", MODE_STANDBY);
    targetBrewTemp = preferences.getInt("tb", 90);
    targetSteamTemp = preferences.getInt("ts", 145);
    targetWaterTemp = preferences.getInt("tw", 80);
    targetDuration = preferences.getInt("td", 25000);
    targetGrindDuration = preferences.getInt("tgd", 25000);
    temperatureOffset = preferences.getInt("to", DEFAULT_TEMPERATURE_OFFSET);
    pid = preferences.getString("pid", DEFAULT_PID);
    wifiSsid = preferences.getString("ws", "");
    wifiPassword = preferences.getString("wp", "");
    mdnsName = preferences.getString("mn", DEFAULT_MDNS_NAME);
    homekit = preferences.getBool("hk", false);
    otaChannel = preferences.getString("oc", DEFAULT_OTA_CHANNEL);
    homeAssistant = preferences.getBool("ha", false);
    homeAssistantIP = preferences.getString("hai", "");
    homeAssistantPort = preferences.getInt("hap", 1883);
    preferences.end();
}

void Settings::batchUpdate(const SettingsCallback &callback) {
    inBatch = true;
    callback(this);
    inBatch = false;
    save();
}

void Settings::save() {
    if (inBatch)
        return;
    preferences.begin(PREFERENCES_KEY, false);
    preferences.putInt("sm", startupMode);
    preferences.putInt("tb", targetBrewTemp);
    preferences.putInt("ts", targetSteamTemp);
    preferences.putInt("tw", targetWaterTemp);
    preferences.putInt("td", targetDuration);
    preferences.putInt("tgd", targetGrindDuration);
    preferences.putInt("to", temperatureOffset);
    preferences.putString("pid", pid);
    preferences.putString("ws", wifiSsid);
    preferences.putString("wp", wifiPassword);
    preferences.putString("mn", mdnsName);
    preferences.putBool("hk", homekit);
    preferences.putString("oc", otaChannel);
    preferences.putBool("ha", homeAssistant);
    preferences.putString("hai", homeAssistantIP);
    preferences.putInt("hap", homeAssistantPort);
    preferences.end();
}

void Settings::setTargetBrewTemp(const int target_brew_temp) {
    targetBrewTemp = target_brew_temp;
    save();
}

void Settings::setTargetSteamTemp(const int target_steam_temp) {
    targetSteamTemp = target_steam_temp;
    save();
}

void Settings::setTargetWaterTemp(const int target_water_temp) {
    targetWaterTemp = target_water_temp;
    save();
}

void Settings::setTemperatureOffset(const int temperature_offset) {
    temperatureOffset = temperature_offset;
    save();
}

void Settings::setTargetDuration(const int target_duration) {
    targetDuration = target_duration;
    save();
}

void Settings::setTargetGrindDuration(const int target_duration) {
    targetGrindDuration = target_duration;
    save();
}

void Settings::setStartupMode(const int startup_mode) {
    startupMode = startup_mode;
    save();
}

void Settings::setPid(const String &pid) {
    this->pid = pid;
    save();
}

void Settings::setWifiSsid(const String &wifiSsid) {
    this->wifiSsid = wifiSsid;
    save();
}

void Settings::setWifiPassword(const String &wifiPassword) {
    this->wifiPassword = wifiPassword;
    save();
}

void Settings::setMdnsName(const String &mdnsName) {
    this->mdnsName = mdnsName;
    save();
}

void Settings::setHomekit(const bool homekit) {
    this->homekit = homekit;
    save();
}

void Settings::setOTAChannel(const String &otaChannel) {
    this->otaChannel = otaChannel;
    save();
}

void Settings::setHomeAssistant(const bool homeAssistant) {
    this->homeAssistant = homeAssistant;
    save();
}

void Settings::setHomeAssistantIP(const String &homeAssistantIP) {
    this->homeAssistantIP = homeAssistantIP;
    save();
}

void Settings::setHomeAssistantPort(const int homeAssistantPort) {
    this->homeAssistantPort = homeAssistantPort;
    save();
}
