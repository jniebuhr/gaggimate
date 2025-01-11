#ifndef MQTTPLUGIN_H
#define MQTTPLUGIN_H
#include "../core/Plugin.h"
#include <MQTT.h>
#include <WiFi.h>

class MQTTPlugin : public Plugin {
public:
    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override {};
private:
    MQTTClient client;
    WiFiClient net;
};

#endif // MQTTPLUGIN_H
