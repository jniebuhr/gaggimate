#ifndef MQTTPLUGIN_H
#define MQTTPLUGIN_H

#include "../core/Plugin.h"
#include <PsychicMqttClient.h>
#include <WiFi.h>

// Debounce for current temperature (QoS 0)
constexpr uint32_t TEMP_MIN_INTERVAL_MS = 500;
constexpr float TEMP_MIN_DELTA_C = 0.20f;

// Debounce for current pressure (QoS 0)
constexpr uint32_t PRESSURE_MIN_INTERVAL_MS = 500;
constexpr float PRESSURE_MIN_DELTA_BAR = 0.10f;

// --- MQTT keepalive & heartbeat policy ---
// KeepAlive is set to 5 seconds at the client level.
// We publish a heartbeat more frequently than that to guarantee activity.
constexpr uint32_t MQTT_KEEPALIVE_S = 5;

// Heartbeat period = keepalive - margin (margin = 1500 ms).
// That gives us 3.5 s, safely < 5 s even with some scheduler jitter.
constexpr uint32_t HEARTBEAT_MARGIN_MS = 1500;
constexpr uint32_t HEARTBEAT_PERIOD_MS = (MQTT_KEEPALIVE_S * 1000 > HEARTBEAT_MARGIN_MS + 1000)
                                             ? (MQTT_KEEPALIVE_S * 1000 - HEARTBEAT_MARGIN_MS)
                                             : 1000; // never go below 1s even if someone tweaks keepalive smaller

class MQTTPlugin : public Plugin {
  public:
    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override;

  private:
    // lifecycle
    void configureFromSettings(Controller *controller);
    void connectIfReady();
    void onConnected();
    void onDisconnected();
    void subscribeHAStatusOnce();

    // HA helpers
    void publishDiscovery(Controller *controller);
    void publish(const char *relativeTopic, const char *json, int qos, bool retain = false);
    void publishBrewState(const char *state);

    // identity & topics
    String macUnderscore_;
    String clientId_;        // gaggimate_<MAC_>
    String baseTopic_;       // gaggimate/<MAC_>/
    String statusTopic_;     // .../status
    String heartbeatTopic_;  // .../controller/heartbeat
    String discoveryPrefix_; // default "homeassistant"

    // broker settings (cached at boot)
    String brokerHost_;
    uint16_t brokerPort_ = 1883;
    String username_;
    String password_;
    bool mqttEnabled_ = true;

    // Must persist the URI string we pass to setServer()
    String mqttUri_;

    // state/flags
    Controller *ctrl_ = nullptr;
    bool haStatusSubscribed_ = false;
    bool clientConfigured_ = false;

    // capability cache
    bool hasPressure_ = false;

    // debouncing
    uint32_t lastTempPublishMs_ = 0;
    float lastTemperatureSent_ = NAN;

    uint32_t lastPressurePublishMs_ = 0;
    float lastPressureSent_ = NAN;

    // heartbeat
    uint32_t lastAnyPublishMs_ = 0;

    // async MQTT
    PsychicMqttClient mqtt_;
};

#endif // MQTTPLUGIN_H

// ======================= IMPLEMENTATION =======================

#include "../core/Controller.h"
#include "../core/PluginManager.h"
#include "MQTTPlugin.h"
#include "esp_mac.h" // for esp_read_mac()
#include <ArduinoJson.h>
#include <ctime>
#include <math.h>

