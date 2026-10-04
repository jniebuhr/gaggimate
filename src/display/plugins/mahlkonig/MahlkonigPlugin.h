#ifndef MAHLKONIGPLUGIN_H
#define MAHLKONIGPLUGIN_H

#include <Arduino.h>
#include <ArduinoJson.h>
#include <display/core/Plugin.h>
#include <mutex>

class AsyncWebServer;
class AsyncWebServerRequest;
class WebSocketHandler;

// Lets a Mahlkönig E64 WS treat GaggiMate as its Grind-by-Sync espresso machine
class MahlkonigPlugin : public Plugin {
  public:
    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override;

  private:
    // SETTLING: brew ended, still reported as brewing until the scale weight is final
    enum class Phase { IDLE, BREWING, SETTLING, FINISHING };

    void registerRoutes(AsyncWebServer *server);
    void registerWsHandlers(WebSocketHandler *ws);

    void handleIdentity(AsyncWebServerRequest *request);
    void handleStatus(AsyncWebServerRequest *request);
    void handleBrewRatioBody(const uint8_t *data, size_t len);
    void handleExecuteBody(const uint8_t *data, size_t len);
    static void sendJson(AsyncWebServerRequest *request, JsonDocument &doc);

    void onBrewStart();
    void onBrewEnd();

    void startRequestedBrew();
    void selectRecipeProfile(const String &profileId);
    void applyTargetWeight(float weight);
    void finishShot(unsigned long now);
    String recipeProfile(int recipe) const;
    const char *phaseName() const;

    Controller *controller = nullptr;
    PluginManager *pluginManager = nullptr;

    // Shared between the AsyncTCP task, the event emitters and loop()
    std::mutex mutex;
    Phase phase = Phase::IDLE;
    bool shotIsGrinderStarted = false;
    unsigned long brewStartedAt = 0;
    unsigned long phaseSince = 0;
    uint32_t extractionMs = 0;
    float shotWeight = 0.0f;
    float lastScaleWeight = 0.0f;
    uint32_t savedShotId = 0;

    bool startRequested = false;
    unsigned long startRequestedAt = 0;
    float pendingTargetWeight = 0.0f;
    String pendingProfileId;
    float recipeWeight = 0.0f;
    int grindRecipe = 0;
    String grindProfileId;
    unsigned long lastPollAt = 0;

    // Accumulates chunked POST bodies; requests from AsyncTCP are handled one at a time
    String bodyBuffer;
};

#endif // MAHLKONIGPLUGIN_H
