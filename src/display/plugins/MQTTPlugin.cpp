#include "MQTTPlugin.h"
#include "../core/Controller.h"

void MQTTPlugin::connect(Controller *controller) {
    Settings settings = controller->getSettings();
    String ip = settings.getHomeAssistantIP();
    int haPort = settings.getHomeAssistantPort();
    String clientId = "GaggiMate";
    String haUser = settings.getHomeAssistantUser();
    String haPassword = settings.getHomeAssistantPassword();
    int keepAline = 60;
    
    client.begin(ip.c_str(), haPort, net);
    while (!client.connect(clientId.c_str(), haUser.c_str(), haPassword.c_str())) {
        void setKeepAlive(int keepAlive);
        Serial.print(".");
        delay(5000);
    }
}

void MQTTPlugin::setup(Controller *controller, PluginManager *pluginManager) {
    pluginManager->on("controller:wifi:connect", [this, controller](Event& event) {
        connect(controller);
        String mac = WiFi.macAddress();
        mac.replace(":", "_");
        const char* cmac = mac.c_str();
        char topic[50], json[500];
        sprintf(topic, "gaggimate/%s/config", cmac);
        sprintf(json, R"***({"dev":{"ids":"%s","name":"GaggiMate","mf":"GaggiMate","mdl":"GaggiMate","sw":"1.0","sn":"%s","hw":"1.0"},"o":{"name":"GaggiMate","sw":"v0.3.0","url":"https://gaggimate.eu/"},"cmps":{"boiler":{"p":"sensor","device_class":"temperature","unit_of_measurement":"°C","value_template":"{{ value_json.temperature }}","unique_id":"boiler0Tmp","state_topic":"gaggimate/%s/boilers/0/temperature"}},"state_topic":"gaggimate/%s/state","qos":2})***", cmac, cmac, cmac, cmac);
        client.publish(topic, json);
    });

    pluginManager->on("boiler:currentTemperature:change", [this](Event &event) {
        String mac = WiFi.macAddress();
        mac.replace(":", "_");
        const char* cmac = mac.c_str();
        char topic[50], json[50];
        sprintf(topic, "gaggimate/%s/boilers/0/temperature", cmac);
        float temp = event.getFloat("value");
        sprintf(json, R"***({"temperature":%02f})***", temp);
        client.publish(topic, json);
    });

    pluginManager->on("boiler:targetTemperature:change", [this](Event &event) {
        String mac = WiFi.macAddress();
        mac.replace(":", "_");
        const char* cmac = mac.c_str();
        char topic[50], json[50];
        sprintf(topic, "gaggimate/%s/boilers/0/targetTemperature", cmac);
        float temp = event.getFloat("value");
        sprintf(json, R"***({"temperature":%02f})***", temp);
        client.publish(topic, json);
    });
}
