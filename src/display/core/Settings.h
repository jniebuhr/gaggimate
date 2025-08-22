#pragma once
#ifndef SETTINGS_H
#define SETTINGS_H

#include <Arduino.h>
#include <Preferences.h>
#include <display/core/constants.h>
#include <display/core/utils.h>

#define PREFERENCES_KEY "controller"

class Settings;
using SettingsCallback = std::function<void(Settings *)>;

class Settings {
  public:
    Settings();

    void batchUpdate(const SettingsCallback &callback);
    void save(bool noDelay = false);

    // Getters and setters
    int getTargetBrewTemp() const { return targetBrewTemp; }
    int getTargetSteamTemp() const { return targetSteamTemp; }
    int getTargetWaterTemp() const { return targetWaterTemp; }
    int getTemperatureOffset() const { return temperatureOffset; }
    float getPressureScaling() const { return pressureScaling; }
    int getTargetDuration() const { return targetDuration; }
    int getTargetVolume() const { return targetVolume; }
    double getTargetGrindVolume() const { return targetGrindVolume; }
    int getTargetGrindDuration() const { return targetGrindDuration; }
    int getStartupMode() const { return startupMode; }
    int getStandbyTimeout() const { return standbyTimeout; }
    int getInfuseBloomTime() const { return infuseBloomTime; }
    int getInfusePumpTime() const { return infusePumpTime; }
    int getPressurizeTime() const { return pressurizeTime; }
    double getBrewDelay() const { return brewDelay; }
    double getGrindDelay() const { return grindDelay; }
    bool isDelayAdjust() const { return delayAdjust; }
    String getPid() const { return pid; }
    String getPumpModelCoeffs() const { return pumpModelCoeffs; }
    String getWifiSsid() const { return wifiSsid; }
    String getWifiPassword() const { return wifiPassword; }
    String getMdnsName() const { return mdnsName; }
    bool isHomekit() const { return homekit; }
    bool isVolumetricTarget() const { return volumetricTarget; }
    String getOTAChannel() const { return otaChannel; }
    String getSavedScale() const { return savedScale; }
    bool isBoilerFillActive() const { return boilerFillActive; }
    int getStartupFillTime() const { return startupFillTime; }
    int getSteamFillTime() const { return steamFillTime; }
    bool isSmartGrindActive() const { return smartGrindActive; }
    int getSmartGrindMode() const { return smartGrindMode; }
    String getSmartGrindIp() const { return smartGrindIp; }
    bool isHomeAssistant() const { return homeAssistant; }
    String getHomeAssistantIP() const { return homeAssistantIP; }
    String getHomeAssistantUser() const { return homeAssistantUser; }
    String getHomeAssistantPassword() const { return homeAssistantPassword; }
    int getHomeAssistantPort() const { return homeAssistantPort; }
    String getHomeAssistantTopic() const { return homeAssistantTopic; }
    bool isMomentaryButtons() const { return momentaryButtons; }
    String getTimezone() const { return timezone; }
    bool isClock24hFormat() const { return clock24hFormat; }
    String getSelectedProfile() const { return selectedProfile; }
    bool isProfilesMigrated() const { return profilesMigrated; }
    std::vector<String> getFavoritedProfiles() const { return favoritedProfiles; }
    std::vector<String> getProfileOrder() const { return profileOrder; }
    int getMainBrightness() const { return mainBrightness; }
    int getStandbyBrightness() const { return standbyBrightness; }
    int getStandbyBrightnessTimeout() const { return standbyBrightnessTimeout; }
    int getWifiApTimeout() const { return wifiApTimeout; }
    float getSteamPumpPercentage() const { return steamPumpPercentage; }
    int getThemeMode() const { return themeMode; }
    int getHistoryIndex() const { return historyIndex; }
    int getSunriseR() const { return sunriseR; }
    int getSunriseG() const { return sunriseG; }
    int getSunriseB() const { return sunriseB; }
    int getSunriseW() const { return sunriseW; }
    int getSunriseExtBrightness() const { return sunriseExtBrightness; }
    int getEmptyTankDistance() const { return emptyTankDistance; }
    int getFullTankDistance() const { return fullTankDistance; }
    void setTargetBrewTemp(int target_brew_temp);
    void setTargetSteamTemp(int target_steam_temp);
    void setTargetWaterTemp(int target_water_temp);
    void setTemperatureOffset(int temperature_offset);
    void setPressureScaling(float pressure_scaling);
    void setTargetDuration(int target_duration);
    void setTargetVolume(int target_volume);
    void setTargetGrindVolume(double target_grind_volume);
    void setTargetGrindDuration(int target_duration);
    void setStartupMode(int startup_mode);
    void setStandbyTimeout(int standby_timeout);
    void setInfuseBloomTime(int infuse_bloom_time);
    void setInfusePumpTime(int infuse_pump_time);
    void setPressurizeTime(int pressurize_time);
    void setBrewDelay(double brewDelay);
    void setGrindDelay(double grindDelay);
    void setDelayAdjust(bool delay_adjust);
    void setPid(const String &pid);
    void setPumpModelCoeffs(const String &pumpModelCoeffs);
    void setWifiSsid(const String &wifiSsid);
    void setWifiPassword(const String &wifiPassword);
    void setMdnsName(const String &mdnsName);
    void setHomekit(bool homekit);
    void setVolumetricTarget(bool volumetric_target);
    void setOTAChannel(const String &otaChannel);
    void setSavedScale(const String &savedScale);
    void setBoilerFillActive(bool boiler_fill_active);
    void setStartupFillTime(int startup_fill_time);
    void setSteamFillTime(int steam_fill_time);
    void setSmartGrindActive(bool smart_grind_active);
    void setSmartGrindIp(String smart_grind_ip);
    void setSmartGrindMode(int smart_grind_mode);
    void setHomeAssistant(bool homeAssistant);
    void setHomeAssistantUser(const String &homeAssistantUser);
    void setHomeAssistantPassword(const String &homeAssistantPassword);
    void setHomeAssistantIP(const String &homeAssistantIP);
    void setHomeAssistantPort(int homeAssistantPort);
    void setHomeAssistantTopic(const String &homeAssistantTopic);
    void setMomentaryButtons(bool momentary_buttons);
    void setTimezone(String timezone);
    void setClockFormat(bool format_24h);
    void setSelectedProfile(String selected_profile);
    void setProfilesMigrated(bool profiles_migrated);
    void setFavoritedProfiles(std::vector<String> favorited_profiles);
    void addFavoritedProfile(String profile);
    void removeFavoritedProfile(String profile);
    void setProfileOrder(std::vector<String> profile_order);
    void setMainBrightness(int main_brightness);
    void setStandbyBrightness(int standby_brightness);
    void setStandbyBrightnessTimeout(int standby_brightness_timeout);
    void setWifiApTimeout(int timeout);
    void setSteamPumpPercentage(float steam_pump_percentage);
    void setThemeMode(int theme_mode);
    void setHistoryIndex(int history_index);
    void setSunriseR(int sunrise_r);
    void setSunriseG(int sunrise_g);
    void setSunriseB(int sunrise_b);
    void setSunriseW(int sunrise_w);
    void setSunriseExtBrightness(int sunrise_ext_brightness);
    void setEmptyTankDistance(int empty_tank_distance);
    void setFullTankDistance(int full_tank_distance);

