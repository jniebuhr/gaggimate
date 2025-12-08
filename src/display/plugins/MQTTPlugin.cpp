#ifdef ESP32
extern "C" {
    #include "esp_log.h"
}
#endif
#include "MQTTPlugin.h"
#include "../core/Controller.h"
#include <ArduinoJson.h>
#include <ctime>



bool MQTTPlugin::connect(Controller *controller) {
    #ifdef ESP32
    esp_log_level_set("PsychicMqttClient", ESP_LOG_NONE);
    #endif
    const Settings settings = controller->getSettings();
    const String ip = settings.getHomeAssistantIP();
    const int haPort = settings.getHomeAssistantPort();
    const String haUser = settings.getHomeAssistantUser();
    const String haPassword = settings.getHomeAssistantPassword();
    const String haTopic = settings.getHomeAssistantTopic();

    const String MQTTuri = "mqtt://" + ip + ":" + String(haPort);

    String mac = WiFi.macAddress();
    mac.replace(":", "_");
    const String clientId = "GaggiMate_" + mac;
    String lwtTopic = haTopic + "/" + mac + "/status";

    client.setServer(MQTTuri.c_str());
    client.setCleanSession(true);
    client.setKeepAlive(30);
    client.setAutoReconnect(true);
    client.setWill(lwtTopic.c_str(), 1, true, "offline");

    client.onConnect([this, controller](bool) {
        Serial.println("[MQTT] Connected!");

        const Settings settings = controller->getSettings();
        String haTopic = settings.getHomeAssistantTopic();
        String mac = WiFi.macAddress();
        mac.replace(":", "_");

        String lwtTopic = haTopic + "/" + mac + "/status";
        client.publish(lwtTopic.c_str(), 1, true, "online");

        String commandTopic = haTopic + "/" + mac + "/controller/command/#";
        client.subscribe(commandTopic.c_str(), 1);

        Serial.print("[MQTT] Subscribed to: ");
        Serial.println(commandTopic);
    });

    client.onDisconnect([](bool sessionPresent) {
        Serial.println("[MQTT] Disconnected");
        Serial.print("Session present: ");
        Serial.println(sessionPresent);
    });

    client.onMessage([this, controller](char* topic, char* payload, int retain, int qos, bool dup) {
        String topicStr(topic);
        String payloadStr(payload); // payload is null-terminated
        handleCommand(controller, topicStr, payloadStr);
        Serial.printf("[MQTT] Message received: %s | %s\n", topic, payloadStr.c_str());
    });


    Serial.println("[MQTT] Connecting to broker...");
    client.setClientId(clientId.c_str());
    client.setCredentials(haUser.c_str(), haPassword.c_str());
    client.connect();

    return true; // Async connect, returns immediately
}

void MQTTPlugin::handleCommand(Controller *controller, const String &topic, const String &payload) {
    Serial.print("[CMD-HNDL] Command received. Topic: ");
    Serial.print(topic);
    Serial.print(" | Payload: ");
    Serial.println(payload);

    if (topic.endsWith("/controller/command/mode")) {
        if (payload.equalsIgnoreCase("Standby")) controller->activateStandby();
        else if (payload.equalsIgnoreCase("Brew")) controller->setMode(MODE_BREW);
        else if (payload.equalsIgnoreCase("Steam")) controller->setMode(MODE_STEAM);
        else if (payload.equalsIgnoreCase("Water")) controller->setMode(MODE_WATER);
        else if (payload.equalsIgnoreCase("Grind")) controller->setMode(MODE_GRIND);
        else controller->activateStandby();
    } 
    else if (topic.endsWith("/controller/command/targetTemperature")) {
        float temp = payload.toFloat();
        controller->setTargetTemp(temp);
    } 
    else if (topic.endsWith("/controller/command/start")) {
        if (payload.equalsIgnoreCase("brew")) controller->setMode(MODE_BREW);
        else if (payload.equalsIgnoreCase("grind")) controller->setMode(MODE_GRIND);
        else if (payload.equalsIgnoreCase("flush")) controller->setMode(MODE_BREW);
        else if (payload.equalsIgnoreCase("water")) controller->setMode(MODE_WATER);
    }
}

void MQTTPlugin::publishDiscovery(Controller *controller) {
    if (!client.connected()) return;

    const Settings settings = controller->getSettings();
    const String haTopic = settings.getHomeAssistantTopic();
    String mac = WiFi.macAddress();
    mac.replace(":", "_");
    const char *cmac = mac.c_str();

    JsonDocument device;
    JsonDocument origin;
    JsonDocument components;

    device["ids"] = cmac;
    device["name"] = "GaggiMate";
    device["mf"] = "GaggiMate";
    device["mdl"] = "GaggiMate";
    device["sn"] = cmac;
    device["sw"] = controller->getSystemInfo().version;
    device["hw"] = controller->getSystemInfo().hardware;

    origin["name"] = "GaggiMate";
    origin["sw"] = controller->getSystemInfo().version;
    origin["url"] = "https://gaggimate.eu/";

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

    JsonDocument payload;
    payload["dev"] = device;
    payload["o"] = origin;
    payload["cmps"] = cmps;
    payload["state_topic"] = haTopic + "/" + String(cmac) + "/state";
    payload["qos"] = 2;

    char publishTopic[120];
    snprintf(publishTopic, sizeof(publishTopic), "%s/%s/config", haTopic.c_str(), cmac);

    String jsonString;
    serializeJson(payload, jsonString);
    client.publish(publishTopic, 1, false, jsonString.c_str());
}

