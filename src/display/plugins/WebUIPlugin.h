#ifndef WEBUIPLUGIN_H
#define WEBUIPLUGIN_H

#define ELEGANTOTA_USE_ASYNC_WEBSERVER 1

#include <DNSServer.h>
#include <WebSocketsClient.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>

#include "GitHubOTA.h"
#include <ArduinoJson.h>
#include <ESPAsyncWebServer.h>
#include <display/core/Plugin.h>
#include <vector>

constexpr uint32_t RELAY_CLIENT_ID = 0xFFFFFFFE;

constexpr size_t UPDATE_CHECK_INTERVAL = 5 * 60 * 1000;
constexpr size_t CLEANUP_PERIOD = 5 * 1000;
constexpr size_t STATUS_PERIOD = 500;
constexpr size_t DNS_PERIOD = 10;

const String LOCAL_URL = "http://4.4.4.1/";
const String RELEASE_URL = "https://github.com/carloshrdezc/gaggimate/releases/";

class ProfileManager;
class BeanManager;

class WebUIPlugin : public Plugin {
  public:
    WebUIPlugin();
    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override;

  private:
    void setupServer();
    void start();
    void stop();
    void addCorsHeaders(AsyncWebServerResponse *response) const;
    void handleOptions(AsyncWebServerRequest *request) const;

    // Cloud relay
    void startRelay();
    void stopRelay();
    void broadcastAll(const String &msg);
    void broadcastRelayMsg(const String &msg); // thread-safe relay-only send
    void sendResponse(uint32_t clientId, JsonDocument &response);
    void processWebSocketMessage(uint32_t clientId, const String &msg);

    // Websocket handlers
    void handleWebSocketData(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data,
                             size_t len);
    void handleOTASettings(uint32_t clientId, JsonDocument &request);
    void handleOTAStart(uint32_t clientId, JsonDocument &request);
    void handleAutotuneStart(uint32_t clientId, JsonDocument &request);
    void handleBeanRequest(uint32_t clientId, JsonDocument &request);
    void handleProfileRequest(uint32_t clientId, JsonDocument &request);
    void handleFlushStart(uint32_t clientId, JsonDocument &request);

    // HTTP handlers
    void handleSettings(AsyncWebServerRequest *request);
    void handleBLEScaleList(AsyncWebServerRequest *request);
    void handleBLEScaleScan(AsyncWebServerRequest *request);
    void handleBLEScaleConnect(AsyncWebServerRequest *request);
    void handleBLEScaleInfo(AsyncWebServerRequest *request);
    void updateOTAStatus(const String &version);
    void updateOTAProgress(uint8_t phase, int progress);
    void sendAutotuneResult();

    // Core dump download
    void handleCoreDumpDownload(AsyncWebServerRequest *request);

    GitHubOTA *ota = nullptr;
    AsyncWebServer server;
    AsyncWebSocket ws;
    WebSocketsClient relayWs;
    Controller *controller = nullptr;
    PluginManager *pluginManager = nullptr;
    DNSServer *dnsServer = nullptr;
    BeanManager *beanManager = nullptr;
    ProfileManager *profileManager = nullptr;

    // Relay state
    SemaphoreHandle_t relayMutex = nullptr;
    std::vector<String> relayOutBuffer;
    volatile bool relayEnabled = false;
    volatile bool relayConnected = false;
    TaskHandle_t relayTaskHandle = nullptr;
    static void relayLoopTask(void *arg);

    long lastUpdateCheck = 0;
    long lastStatus = 0;
    long lastCleanup = 0;
    long lastDns = 0;
    bool updating = false;
    bool apMode = false;
    bool serverRunning = false;
    String updateComponent = "";
    float currentBluetoothWeight = 0.0f;
};

#endif // WEBUIPLUGIN_H
