#ifndef MQTTPLUGIN_H
#define MQTTPLUGIN_H

#include "../core/Plugin.h"
#include <PsychicMqttClient.h>
#include <WiFi.h>

// Debounce for current temperature (QoS 0)
constexpr uint32_t TEMP_MIN_INTERVAL_MS = 300;
constexpr float TEMP_MIN_DELTA_C = 0.10f;

// Debounce for current pressure (QoS 0)
constexpr uint32_t PRESSURE_MIN_INTERVAL_MS = 300;
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
