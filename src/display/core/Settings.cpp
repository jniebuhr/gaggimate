#include "Settings.h"

#include <utility>

Settings::Settings() {
    preferences.begin(PREFERENCES_KEY, true);
    startupMode = preferences.getInt("sm", MODE_STANDBY);
    targetBrewTemp = preferences.getInt("tb", 90);
    targetSteamTemp = preferences.getInt("ts", 145);
    targetWaterTemp = preferences.getInt("tw", 80);
    targetDuration = preferences.getInt("td", 25000);
    targetVolume = preferences.getInt("tv", 36);
    targetGrindVolume = preferences.getInt("tgv", 18);
    targetGrindDuration = preferences.getInt("tgd", 25000);
    brewDelay = preferences.getDouble("del_br", 1000.0);
    grindDelay = preferences.getDouble("del_gd", 1000.0);
    delayAdjust = preferences.getBool("del_ad", true);
    temperatureOffset = preferences.getInt("to", DEFAULT_TEMPERATURE_OFFSET);
    pressureScaling = preferences.getFloat("ps", DEFAULT_PRESSURE_SCALING);
    pid = preferences.getString("pid", DEFAULT_PID);
    wifiSsid = preferences.getString("ws", "");
    wifiPassword = preferences.getString("wp", "");
    mdnsName = preferences.getString("mn", DEFAULT_MDNS_NAME);
    homekit = preferences.getBool("hk", false);
    volumetricTarget = preferences.getBool("vt", false);
    otaChannel = preferences.getString("oc", DEFAULT_OTA_CHANNEL);
    infusePumpTime = preferences.getInt("ipt", 0);
    infuseBloomTime = preferences.getInt("ibt", 0);
    pressurizeTime = preferences.getInt("pt", 0);
    savedScale = preferences.getString("ssc", "");
    momentaryButtons = preferences.getBool("mb", false);
    boilerFillActive = preferences.getBool("bf_a", false);
    startupFillTime = preferences.getInt("bf_su", 5000);
    steamFillTime = preferences.getInt("bf_st", 5000);
    smartGrindActive = preferences.getBool("sg_a", false);
    smartGrindIp = preferences.getString("sg_i", "");
    smartGrindToggle = preferences.getBool("sg_t", false);
    smartGrindMode = preferences.getInt("sg_m", smartGrindToggle ? 1 : 0);
    homeAssistant = preferences.getBool("ha_a", false);
    homeAssistantIP = preferences.getString("ha_i", "");
    homeAssistantPort = preferences.getInt("ha_p", 1883);
    homeAssistantUser = preferences.getString("ha_u", "");
    homeAssistantPassword = preferences.getString("ha_pw", "");
    standbyTimeout = preferences.getInt("sbt", DEFAULT_STANDBY_TIMEOUT_MS);
    timezone = preferences.getString("tz", DEFAULT_TIMEZONE);
    clock24hFormat = preferences.getBool("clk_24h", true);
    selectedProfile = preferences.getString("sp", "");
    profilesMigrated = preferences.getBool("pm", false);
    favoritedProfiles = explode(preferences.getString("fp", ""), ',');
    preferences.end();

    xTaskCreate(loopTask, "Settings::loop", configMINIMAL_STACK_SIZE * 6, this, 1, &taskHandle);
}

void Settings::batchUpdate(const SettingsCallback &callback) {
    callback(this);
    save();
}

