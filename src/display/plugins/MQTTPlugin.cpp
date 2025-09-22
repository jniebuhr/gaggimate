#include "MQTTPlugin.h"
#include "../core/Controller.h"
#include <ArduinoJson.h>
#include <ctime>

bool MQTTPlugin::connect(Controller *controller) {
    const Settings settings = controller->getSettings();
    const String ip = settings.getHomeAssistantIP();
    const int haPort = settings.getHomeAssistantPort();
    const String clientId = "GaggiMate";
    const String haUser = settings.getHomeAssistantUser();
    const String haPassword = settings.getHomeAssistantPassword();

    String mac = WiFi.macAddress();
    mac.replace(":", "_");
    const char *cmac = mac.c_str();
    const String haTopic = settings.getHomeAssistantTopic();
    String lwtTopic = haTopic + "/" + String(cmac) + "/status";

    // Set Last Will (offline)
    client.setWill(lwtTopic.c_str(), "offline", true, 1);

    client.begin(ip.c_str(), haPort, net);
    client.setKeepAlive(10);
    printf("Connecting to MQTT");
    for (int i = 0; i < MQTT_CONNECTION_RETRIES; i++) {
        if (client.connect(clientId.c_str(), haUser.c_str(), haPassword.c_str())) {
            client.publish(lwtTopic.c_str(), "online", true, 1);
            printf("\n");
            return true;
        }
        printf(".");
        delay(MQTT_CONNECTION_DELAY);
    }
    printf("\nConnection to MQTT failed.\n");
    return false;
}

void MQTTPlugin::publishDiscovery(Controller *controller) {
    if (!client.connected())
        return;
    const Settings settings = controller->getSettings();
    const String haTopic = settings.getHomeAssistantTopic();
    String mac = WiFi.macAddress();
    mac.replace(":", "_");
    const char *cmac = mac.c_str();

    JsonDocument device;
    JsonDocument origin;
    JsonDocument components;

    // Device information
    device["ids"] = cmac;
    device["name"] = "GaggiMate";
    device["mf"] = "GaggiMate";
    device["mdl"] = "GaggiMate";
    device["sn"] = cmac;
    device["sw"] = controller->getSystemInfo().version;
    device["hw"] = controller->getSystemInfo().hardware;

    // Origin information
    origin["name"] = "GaggiMate";
    origin["sw"] = controller->getSystemInfo().version;
    origin["url"] = "https://gaggimate.eu/";

    // Components information
    JsonDocument cmps;
    JsonDocument boilerTemperature;
    JsonDocument boilerTargetTemperature;
    JsonDocument mode;

    boilerTemperature["name"] = "Boiler Temperature";
    boilerTemperature["p"] = "sensor";
    boilerTemperature["device_class"] = "temperature";
    boilerTemperature["unit_of_measurement"] = "°C";
    boilerTemperature["value_template"] = "{{ value_json.temperature | round(2) }}";
    boilerTemperature["unique_id"] = "boiler0Tmp";
    boilerTemperature["state_topic"] = haTopic + "/" + String(cmac) + "/boilers/0/temperature";

    boilerTargetTemperature["name"] = "Boiler Target Temperature";
    boilerTargetTemperature["p"] = "sensor";
    boilerTargetTemperature["device_class"] = "temperature";
    boilerTargetTemperature["unit_of_measurement"] = "°C";
    boilerTargetTemperature["value_template"] = "{{ value_json.temperature | round(2) }}";
    boilerTargetTemperature["unique_id"] = "boiler0TargetTmp";
    boilerTargetTemperature["state_topic"] = haTopic + "/" + String(cmac) + "/boilers/0/targetTemperature";

    mode["name"] = "Mode";
    mode["p"] = "text";
    mode["device_class"] = "text";
    mode["value_template"] = "{{ value_json.mode_str }}";
    mode["unique_id"] = "mode";
    mode["state_topic"] = haTopic + "/" + String(cmac) + "/controller/mode";

    cmps["boiler"] = boilerTemperature;
    cmps["boiler_target"] = boilerTargetTemperature;
    cmps["mode"] = mode;

    // Prepare the payload for Home Assistant discovery
    JsonDocument payload;
    payload["dev"] = device;
    payload["o"] = origin;
    payload["cmps"] = cmps;
    payload["state_topic"] = haTopic + "/" + String(cmac) + "/state";
    payload["qos"] = 2;

    char publishTopic[120];
    snprintf(publishTopic, sizeof(publishTopic), "%s/device/%s/config", haTopic.c_str(), cmac);

    client.publish(publishTopic, payload.as<String>());
}