// --- helpers ---
static String mac_to_underscored() {
    uint8_t mac[6];
    esp_read_mac(mac, ESP_MAC_WIFI_STA);
    char buf[3 * 6];
    snprintf(buf, sizeof(buf), "%02X_%02X_%02X_%02X_%02X_%02X", mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
    return String(buf);
}

static String haPrefixOrDefault(const String &cfg) { return cfg.length() ? cfg : String("homeassistant"); }

static void publishConfigJson(PsychicMqttClient &c, const String &topic, const JsonDocument &doc) {
    String payload;
    serializeJson(doc, payload);
    // Discovery MUST be retained
    c.publish(topic.c_str(), /*qos=*/1, /*retain=*/true, payload.c_str());
}

// --- MQTTPlugin ---

void MQTTPlugin::setup(Controller *controller, PluginManager *pluginManager) {
    ctrl_ = controller;

    // Cache Pro/Standard capability from Controller's system info
    // (If your accessor differs, adjust here.)
    hasPressure_ = controller->getSystemInfo().capabilities.pressure;

    // Respect UI toggle (Controller only registers us when enabled, but double-check)
    if (!controller->getSettings().isHomeAssistant()) {
        Serial.println("[MQTT] Disabled by settings (Home Assistant off).");
        mqttEnabled_ = false;
        return;
    }

    // Cache identity (once per boot)
    macUnderscore_ = mac_to_underscored();
    clientId_ = "gaggimate_" + macUnderscore_;
    baseTopic_ = "gaggimate/" + macUnderscore_ + "/";
    statusTopic_ = baseTopic_ + "status";
    heartbeatTopic_ = baseTopic_ + "controller/heartbeat";

    // Read settings once at boot (restart required after changes)
    configureFromSettings(controller);
    if (!mqttEnabled_) {
        Serial.println("[MQTT] Disabled: missing broker host.");
        return;
    }

    // ------- events → MQTT -------

    // Current boiler temperature — QoS 0 (fast stream) with debounce
    pluginManager->on("boiler:currentTemperature:change", [this](Event const &event) {
        if (!mqtt_.connected())
            return;
        const float temp = event.getFloat("value");
        const uint32_t now = millis();
        const bool interval_ok = (now - lastTempPublishMs_) >= TEMP_MIN_INTERVAL_MS;
        const bool delta_ok = isnan(lastTemperatureSent_) || fabsf(temp - lastTemperatureSent_) >= TEMP_MIN_DELTA_C;
        if (interval_ok && delta_ok) {
            char json[64];
            snprintf(json, sizeof(json), R"({"temperature":%.2f})", temp);
            publish("boilers/0/temperature", json, /*qos=*/0, /*retain=*/false);
            lastTemperatureSent_ = temp;
            lastTempPublishMs_ = now;
        }
    });

    // Current pressure — QoS 0 (fast stream) with debounce (only if present)
    if (hasPressure_) {
        pluginManager->on("boiler:pressure:change", [this](Event const &event) {
            if (!mqtt_.connected())
                return;

            const float p = event.getFloat("value");
            const uint32_t now = millis();
            const bool interval_ok = (now - lastPressurePublishMs_) >= PRESSURE_MIN_INTERVAL_MS;
            const bool delta_ok = isnan(lastPressureSent_) || fabsf(p - lastPressureSent_) >= PRESSURE_MIN_DELTA_BAR;

            if (interval_ok && delta_ok) {
                char json[48];
                snprintf(json, sizeof(json), R"({"pressure":%.2f})", p);
                publish("boilers/0/pressure", json, /*qos=*/0, /*retain=*/false);
                lastPressureSent_ = p;
                lastPressurePublishMs_ = now;
            }
        });
    }

    // Target temperature — QoS 1
    pluginManager->on("boiler:targetTemperature:change", [this](Event const &event) {
        if (!mqtt_.connected())
            return;
        const float temp = event.getFloat("value");
        char json[64];
        snprintf(json, sizeof(json), R"({"temperature":%.2f})", temp);
        publish("boilers/0/targetTemperature", json, /*qos=*/1, /*retain=*/false);
    });

    // Mode — QoS 1
    pluginManager->on("controller:mode:change", [this](Event const &event) {
        if (!mqtt_.connected())
            return;
        const int newMode = event.getInt("value");
        const char *modeStr;
        switch (newMode) {
        case 0:
            modeStr = "Standby";
            break;
        case 1:
            modeStr = "Brew";
            break;
        case 2:
            modeStr = "Steam";
            break;
        case 3:
            modeStr = "Water";
            break;
        case 4:
            modeStr = "Grind";
            break;
        default:
            modeStr = "Unknown";
            break;
        }
        char json[96];
        snprintf(json, sizeof(json), R"({"mode":%d,"mode_str":"%s"})", newMode, modeStr);
        publish("controller/mode", json, /*qos=*/1, /*retain=*/false);
    });

    // Brew lifecycle — QoS 1
    pluginManager->on("controller:brew:start", [this](Event const &) {
        if (mqtt_.connected())
            publishBrewState("brewing");
    });
    pluginManager->on("controller:brew:end", [this](Event const &) {
        if (mqtt_.connected())
            publishBrewState("not brewing");
    });

    // Wi-Fi “connected” event → try to connect (non-blocking)
    pluginManager->on("controller:wifi:connect", [this](const Event &) { connectIfReady(); });

    // Try to connect now if Wi-Fi is already up
    connectIfReady();
}

void MQTTPlugin::loop() {
    if (!mqtt_.connected())
        return;

    const uint32_t now = millis();
    // If no publishes happened recently, send a heartbeat BEFORE the keepalive window elapses.
    if (now - lastAnyPublishMs_ >= HEARTBEAT_PERIOD_MS) {
        std::time_t t = std::time(nullptr);
        char json[64];
        snprintf(json, sizeof(json), R"({"ts":%ld})", (long)t);
        mqtt_.publish(heartbeatTopic_.c_str(), /*qos=*/0, /*retain=*/false, json);
        lastAnyPublishMs_ = now;
    }
}

// ---- config & connection ----
void MQTTPlugin::configureFromSettings(Controller *controller) {
    const Settings s = controller->getSettings();

    discoveryPrefix_ = haPrefixOrDefault(s.getHomeAssistantTopic());
    brokerHost_ = s.getHomeAssistantIP();
    brokerPort_ = s.getHomeAssistantPort();
    username_ = s.getHomeAssistantUser();
    password_ = s.getHomeAssistantPassword();

    mqttEnabled_ = (brokerHost_.length() > 0);

    if (!mqttEnabled_)
        return;

    Serial.println("[MQTT] Enabled.");
    Serial.printf("[MQTT] discoveryPrefix='%s'\n", discoveryPrefix_.c_str());
    Serial.printf("[MQTT] Server host: %s\n", brokerHost_.c_str());
    Serial.printf("[MQTT] Server port: %u\n", brokerPort_);

    // IMPORTANT: keep URI storage alive for the lifetime of the client
    mqttUri_ = "mqtt://" + brokerHost_ + ":" + String(brokerPort_);
    Serial.printf("[MQTT] URI: %s\n", mqttUri_.c_str());
    mqtt_.setServer(mqttUri_.c_str());

    if (username_.length()) {
        mqtt_.setCredentials(username_.c_str(), password_.length() ? password_.c_str() : nullptr);
        Serial.printf("[MQTT] Using credentials: user='%s'\n", username_.c_str());
    }

    // Requested behavior:
    mqtt_.setCleanSession(true);          // fresh session each connect
    mqtt_.setKeepAlive(MQTT_KEEPALIVE_S); // 5-second MQTT PINGREQ policy

    // LWT: retained "offline" (broker will publish if we truly drop)
    Serial.printf("[MQTT] LWT topic: %s (qos=1 retain=true payload='offline')\n", statusTopic_.c_str());
    mqtt_.setWill(statusTopic_.c_str(), /*qos=*/1, /*retain=*/true, "offline");

    // Handlers
    mqtt_.onConnect([this](bool /*sessionPresent*/) { onConnected(); });
    mqtt_.onDisconnect([this](bool /*sp*/) { onDisconnected(); });

    clientConfigured_ = true;
}

void MQTTPlugin::connectIfReady() {
    if (!mqttEnabled_)
        return;
    if (!clientConfigured_)
        return;

    if ((WiFi.getMode() & WIFI_MODE_STA) == 0) {
        Serial.println("[MQTT] STA mode not active.");
        return;
    }
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[MQTT] Wi-Fi not connected yet.");
        return;
    }
    if (!WiFi.localIP()) {
        Serial.println("[MQTT] No local IP yet.");
        return;
    }

    if (!mqtt_.connected()) {
        Serial.printf("[MQTT] Connecting to %s:%u as %s…\n", brokerHost_.c_str(), brokerPort_, clientId_.c_str());
        mqtt_.setClientId(clientId_.c_str());
        mqtt_.setAutoReconnect(true);
        mqtt_.connect(); // async, non-blocking
    }
}

