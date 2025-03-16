#ifndef WEBUIPLUGIN_H
#define WEBUIPLUGIN_H

#define ELEGANTOTA_USE_ASYNC_WEBSERVER 1

#include <DNSServer.h>

#include "../core/Plugin.h"
#include "GitHubOTA.h"
#include <ESPAsyncWebServer.h>

constexpr size_t UPDATE_CHECK_INTERVAL = 5 * 60 * 1000;
constexpr size_t CLEANUP_PERIOD = 30 * 1000;
constexpr size_t STATUS_PERIOD = 1000;

const String RELEASE_URL = "https://github.com/jniebuhr/gaggimate/releases/";

class WebUIPlugin : public Plugin {
  public:
    WebUIPlugin();
    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override;

  private:
    void start(bool apMode);

    void handleOTA(AsyncWebServerRequest *request);
    void handleSettings(AsyncWebServerRequest *request);
    void handleBLEScaleList(AsyncWebServerRequest *request);
    void handleBLEScaleScan(AsyncWebServerRequest *request);
    void handleBLEScaleConnect(AsyncWebServerRequest *request);
    void handleBLEScaleInfo(AsyncWebServerRequest *request);

    GitHubOTA *ota = nullptr;
    AsyncWebServer server;
    AsyncWebSocket ws;
    Controller *controller = nullptr;
    PluginManager *pluginManager = nullptr;
    DNSServer *dnsServer = nullptr;

    long lastUpdateCheck = 0;
    long lastStatus = 0;
    long lastCleanup = 0;
    bool updating = false;
};

#endif // WEBUIPLUGIN_H
