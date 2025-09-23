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
    unsigned long lastMQTTLoop = 0;
    void loop() override {
        if (!client.connected()) return;

        unsigned long now = millis();
        if (now - lastMQTTLoop >= 100) {   // every 100ms
            client.loop();
            lastMQTTLoop = now;
        }
    }



  private:
    void publish(Controller *controller, const std::string &subTopic, const std::string &message);
    void handleCommand(Controller *controller, const String &topic, const String &payload);
    void publishBrewState(Controller *controller, const char *state);
    void publishDiscovery(Controller *controller);
    MQTTClient client;
    WiFiClient net;

    float lastTemperature = 0;
    float lastPressure = 0;
    float lastFlow = 0;
    float lastPuckFlow = 0;
    float lastPuckResistance = 0;
};

#endif // MQTTPLUGIN_H