void MQTTPlugin::onConnected() {
    // Birth: retained "online"
    mqtt_.publish(statusTopic_.c_str(), /*qos=*/1, /*retain=*/true, "online");
    lastAnyPublishMs_ = millis();

    subscribeHAStatusOnce(); // re-announce on HA restart
    publishDiscovery(ctrl_); // retained discovery at chosen prefix
}

void MQTTPlugin::onDisconnected() {
    // Auto-reconnect is enabled by setAutoReconnect(true)
}

void MQTTPlugin::subscribeHAStatusOnce() {
    if (haStatusSubscribed_)
        return;
    haStatusSubscribed_ = true;

    mqtt_.onTopic("homeassistant/status", /*qos=*/1,
                  [this](const char * /*topic*/, const char *payload, int /*retain*/, int /*qos*/, bool /*dup*/) {
                      if (strcmp(payload, "online") == 0) {
                          // Re-announce availability (retained)
                          mqtt_.publish(statusTopic_.c_str(), /*qos=*/1, /*retain=*/true, "online");
                          if (ctrl_)
                              publishDiscovery(ctrl_);
                          lastAnyPublishMs_ = millis();
                      }
                  });
}

// ---- HA discovery & publishing ----
void MQTTPlugin::publishDiscovery(Controller *controller) {
    if (!mqtt_.connected())
        return;

    // Device metadata
    const String devName = "GaggiMate";
    const String mf = "GaggiMate";
    const String mdl = "GaggiMate";
    const String swv = controller->getSystemInfo().version;
    const String hwv = controller->getSystemInfo().hardware;

    auto attachDevice = [&](JsonDocument &d) {
        JsonObject device = d["device"].to<JsonObject>();
        JsonArray identifiers = device["identifiers"].to<JsonArray>();
        identifiers.add(clientId_);
        device["name"] = devName;
        device["manufacturer"] = mf;
        device["model"] = mdl;
        device["sw_version"] = swv;
        device["hw_version"] = hwv;

        d["availability_topic"] = statusTopic_;
        d["payload_available"] = "online";
        d["payload_not_available"] = "offline";
    };

    // sensor: Boiler Temperature
    {
        JsonDocument d;
        d["name"] = "Boiler Temperature";
        d["unique_id"] = clientId_ + String("_boiler0_temp");
        d["state_topic"] = baseTopic_ + "boilers/0/temperature";
        d["value_template"] = "{{ value_json.temperature | round(2) }}";
        d["device_class"] = "temperature";
        d["unit_of_measurement"] = "°C";
        d["state_class"] = "measurement";
        attachDevice(d);
        publishConfigJson(mqtt_, discoveryPrefix_ + "/sensor/" + clientId_ + "_boiler0_temp/config", d);
    }

    // sensor: Boiler Target Temperature
    {
        JsonDocument d;
        d["name"] = "Boiler Target Temperature";
        d["unique_id"] = clientId_ + String("_boiler0_target_temp");
        d["state_topic"] = baseTopic_ + "boilers/0/targetTemperature";
        d["value_template"] = "{{ value_json.temperature | round(2) }}";
        d["device_class"] = "temperature";
        d["unit_of_measurement"] = "°C";
        attachDevice(d);
        publishConfigJson(mqtt_, discoveryPrefix_ + "/sensor/" + clientId_ + "_boiler0_target_temp/config", d);
    }

    // sensor: Boiler Pressure (ONLY if present)
    if (hasPressure_) {
        JsonDocument d;
        d["name"] = "Boiler Pressure";
        d["unique_id"] = clientId_ + String("_boiler0_pressure");
        d["state_topic"] = baseTopic_ + "boilers/0/pressure";
        d["value_template"] = "{{ value_json.pressure | round(2) }}";
        d["device_class"] = "pressure";
        d["unit_of_measurement"] = "bar";
        d["state_class"] = "measurement";
        attachDevice(d);
        publishConfigJson(mqtt_, discoveryPrefix_ + "/sensor/" + clientId_ + "_boiler0_pressure/config", d);
    } else {
        // Clear any stale retained discovery from past Pro runs
        const String topic = discoveryPrefix_ + "/sensor/" + clientId_ + "_boiler0_pressure/config";
        mqtt_.publish(topic.c_str(), /*qos=*/1, /*retain=*/true, "");
    }

    // sensor: Mode (string)
    {
        JsonDocument d;
        d["name"] = "Mode";
        d["unique_id"] = clientId_ + String("_mode");
        d["state_topic"] = baseTopic_ + "controller/mode";
        d["value_template"] = "{{ value_json.mode_str }}";
        attachDevice(d);
        publishConfigJson(mqtt_, discoveryPrefix_ + "/sensor/" + clientId_ + "_mode/config", d);
    }

    // sensor: Brew State (string + attrs)
    {
        JsonDocument d;
        d["name"] = "Brew State";
        d["unique_id"] = clientId_ + String("_brew_state");
        d["state_topic"] = baseTopic_ + "controller/brew/state";
        d["value_template"] = "{{ value_json.state }}";
        d["json_attributes_topic"] = baseTopic_ + "controller/brew/state";
        attachDevice(d);
        publishConfigJson(mqtt_, discoveryPrefix_ + "/sensor/" + clientId_ + "_brew_state/config", d);
    }

    // binary_sensor: Brewing (on/off)
    {
        JsonDocument d;
        d["name"] = "Brewing";
        d["unique_id"] = clientId_ + String("_brewing");
        d["state_topic"] = baseTopic_ + "controller/brew/state";
        d["value_template"] = "{{ value_json.state }}";
        d["payload_on"] = "brewing";
        d["payload_off"] = "not brewing";
        attachDevice(d);
        publishConfigJson(mqtt_, discoveryPrefix_ + "/binary_sensor/" + clientId_ + "_brewing/config", d);
    }
}

void MQTTPlugin::publish(const char *relativeTopic, const char *json, int qos, bool retain) {
    if (!mqtt_.connected())
        return;
    String full = baseTopic_ + relativeTopic;
    mqtt_.publish(full.c_str(), qos, retain, json);
    lastAnyPublishMs_ = millis();
}

void MQTTPlugin::publishBrewState(const char *state) {
    if (!mqtt_.connected())
        return;
    char json[128];
    std::time_t now = std::time(nullptr);
    snprintf(json, sizeof(json), R"({"state":"%s","timestamp":%ld})", state, (long)now);
    publish("controller/brew/state", json, /*qos=*/1, /*retain=*/false);
}