  private:
    Preferences preferences;
    bool dirty = false;

    String selectedProfile;
    bool profilesMigrated = false;
    int targetSteamTemp = 155;
    int targetWaterTemp = 80;
    int temperatureOffset = DEFAULT_TEMPERATURE_OFFSET;
    float pressureScaling = DEFAULT_PRESSURE_SCALING;
    double targetGrindVolume = 18;
    int targetGrindDuration = 25000;
    double brewDelay = 1000.0;
    double grindDelay = 1000.0;
    bool delayAdjust = true;
    int startupMode = MODE_STANDBY;
    int standbyTimeout = DEFAULT_STANDBY_TIMEOUT_MS;
    String pid = DEFAULT_PID;
    String pumpModelCoeffs = DEFAULT_PUMP_MODEL_COEFFS;
    String wifiSsid = "";
    String wifiPassword = "";
    String mdnsName = DEFAULT_MDNS_NAME;
    String savedScale = "";
    bool homekit = false;
    bool volumetricTarget = false;
    bool boilerFillActive = false;
    int startupFillTime = 0;
    int steamFillTime = 0;
    bool smartGrindActive = false;
    bool smartGrindToggle = false;
    int smartGrindMode = 0;
    String smartGrindIp = "";
    bool homeAssistant = false;
    String homeAssistantUser = "";
    String homeAssistantPassword = "";
    String homeAssistantIP = "";
    int homeAssistantPort = 1883;
    String homeAssistantTopic = DEFAULT_HOME_ASSISTANT_TOPIC;
    bool momentaryButtons = false;
    String timezone = DEFAULT_TIMEZONE;
    bool clock24hFormat = true;
    String otaChannel = DEFAULT_OTA_CHANNEL;
    std::vector<String> favoritedProfiles;
    std::vector<String> profileOrder; // persisted profile ordering
    float steamPumpPercentage = DEFAULT_STEAM_PUMP_PERCENTAGE;
    int historyIndex = 0;

    // Deprecated, use profiles
    int targetBrewTemp = 93;
    int targetDuration = 25000;
    int targetVolume = 36;
    int infuseBloomTime = 0;
    int infusePumpTime = 0;
    int pressurizeTime = 0;

    // Display settings
    int mainBrightness = 16;
    int standbyBrightness = 8;
    int standbyBrightnessTimeout = 60000; // 60 seconds default
    int wifiApTimeout = DEFAULT_WIFI_AP_TIMEOUT_MS;
    int themeMode = 0;

    // Sunrise settings
    int sunriseR = 0;
    int sunriseG = 0;
    int sunriseB = 255;
    int sunriseW = 50;
    int sunriseExtBrightness = 255;
    int emptyTankDistance = 200;
    int fullTankDistance = 50;

    void doSave();
    xTaskHandle taskHandle;
    static void loopTask(void *arg);
};

#endif // SETTINGS_H
