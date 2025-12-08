#ifndef MQTTPLUGIN_H
#define MQTTPLUGIN_H
#include "../core/Plugin.h"
#include <PsychicMqttClient.h>
#include <WiFi.h>

constexpr int MQTT_CONNECTION_RETRIES = 5;
constexpr int MQTT_CONNECTION_DELAY = 1000;

class MQTTPlugin : public Plugin {
  public:
    void setup(Controller *controller, PluginManager *pluginManager) override;
    bool connect(Controller *controller);
    void loop() override;


  private:
    void publish(Controller *controller, const std::string &subTopic, const std::string &message);
    void handleCommand(Controller *controller, const String &topic, const String &payload);
    void publishBrewState(Controller *controller, const char *state);
    void publishDiscovery(Controller *controller);
    void ensureConnected(Controller *controller);

    PsychicMqttClient client;
    WiFiClient net;

    float lastTemperature = 0;
    float lastPressure = 0;
    float lastFlow = 0;
    float lastPuckFlow = 0;
    float lastPuckResistance = 0;
};

#endif // MQTTPLUGIN_H
