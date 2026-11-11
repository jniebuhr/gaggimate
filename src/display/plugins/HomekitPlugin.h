#ifndef HOMEKITPLUGIN_H
#define HOMEKITPLUGIN_H
#include "../core/Plugin.h"
#include "HomeSpan.h"

constexpr int HOMESPAN_PORT = 8080;
constexpr char DEVICE_NAME[] = "GaggiMate";

typedef std::function<void()> change_callback_t;
class HomekitAccessory : public Service::Thermostat {
  public:
    explicit HomekitAccessory(change_callback_t callback);
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

    boolean hasAction() const;
    void clearAction();

  private:
    String wifiSsid;
    String wifiPassword;
    SpanAccessory *spanAccessory;
    Service::AccessoryInformation *accessoryInformation;
    Characteristic::Identify *identify;
    HomekitAccessory *accessory;
    bool actionRequired = false;
    Controller *controller;
};

#endif // HOMEKITPLUGIN_H
