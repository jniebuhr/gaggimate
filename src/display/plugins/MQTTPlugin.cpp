#include "MQTTPlugin.h"
#include "../core/Controller.h"
#include <ctime>

bool MQTTPlugin::connect(Controller *controller) {
    const Settings settings = controller->getSettings();
    const String ip = settings.getHomeAssistantIP();
    const int haPort = settings.getHomeAssistantPort();
    const String clientId = "GaggiMate";
    const String haUser = settings.getHomeAssistantUser();
    const String haPassword = settings.getHomeAssistantPassword();

    client.begin(ip.c_str(), haPort, net);
    printf("Connecting to MQTT");
    for (int i = 0; i < MQTT_CONNECTION_RETRIES; i++) {
        if (client.connect(clientId.c_str(), haUser.c_str(), haPassword.c_str())) {
            printf("\n");
            return true;
        }
        printf(".");
        delay(MQTT_CONNECTION_DELAY);
    }
    printf("\nConnection to MQTT failed.\n");
    return false;
}

void MQTTPlugin::publish(const std::string &topic, const std::string &message) {
    if (!client.connected())
        return;
    String mac = WiFi.macAddress();
    mac.replace(":", "_");
    const char *cmac = mac.c_str();
    char publishTopic[80];
    snprintf(publishTopic, sizeof(publishTopic), "gaggimate/%s/%s", cmac, topic.c_str());
    client.publish(publishTopic, message.c_str());
}
void MQTTPlugin::publishBrewState(const char *state) {
    char json[100]; 
    std::time_t now = std::time(nullptr); // Get current timestame
    snprintf(json, sizeof(json), R"({"state":"%s","timestamp":%ld})", state, now);
    publish("controller/brew/state", json);
}

void MQTTPlugin::setup(Controller *controller, PluginManager *pluginManager) {
    pluginManager->on("controller:wifi:connect", [this, controller](const Event &) {
        if (!connect(controller))
            return;
        char json[500];
        String mac = WiFi.macAddress();
        mac.replace(":", "_");
        const char *cmac = mac.c_str();
        snprintf(
            json, sizeof(json),
            R"***({"dev":{"ids":"%s","name":"GaggiMate","mf":"GaggiMate","mdl":"GaggiMate","sw":"1.0","sn":"%s","hw":"1.0"},"o":{"name":"GaggiMate","sw":"v0.3.0","url":"https://gaggimate.eu/"},"cmps":{"boiler":{"p":"sensor","device_class":"temperature","unit_of_measurement":"°C","value_template":"{{ value_json.temperature }}","unique_id":"boiler0Tmp","state_topic":"gaggimate/%s/boilers/0/temperature"}},"state_topic":"gaggimate/%s/state","qos":2})***",
            cmac, cmac, cmac, cmac);
        publish("config", json);
    });

    pluginManager->on("boiler:currentTemperature:change", [this](Event const &event) {
        if (!client.connected())
            return;
        char json[50];
        const float temp = event.getFloat("value");
        if (temp != lastTemperature) {
            snprintf(json, sizeof(json), R"***({"temperature":%02f})***", temp);
            publish("boilers/0/temperature", json);
        }
        lastTemperature = temp;
    });
    pluginManager->on("boiler:targetTemperature:change", [this](Event const &event) {
        if (!client.connected())
            return;
        char json[50];
        const float temp = event.getInt("value");
        snprintf(json, sizeof(json), R"***({"temperature":%02f})***", temp);
        publish("boilers/0/targetTemperature", json);
    });
    pluginManager->on("controller:mode:change", [this](Event const &event) {
        int newMode = event.getInt("value");
        const char* modeStr;
        switch (newMode) {
            case 0: modeStr = "Standby"; break;
            case 1: modeStr = "Brew"; break;
            case 2: modeStr = "Steam"; break;
            case 3: modeStr = "Water"; break;
            case 4: modeStr = "Grind"; break;
            default: modeStr = "Unknown"; break; // Fallback in case of unexpected value
        }
        char json[100];
        snprintf(json, sizeof(json), R"({"mode":%d,"mode_str":"%s"})", newMode, modeStr);
        publish("controller/mode", json);
    });
    pluginManager->on("controller:brew:start", [this](Event const &) {
        publishBrewState("brewing");
    });

    pluginManager->on("controller:brew:end", [this](Event const &) {
        publishBrewState("not brewing");
    });
}