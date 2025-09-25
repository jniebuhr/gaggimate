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
    client.onMessage([this, controller](String &topic, String &payload) {
        handleCommand(controller, topic, payload);
        Serial.print("[MQTT] Command received. Topic: ");
        Serial.print(topic);
        Serial.print(" | Payload: ");
        Serial.println(payload);
    });
    printf("Connecting to MQTT");
    for (int i = 0; i < MQTT_CONNECTION_RETRIES; i++) {
        if (client.connect(clientId.c_str(), haUser.c_str(), haPassword.c_str())) {
            client.publish(lwtTopic.c_str(), "online", true, 1);

            String commandTopic = haTopic + "/" + String(cmac) + "/controller/command/#";

            if (client.subscribe(commandTopic.c_str())) {
                Serial.print("[MQTT] Subscribed to: ");
                Serial.println(commandTopic);
            } else {
                Serial.print("[MQTT] Failed to subscribe: ");
                Serial.println(commandTopic);
            }


            printf("\n");
            return true;
        }
        printf(".");
        delay(MQTT_CONNECTION_DELAY);
    }
    

    printf("\nConnection to MQTT failed.\n");
    return false;
}

void MQTTPlugin::handleCommand(Controller *controller, const String &topic, const String &payload) {
    Serial.print("[CMD-HNDL] Command received. Topic: ");
    Serial.print(topic);
    Serial.print(" | Payload: ");
    Serial.println(payload);

    if (topic.endsWith("/controller/command/mode")) {
        Serial.println("[CMD-HNDL] Handling mode change...");

        if (payload.equalsIgnoreCase("Standby")) {
            Serial.println("[CMD-HNDL] -> Standby");
            controller->activateStandby();
        } else if (payload.equalsIgnoreCase("Brew")) {
            Serial.println("[CMD-HNDL] -> Brew");
            controller->setMode(MODE_BREW);
        } else if (payload.equalsIgnoreCase("Steam")) {
            Serial.println("[CMD-HNDL] -> Steam");
            controller->setMode(MODE_STEAM);
        } else if (payload.equalsIgnoreCase("Water")) {
            Serial.println("[CMD-HNDL] -> Water");
            controller->setMode(MODE_WATER);
        } else if (payload.equalsIgnoreCase("Grind")) {
            Serial.println("[CMD-HNDL] -> Grind");
            controller->setMode(MODE_GRIND);
        } else {
            Serial.println("[CMD-HNDL] -> Unknown, defaulting to Standby");
            controller->activateStandby();
        }
    }

    else if (topic.endsWith("/controller/command/targetTemperature")) {
        float temp = payload.toFloat();
        Serial.print("[CMD-HNDL] Setting target temperature: ");
        Serial.println(temp);
        controller->setTargetTemp(temp);
    }
    else if (topic.endsWith("/controller/command/start")) {
        if (payload.equalsIgnoreCase("brew")) {
            Serial.println("[CMD-HNDL] -> Start brew");
            controller->setMode(MODE_BREW);
        } else if (payload.equalsIgnoreCase("grind")) {
            Serial.println("[CMD-HNDL] -> Start grind");
            controller->setMode(MODE_GRIND);
        }
        else if (payload.equalsIgnoreCase("flush")) {
            Serial.println("[CMD-HNDL] -> Start flush");
            controller->setMode(MODE_BREW);
        }
        else if (payload.equalsIgnoreCase("water")) {
            Serial.println("[CMD-HNDL] -> Start water");
            controller->setMode(MODE_WATER);
        }
    }
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
    snprintf(publishTopic, sizeof(publishTopic), "%s/%s/config", haTopic.c_str(), cmac);

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
        if (temp != lastPressure) {
            snprintf(json, sizeof(json), R"***({"pressure":%02f})***", temp);
            publish(controller, "boilers/0/pressure", json);
        }
        lastPressure = temp;
    });

    pluginManager->on("pump:puck-flow:change", [this, controller](Event const &event) {
        if (!client.connected())
            return;
        char json[50];
        const float temp = event.getFloat("value");
        if (temp != lastPuckFlow) {
            snprintf(json, sizeof(json), R"***({"puck flow":%02f})***", temp);
            publish(controller, "pump/0/puck-flow", json);
        }
        lastPuckFlow = temp;
    });

    pluginManager->on("pump:flow:change", [this, controller](Event const &event) {
        if (!client.connected())
            return;
        char json[50];
        const float temp = event.getFloat("value");
        if (temp != lastFlow) {
            snprintf(json, sizeof(json), R"***({"flow":%02f})***", temp);
            publish(controller, "pump/0/flow", json);
        }
        lastFlow = temp;
    });

    pluginManager->on("pump:puck-resistance:change", [this, controller](Event const &event) {
        if (!client.connected())
            return;
        char json[50];
        const float temp = event.getFloat("value");
        if (temp != lastPuckResistance) {
            if (isnan(temp) || isinf(temp)) {
                snprintf(json, sizeof(json), R"***({"puck-resistance":null})***");
            } else {
                snprintf(json, sizeof(json), R"***({"puck-resistance":%.2f})***", temp);
            }
            publish(controller, "pump/0/puck-resistance", json);
            publish(controller, "pump/0/puck-resistance", json);
        }
        lastPuckResistance = temp;
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
