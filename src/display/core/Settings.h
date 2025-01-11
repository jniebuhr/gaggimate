#ifndef SETTINGS_H
#define SETTINGS_H

#include "constants.h"

#include <Arduino.h>
#include <Preferences.h>

#define PREFERENCES_KEY "controller"

class Settings;
using SettingsCallback = std::function<void(Settings *)>;

class Settings {
  public:
    Settings();

    void batchUpdate(const SettingsCallback &callback);
    void save();

    // Getters and setters
    int getTargetBrewTemp() const { return targetBrewTemp; }
    int getTargetSteamTemp() const { return targetSteamTemp; }
    int getTargetWaterTemp() const { return targetWaterTemp; }
    int getTemperatureOffset() const { return temperatureOffset; }
    int getTargetDuration() const { return targetDuration; }
    int getTargetGrindDuration() const { return targetGrindDuration; }
    int getStartupMode() const { return startupMode; }
    String getPid() const { return pid; }
    String getWifiSsid() const { return wifiSsid; }
    String getWifiPassword() const { return wifiPassword; }
    String getMdnsName() const { return mdnsName; }
    bool isHomekit() const { return homekit; }
    String getOTAChannel() const { return otaChannel; }
    bool isHomeAssistant() const { return homeAssistant; }
    String getHomeAssistantIP() const { return homeAssistantIP; }
    int getHomeAssistantPort() const { return homeAssistantPort; }
    void setTargetBrewTemp(int target_brew_temp);
    void setTargetSteamTemp(int target_steam_temp);
    void setTargetWaterTemp(int target_water_temp);
    void setTemperatureOffset(int temperature_offset);
    void setTargetDuration(int target_duration);
    void setTargetGrindDuration(int target_duration);
    void setStartupMode(int startup_mode);
    void setPid(const String &pid);
    void setWifiSsid(const String &wifiSsid);
    void setWifiPassword(const String &wifiPassword);
    void setMdnsName(const String &mdnsName);
    void setHomekit(bool homekit);
    void setOTAChannel(const String &otaChannel);
    void setHomeAssistant(bool homeAssistant);
    void setHomeAssistantIP(const String &homeAssistantIP);
    void setHomeAssistantPort(int homeAssistantPort);

  private:
    Preferences preferences;
    bool inBatch = false;

    int targetBrewTemp = 93;
    int targetSteamTemp = 155;
    int targetWaterTemp = 80;
    int temperatureOffset = DEFAULT_TEMPERATURE_OFFSET;
    int targetDuration = 25000;
    int targetGrindDuration = 25000;
    int startupMode = MODE_STANDBY;
    String pid = DEFAULT_PID;
    String wifiSsid = "";
    String wifiPassword = "";
    String mdnsName = DEFAULT_MDNS_NAME;
    bool homekit = false;
    bool homeAssistant = false;
    String homeAssistantIP = "";
    int homeAssistantPort = 1883;

    String otaChannel = DEFAULT_OTA_CHANNEL;
};

#endif // SETTINGS_H