void MQTTPlugin::publish(Controller *controller, const std::string &subTopic, const std::string &message) {
    if (!client.connected())
        return;

    const Settings settings = controller->getSettings();
    const String haTopic = settings.getHomeAssistantTopic();

    String mac = WiFi.macAddress();
    mac.replace(":", "_");
    const char *cmac = mac.c_str();

    char publishTopic[120];
    snprintf(publishTopic, sizeof(publishTopic), "%s/%s/%s", haTopic.c_str(), cmac, subTopic.c_str());

    client.publish(publishTopic, message.c_str());
}

void MQTTPlugin::publishBrewState(Controller *controller, const char *state) {
    char json[100];
    std::time_t now = std::time(nullptr); // Get current timestamp
    snprintf(json, sizeof(json), R"({"state":"%s","timestamp":%ld})", state, now);
    publish(controller, "controller/brew/state", json);
}

void MQTTPlugin::setup(Controller *controller, PluginManager *pluginManager) {
    pluginManager->on("controller:wifi:connect", [this, controller](const Event &) {
        if (!connect(controller))
            return;
        publishDiscovery(controller);
    });

    pluginManager->on("boiler:currentTemperature:change", [this, controller](Event const &event) {
        if (!client.connected())
            return;
        char json[50];
        const float temp = event.getFloat("value");
        if (temp != lastTemperature) {
            snprintf(json, sizeof(json), R"***({"temperature":%02f})***", temp);
            publish(controller, "boilers/0/temperature", json);
        }
        lastTemperature = temp;
    });

    pluginManager->on("boiler:targetTemperature:change", [this, controller](Event const &event) {
        if (!client.connected())
            return;
        char json[50];
        const float temp = event.getFloat("value");
        snprintf(json, sizeof(json), R"***({"temperature":%02f})***", temp);
        publish(controller, "boilers/0/targetTemperature", json);
    });

    pluginManager->on("boiler:pressure:change", [this, controller](Event const &event) {
        if (!client.connected())
            return;
        char json[50];
        const float temp = event.getFloat("value");
        snprintf(json, sizeof(json), R"***({"pressure":%02f})***", temp);
        publish(controller, "boilers/0/pressure", json);
    });

    pluginManager->on("boiler:puck-flow:change", [this, controller](Event const &event) {
        if (!client.connected())
            return;
        char json[50];
        const float temp = event.getFloat("value");
        snprintf(json, sizeof(json), R"***({"puck flow":%02f})***", temp);
        publish(controller, "boilers/0/puck-flow", json);
    });

    pluginManager->on("boiler:flow:change", [this, controller](Event const &event) {
        if (!client.connected())
            return;
        char json[50];
        const float temp = event.getFloat("value");
        snprintf(json, sizeof(json), R"***({"flow":%02f})***", temp);
        publish(controller, "boilers/0/flow", json);
    });

    pluginManager->on("boiler:puck-resistance:change", [this, controller](Event const &event) {
        if (!client.connected())
            return;
        char json[50];
        const float temp = event.getFloat("value");
        snprintf(json, sizeof(json), R"***({"puck resistance":%02f})***", temp);
        publish(controller, "boilers/0/puck-resistance", json);
    });

    pluginManager->on("controller:mode:change", [this, controller](Event const &event) {
        int newMode = event.getInt("value");
        const char *modeStr;
        switch (newMode) {
        case 0: modeStr = "Standby"; break;
        case 1: modeStr = "Brew"; break;
        case 2: modeStr = "Steam"; break;
        case 3: modeStr = "Water"; break;
        case 4: modeStr = "Grind"; break;
        default: modeStr = "Unknown"; break;
        }
        char json[100];
        snprintf(json, sizeof(json), R"({"mode":%d,"mode_str":"%s"})", newMode, modeStr);
        publish(controller, "controller/mode", json);
    });

    pluginManager->on("controller:brew:start", [this, controller](Event const &) {
        publishBrewState(controller, "brewing");
    });

    pluginManager->on("controller:brew:end", [this, controller](Event const &) {
        publishBrewState(controller, "not brewing");
    });
}