void MQTTPlugin::publish(Controller *controller, const std::string &subTopic, const std::string &message) {
    if (!client.connected()) return;

    const Settings settings = controller->getSettings();
    const String haTopic = settings.getHomeAssistantTopic();

    String mac = WiFi.macAddress();
    mac.replace(":", "_");
    const char *cmac = mac.c_str();

    char publishTopic[120];
    snprintf(publishTopic, sizeof(publishTopic), "%s/%s/%s", haTopic.c_str(), cmac, subTopic.c_str());
    client.publish(publishTopic, 1, false, message.c_str());
}

void MQTTPlugin::publishBrewState(Controller *controller, const char *state) {
    char json[100];
    std::time_t now = std::time(nullptr);
    snprintf(json, sizeof(json), R"({"state":"%s","timestamp":%ld})", state, now);
    publish(controller, "controller/brew/state", json);
}

void MQTTPlugin::setup(Controller *controller, PluginManager *pluginManager) {
    pluginManager->on("controller:wifi:connect", [this, controller](const Event &) {
        if (!connect(controller)) return;
        publishDiscovery(controller);
    });

    pluginManager->on("boiler:currentTemperature:change", [this, controller](Event const &event) {
        if (!client.connected()) return;
        const float temp = event.getFloat("value");
        if (temp != lastTemperature) {
            char json[50];
            snprintf(json, sizeof(json), R"({"temperature":%.2f})", temp);
            publish(controller, "boilers/0/temperature", json);
        }
        lastTemperature = temp;
    });

    pluginManager->on("boiler:targetTemperature:change", [this, controller](Event const &event) {
        if (!client.connected()) return;
        const float temp = event.getFloat("value");
        char json[50];
        snprintf(json, sizeof(json), R"({"temperature":%.2f})", temp);
        publish(controller, "boilers/0/targetTemperature", json);
    });

    pluginManager->on("boiler:pressure:change", [this, controller](Event const &event) {
        if (!client.connected()) return;
        const float temp = event.getFloat("value");
        if (temp != lastPressure) {
            char json[50];
            snprintf(json, sizeof(json), R"({"pressure":%.2f})", temp);
            publish(controller, "boilers/0/pressure", json);
        }
        lastPressure = temp;
    });

    pluginManager->on("pump:puck-flow:change", [this, controller](Event const &event) {
        if (!client.connected()) return;
        const float temp = event.getFloat("value");
        if (temp != lastPuckFlow) {
            char json[50];
            snprintf(json, sizeof(json), R"({"puck flow":%.2f})", temp);
            publish(controller, "pump/0/puck-flow", json);
        }
        lastPuckFlow = temp;
    });

    pluginManager->on("pump:flow:change", [this, controller](Event const &event) {
        if (!client.connected()) return;
        const float temp = event.getFloat("value");
        if (temp != lastFlow) {
            char json[50];
            snprintf(json, sizeof(json), R"({"flow":%.2f})", temp);
            publish(controller, "pump/0/flow", json);
        }
        lastFlow = temp;
    });

    pluginManager->on("pump:puck-resistance:change", [this, controller](Event const &event) {
        if (!client.connected()) return;
        const float temp = event.getFloat("value");
        if (temp != lastPuckResistance) {
            char json[50];
            if (isnan(temp) || isinf(temp)) {
                snprintf(json, sizeof(json), R"({"puck-resistance":null})");
            } else {
                snprintf(json, sizeof(json), R"({"puck-resistance":%.2f})", temp);
            }
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

    pluginManager->on("controller:brew:start", [this, controller](const Event &) {
        publishBrewState(controller, "brewing");
    });

    pluginManager->on("controller:brew:end", [this, controller](const Event &) {
        publishBrewState(controller, "not brewing");
    });

    
    pluginManager->on("controller:loop", [this, controller](const Event &) {
        static unsigned long lastCheck = 0;
        unsigned long now = millis();

        // Run every 5 seconds (to avoid spamming)
        if (now - lastCheck > 5000) {
            ensureConnected(controller);
            lastCheck = now;
        }
    });
};
void MQTTPlugin::ensureConnected(Controller *controller) {
    if (!controller) {
        // Avoid crash: controller not available yet
        return;
    }

    if (!client.connected()) {
        printf("[MQTT] Disconnected — attempting reconnect...\n");
        connect(controller);
    }
}

void MQTTPlugin::loop() {
    // Called every main loop iteration by the PluginManager.
    // Use it to maintain MQTT connection or handle background tasks.
    if (client.connected()) {
        // Some clients require polling or background handling here.
        // PsychicMqttClient does not, so this can stay empty.
    } else {
        // Reconnect watchdog
        ensureConnected(nullptr); // if your ensureConnected() needs a controller, adjust
    }
}