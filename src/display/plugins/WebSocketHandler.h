#ifndef WEBSOCKETHANDLER_H
#define WEBSOCKETHANDLER_H

#include <ArduinoJson.h>
#include <ESPAsyncWebServer.h>
#include <display/util/PsramAllocator.h>
#include <functional>

constexpr size_t STATUS_PERIOD = 500;
constexpr size_t STATE_RESEND_PERIOD = 10000; // full slow-state resend even without changes
constexpr size_t CLEANUP_PERIOD = 1000;

class Controller;
class PluginManager;
class ProfileManager;

// Owns the /ws endpoint: request dispatch, status publishing, and forwarding plugin events to browsers.
class WebSocketHandler {
  public:
    using RequestHandler = std::function<void(JsonDocument &request)>;

    WebSocketHandler();
    void setup(Controller *controller, PluginManager *pluginManager);
    void attach(AsyncWebServer &server);
    void loop(unsigned long now);

    void cleanupClients() { ws.cleanupClients(); }
    void closeAll() { ws.closeAll(); }
    bool hasClients() { return !ws.getClients().empty(); }
    void broadcastJson(JsonDocument &doc);

    // OTA is driven by WebUIPlugin; the two OTA requests are routed back to it.
    void onOtaSettings(RequestHandler handler) { otaSettingsHandler = std::move(handler); }
    void onOtaStart(RequestHandler handler) { otaStartHandler = std::move(handler); }
    void setUpdateAvailableProvider(std::function<bool()> provider) { updateAvailableProvider = std::move(provider); }

  private:
    void handleWebSocketData(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data,
                             size_t len);
    void handleAutotuneStart(uint32_t clientId, JsonDocument &request);
    void handleProfileRequest(uint32_t clientId, JsonDocument &request);
    void handleFlushStart(uint32_t clientId, JsonDocument &request);
    void publishState(unsigned long now);
    void publishTelemetry();
    void sendAutotuneResult();
    void sendAutotuneFailed();

    AsyncWebSocket ws;
    Controller *controller = nullptr;
    PluginManager *pluginManager = nullptr;
    ProfileManager *profileManager = nullptr;
    RequestHandler otaSettingsHandler;
    RequestHandler otaStartHandler;
    std::function<bool()> updateAvailableProvider; // OTA state for the `up` status field

    long lastStatus = 0;
    long lastStateSent = 0;
    long lastCleanup = 0;
    AsyncWebSocketSharedBuffer lastStateBuffer; // last slow-state frame, replayed to new clients
    float currentBluetoothWeight = 0.0f;
    // Reused for every 500ms status broadcast. Allocating a fresh JsonDocument
    // each tick was a major contributor to internal-heap fragmentation
    // (device reports 33%+ fragmentation, causing AsyncTCP buffer allocs to
    // stall mid-asset-serve). Keeping one doc lets its underlying pool grow
    // once and stay put.
    JsonDocument statusDoc{&psramAllocator};
};

#endif // WEBSOCKETHANDLER_H