void Settings::save(bool noDelay) {
    if (noDelay) {
        doSave();
        return;
    }
    dirty = true;
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

void Settings::setPressureScaling(const float pressure_scaling) {
    pressureScaling = pressure_scaling;
    save();
}

void Settings::setTargetDuration(const int target_duration) {
    targetDuration = target_duration;
    save();
}

void Settings::setTargetVolume(int target_volume) {
    targetVolume = target_volume;
    save();
}

void Settings::setTargetGrindVolume(int target_grind_volume) {
    targetGrindVolume = target_grind_volume;
    save();
}

void Settings::setTargetGrindDuration(const int target_duration) {
    targetGrindDuration = target_duration;
    save();
}

void Settings::setBrewDelay(double brew_Delay) {
    brewDelay = brew_Delay;
    save();
}

void Settings::setGrindDelay(double grind_Delay) {
    grindDelay = grind_Delay;
    save();
}

void Settings::setDelayAdjust(bool delay_adjust) {
    delayAdjust = delay_adjust;
    save();
}

void Settings::setStartupMode(const int startup_mode) {
    startupMode = startup_mode;
    save();
}

void Settings::setStandbyTimeout(int standby_timeout) {
    standbyTimeout = standby_timeout;
    save();
}

void Settings::setInfuseBloomTime(int infuse_bloom_time) {
    infuseBloomTime = infuse_bloom_time;
    save();
}

void Settings::setInfusePumpTime(int infuse_pump_time) {
    infusePumpTime = infuse_pump_time;
    save();
}

void Settings::setPressurizeTime(int pressurize_time) {
    pressurizeTime = pressurize_time;
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

void Settings::setVolumetricTarget(bool volumetric_target) {
    this->volumetricTarget = volumetric_target;
    save();
}

void Settings::setOTAChannel(const String &otaChannel) {
    this->otaChannel = otaChannel;
    save();
}

void Settings::setSavedScale(const String &savedScale) {
    this->savedScale = savedScale;
    save();
}

void Settings::setBoilerFillActive(bool boiler_fill_active) {
    boilerFillActive = boiler_fill_active;
    save();
}

void Settings::setStartupFillTime(int startup_fill_time) {
    startupFillTime = startup_fill_time;
    save();
}

void Settings::setSteamFillTime(int steam_fill_time) {
    steamFillTime = steam_fill_time;
    save();
}

void Settings::setSmartGrindActive(bool smart_grind_active) {
    smartGrindActive = smart_grind_active;
    save();
}

void Settings::setSmartGrindIp(String smart_grind_ip) {
    this->smartGrindIp = std::move(smart_grind_ip);
    save();
}

void Settings::setSmartGrindMode(int smart_grind_mode) {
    this->smartGrindMode = smart_grind_mode;
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
void Settings::setHomeAssistantUser(const String &homeAssistantUser) {
    this->homeAssistantUser = homeAssistantUser;
    save();
}
void Settings::setHomeAssistantPassword(const String &homeAssistantPassword) {
    this->homeAssistantPassword = homeAssistantPassword;
    save();
}

void Settings::setMomentaryButtons(bool momentary_buttons) {
    momentaryButtons = momentary_buttons;
    save();
}

void Settings::setTimezone(String timezone) {
    this->timezone = std::move(timezone);
    save();
}

void Settings::setClockFormat(bool clock_24h_format) {
    this->clock24hFormat = clock_24h_format;
    save();
}

void Settings::setSelectedProfile(String selected_profile) {
    this->selectedProfile = std::move(selected_profile);
    save();
}

void Settings::setProfilesMigrated(bool profiles_migrated) {
    profilesMigrated = profiles_migrated;
    save();
}

void Settings::setFavoritedProfiles(std::vector<String> favorited_profiles) {
    favoritedProfiles = std::move(favorited_profiles);
    save();
}

void Settings::addFavoritedProfile(String profile) {
    favoritedProfiles.emplace_back(profile);
    save();
}

void Settings::removeFavoritedProfile(String profile) {
    favoritedProfiles.erase(std::remove(favoritedProfiles.begin(), favoritedProfiles.end(), profile), favoritedProfiles.end());
    favoritedProfiles.shrink_to_fit();
    save();
}

void Settings::doSave() {
    if (!dirty) {
        return;
    }
    dirty = false;
    ESP_LOGI("Settings", "Saving settings");
    preferences.begin(PREFERENCES_KEY, false);
    preferences.putInt("sm", startupMode);
    preferences.putInt("tb", targetBrewTemp);
    preferences.putInt("ts", targetSteamTemp);
    preferences.putInt("tw", targetWaterTemp);
    preferences.putInt("td", targetDuration);
    preferences.putInt("tv", targetVolume);
    preferences.putInt("tgv", targetGrindVolume);
    preferences.putInt("tgd", targetGrindDuration);
    preferences.putDouble("del_br", brewDelay);
    preferences.putDouble("del_gd", grindDelay);
    preferences.putBool("del_ad", delayAdjust);
    preferences.putInt("to", temperatureOffset);
    preferences.putFloat("ps", pressureScaling);
    preferences.putString("pid", pid);
    preferences.putString("ws", wifiSsid);
    preferences.putString("wp", wifiPassword);
    preferences.putString("mn", mdnsName);
    preferences.putBool("hk", homekit);
    preferences.putBool("vt", volumetricTarget);
    preferences.putString("oc", otaChannel);
    preferences.putInt("ipt", infusePumpTime);
    preferences.putInt("ibt", infuseBloomTime);
    preferences.putInt("pt", pressurizeTime);
    preferences.putString("ssc", savedScale);
    preferences.putBool("bf_a", boilerFillActive);
    preferences.putInt("bf_su", startupFillTime);
    preferences.putInt("bf_st", steamFillTime);
    preferences.putBool("sg_a", smartGrindActive);
    preferences.putString("sg_i", smartGrindIp);
    preferences.putBool("sg_t", smartGrindToggle);
    preferences.putInt("sg_m", smartGrindMode);
    preferences.putBool("ha_a", homeAssistant);
    preferences.putString("ha_i", homeAssistantIP);
    preferences.putInt("ha_p", homeAssistantPort);
    preferences.putString("ha_u", homeAssistantUser);
    preferences.putString("ha_pw", homeAssistantPassword);
    preferences.putString("tz", timezone);
    preferences.putBool("clk_24h", clock24hFormat);
    preferences.putString("sp", selectedProfile);
    preferences.putInt("sbt", standbyTimeout);
    preferences.putBool("pm", profilesMigrated);
    preferences.putInt("mb", momentaryButtons);
    preferences.putString("fp", implode(favoritedProfiles, ","));
    preferences.end();
}

void Settings::loopTask(void *arg) {
    auto *settings = static_cast<Settings *>(arg);
    while (true) {
        settings->doSave();
        vTaskDelay(1000 / portTICK_PERIOD_MS);
    }
}
