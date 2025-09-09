#ifndef WEBUIPLUGIN_H
#define WEBUIPLUGIN_H

#define ELEGANTOTA_USE_ASYNC_WEBSERVER 1

#include <DNSServer.h>

#include "../core/Plugin.h"
#include "GitHubOTA.h"
#include "ShotHistoryPlugin.h"
#include <ArduinoJson.h>
#include <AsyncJson.h>
#include <ESPAsyncWebServer.h>
#include <vector>
#include <unordered_map>

constexpr size_t UPDATE_CHECK_INTERVAL = 5 * 60 * 1000;
constexpr size_t CLEANUP_PERIOD = 5 * 1000;
constexpr size_t STATUS_PERIOD = 500;
constexpr size_t DNS_PERIOD = 10;
constexpr size_t HEARTBEAT_PERIOD = 30 * 1000;  // 30 seconds
constexpr size_t CLIENT_TIMEOUT = 60 * 1000;    // 60 seconds

const String LOCAL_URL = "http://4.4.4.1/";
const String RELEASE_URL = "https://github.com/jniebuhr/gaggimate/releases/";

class ProfileManager;

// Status cache structure for delta updates
struct StatusCache {
    float currentTemp = -999;
    float targetTemp = -999;
    float currentPressure = -999;
    float targetPressure = -999;
    float currentFlow = -999;
    uint8_t mode = 255;
    String selectedProfile = "";
    bool brewTarget = false;
    bool volumetricAvailable = false;
    bool connected = false;
    bool processActive = false;
    String processState = "";
    String processLabel = "";
    unsigned long processElapsed = 0;
    String processTargetType = "";
    float processTarget = -999;
    float processProgress = -999;
    bool capabilityPressure = false;
    bool capabilityDimming = false;
    bool capabilityLedControl = false;
};

class WebUIPlugin : public Plugin {
  public:
    WebUIPlugin();
    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override;

  private:
    void setupServer();
    void start();
    void stop();

    // Websocket handlers
    void handleWebSocketData(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data,
                             size_t len);
    void handleOTASettings(uint32_t clientId, JsonDocument &request);
    void handleOTAStart(uint32_t clientId, JsonDocument &request);
    void handleAutotuneStart(uint32_t clientId, JsonDocument &request);
    void handleProfileRequest(uint32_t clientId, JsonDocument &request);
    void handleFlushStart(uint32_t clientId, JsonDocument &request);
    void sendHeartbeat();
    void checkClientTimeouts();
    void sendStatusUpdate();
    void sendFullStatus();
    bool hasStatusChanged(const StatusCache& newStatus) const;

    // HTTP handlers
    void handleSettings(AsyncWebServerRequest *request) const;
    void handleBLEScaleList(AsyncWebServerRequest *request);
    void handleBLEScaleScan(AsyncWebServerRequest *request);
    void handleBLEScaleConnect(AsyncWebServerRequest *request);
    void handleBLEScaleInfo(AsyncWebServerRequest *request);
    void updateOTAStatus(const String &version);
    void updateOTAProgress(uint8_t phase, int progress);
    void sendAutotuneResult();

    GitHubOTA *ota = nullptr;
    AsyncWebServer server;
    AsyncWebSocket ws;
    Controller *controller = nullptr;
    PluginManager *pluginManager = nullptr;
    DNSServer *dnsServer = nullptr;
    ProfileManager *profileManager = nullptr;

    long lastUpdateCheck = 0;
    long lastStatus = 0;
    long lastCleanup = 0;
    long lastDns = 0;
    long lastHeartbeat = 0;
    std::unordered_map<uint32_t, long> clientLastSeen;
    
    // Delta update tracking
    StatusCache lastSentStatus;
    
    bool updating = false;
    bool apMode = false;
    bool serverRunning = false;
    String updateComponent = "";
};

#endif // WEBUIPLUGIN_H
