#ifndef HOMEKITPLUGIN_H
#define HOMEKITPLUGIN_H
#include "../core/Plugin.h"
#include "HomeSpan.h"

#define HOMESPAN_PORT 8080
#define DEVICE_NAME "GaggiMate"
#define HOMEKIT_MANUFACTURER "GaggiMate"
#define HOMEKIT_MODEL "Classic Pro"

typedef std::function<void(bool stateChanged, bool temperatureChanged)> change_callback_t;
class HomekitAccessory : public Service::Thermostat {
  public:
    HomekitAccessory(change_callback_t callback);
    boolean getState() const;
    void setState(bool active) const;
    boolean update() override;
    void setCurrentTemperature(float temperatureValue) const;
    void setTargetTemperature(float temperatureValue) const;
    float getTargetTemperature() const;

  private:
    change_callback_t callback;
    SpanCharacteristic *state;
    SpanCharacteristic *targetState;
    SpanCharacteristic *currentTemperature;
    SpanCharacteristic *targetTemperature;
    SpanCharacteristic *displayUnits;
};

class HomekitPlugin : public Plugin {
  public:
    HomekitPlugin(String wifiSsid, String wifiPassword);
    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override;

    bool hasStateAction() const;
    bool hasTemperatureAction() const;
    void clearStateAction();
    void clearTemperatureAction();

  private:
    void initializeHomekit();
    void syncAccessoryState() const;
    String getSerialNumber() const;

    String wifiSsid;
    String wifiPassword;
    SpanAccessory *spanAccessory;
    Service::AccessoryInformation *accessoryInformation;
    Characteristic::Identify *identify;
    HomekitAccessory *accessory;
    bool homekitInitialized = false;
    bool stateActionRequired = false;
    bool temperatureActionRequired = false;
    Controller *controller;
};

#endif // HOMEKITPLUGIN_H
