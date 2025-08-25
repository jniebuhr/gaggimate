#ifndef MQTTPLUGIN_H
#define MQTTPLUGIN_H
#include "../core/Plugin.h"
#include <MQTT.h>
#include <WiFi.h>

constexpr int MQTT_CONNECTION_RETRIES = 5;
constexpr int MQTT_CONNECTION_DELAY = 1000;

class MQTTPlugin : public Plugin {
  public:
    void setup(Controller *controller, PluginManager *pluginManager) override;
    bool connect(Controller *controller);
    void loop() override {
        // Event based plugin, no loop needed
    };

  private:
    void publish(const std::string &topic, const std::string &message);
    void publishBrewState(const char *state);
    void publishDiscovery(Controller *controller);
    MQTTClient client;
    WiFiClient net;

    float lastTemperature = 0;
};

#endif // MQTTPLUGIN_H
