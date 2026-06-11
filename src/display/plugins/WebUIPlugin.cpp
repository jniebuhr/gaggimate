#include "WebUIPlugin.h"
#include <DNSServer.h>
#include <SPIFFS.h>
#include <display/core/Controller.h>
#include <display/core/ProfileManager.h>
#include <display/core/process/BrewProcess.h>
#include <display/core/process/GrindProcess.h>
#include <display/models/profile.h>
#include <esp_core_dump.h>
#include <esp_err.h>
#include <esp_partition.h>
#include <esp_system.h>

#include <SD_MMC.h>
#include <algorithm>
#include <display/plugins/BLEScalePlugin.h>
#include <display/plugins/ShotHistoryPlugin.h>
#include <string>
#include <unordered_map>
#include <vector>
#include <version.h>

static std::unordered_map<uint32_t, std::string> rxBuffers;
static WebUIPlugin *g_webUIPlugin = nullptr;

WebUIPlugin::WebUIPlugin() : server(80), ws("/ws") { g_webUIPlugin = this; }

void WebUIPlugin::setup(Controller *_controller, PluginManager *_pluginManager) {
    this->controller = _controller;
    this->profileManager = _controller->getProfileManager();
    this->pluginManager = _pluginManager;
    this->ota = new GitHubOTA(
        BUILD_GIT_VERSION, controller->getSystemInfo().version,
        RELEASE_URL + (controller->getSettings().getOTAChannel() == "latest" ? "latest" : "tag/nightly"),
        [this](uint8_t phase) {
            pluginManager->trigger("ota:update:phase", "phase", phase);
            updateOTAProgress(phase, 0);
        },
        [this](uint8_t phase, int progress) {
            pluginManager->trigger("ota:update:progress", "progress", progress);
            updateOTAProgress(phase, progress);
        },
        "display-firmware.bin", "display-filesystem.bin", "board-firmware.bin");
    pluginManager->on("controller:wifi:connect", [this](Event const &event) {
        apMode = event.getInt("AP");
        start();
    });
    pluginManager->on("controller:wifi:disconnect", [this](Event const &) { stop(); });
    pluginManager->on("controller:ready", [this](Event const &) {
        ota->setControllerVersion(controller->getSystemInfo().version);
        ota->init(controller->getClientController()->getClient());
    });
    pluginManager->on("controller:autotune:result", [this](Event const &event) { sendAutotuneResult(); });

    // Forward shot history rebuild progress events to WebSocket clients
    pluginManager->on("evt:history-rebuild-progress", [this](Event const &event) {
        JsonDocument doc;
        doc["tp"] = "evt:history-rebuild-progress";
        doc["total"] = event.getInt("total");
        doc["current"] = event.getInt("current");
        doc["status"] = event.getString("status");
        ws.textAll(doc.as<String>());
    });

    // Subscribe to Bluetooth scale weight updates
    pluginManager->on("controller:volumetric-measurement:bluetooth:change",
                      [this](Event const &event) { this->currentBluetoothWeight = event.getFloat("value"); });

    setupServer();
}

void WebUIPlugin::loop() {
    if (updating) {
        pluginManager->trigger("ota:update:start");
        ota->update(updateComponent != "display", updateComponent != "controller");
        pluginManager->trigger("ota:update:end");
        updating = false;
    }
    if (!serverRunning) {
        return;
    }
    const long now = millis();
    if ((lastUpdateCheck == 0 || now > lastUpdateCheck + UPDATE_CHECK_INTERVAL)) {
        ota->checkForUpdates();
        pluginManager->trigger("ota:update:status", "value", ota->isUpdateAvailable());
        lastUpdateCheck = now;
        updateOTAStatus(ota->getCurrentVersion());
    }
    if (now > lastStatus + STATUS_PERIOD && !ws.getClients().empty()) {
        lastStatus = now;
        JsonDocument doc;
        doc["tp"] = "evt:status";
        doc["ct"] = controller->getCurrentTemp();
        doc["tt"] = controller->getTargetTemp();
        doc["pr"] = controller->getCurrentPressure();
        doc["fl"] = controller->getCurrentPumpFlow();
        doc["pt"] = controller->getTargetPressure();
        doc["m"] = controller->getMode();
        doc["p"] = controller->getProfileManager()->getSelectedProfile().label;
        doc["puid"] = controller->getProfileManager()->getSelectedProfile().id;
        doc["cp"] = controller->getSystemInfo().capabilities.pressure;
        doc["cd"] = controller->getSystemInfo().capabilities.dimming;
        doc["tw"] = profileManager->getSelectedProfile().getTotalVolume(); // total target weight for the process
        doc["bta"] = controller->isVolumetricAvailable() ? 1 : 0;
        doc["bt"] =
            controller->isVolumetricAvailable() && controller->getProfileManager()->getSelectedProfile().isVolumetric() ? 1 : 0;
        doc["btd"] = profileManager->getSelectedProfile().getTotalDuration();
        doc["led"] = controller->getSystemInfo().capabilities.ledControl;
        doc["gtd"] = controller->getTargetGrindDuration();
        doc["gtv"] = controller->getSettings().getTargetGrindVolume();
        doc["gt"] = controller->isVolumetricAvailable() && controller->getSettings().isVolumetricTarget() ? 1 : 0;
        doc["gact"] = controller->isGrindActive() ? 1 : 0;
        doc["wl"] = controller->getWaterLevel();
        doc["tof"] = controller->getTofDistance();
        doc["rssi"] = 0;

        if (controller->getClientController()->getClient()->isConnected()) {
            doc["rssi"] = controller->getClientController()->getClient()->getRssi();
        }

        bool bleConnected = BLEScales.isConnected();
        // Add Bluetooth scale weight information
        doc["bw"] = bleConnected ? this->currentBluetoothWeight : 0; // current bluetooth weight
        doc["cw"] = bleConnected ? this->currentBluetoothWeight : 0; // Use 'currentWeight' for forward compatbility
        doc["bc"] = bleConnected;                                    // bluetooth scale connected status
        // Scale battery — only surfaced when the driver reports one and the
        // value isn't the UNKNOWN sentinel (255). UI omits the battery pill
        // entirely when `sbat` is absent, so disconnected/unknown scales don't
        // render a stale stub.
        if (bleConnected && BLEScales.hasBatteryLevel()) {
            const uint8_t pct = BLEScales.getBatteryLevel();
            if (pct != REMOTE_SCALES_BATTERY_UNKNOWN) {
                doc["sbat"] = pct;
            }
        }

        Process *process = controller->getProcess();
        if (process == nullptr) {
            process = controller->getLastProcess();
        }
        if (process != nullptr) {
            auto pObj = doc["process"].to<JsonObject>();
            pObj["a"] = controller->isActive() ? 1 : 0;
            if (process->getType() == MODE_BREW) {
                auto *brew = static_cast<BrewProcess *>(process);
                unsigned long ts = brew->isActive() && controller->isActive() ? millis() : brew->finished;
                pObj["s"] = brew->currentPhase.phase == PhaseType::PHASE_TYPE_BREW ? "brew" : "infusion";
                pObj["l"] = brew->isActive() ? brew->currentPhase.name.c_str() : "Finished";
                pObj["e"] = ts - brew->processStarted;
                const bool isVolumetric = brew->target == ProcessTarget::VOLUMETRIC && brew->currentPhase.hasVolumetricTarget() &&
                                          controller->isVolumetricAvailable();
                pObj["tt"] = isVolumetric ? "volumetric" : "time";
                if (isVolumetric) {
                    Target t = brew->currentPhase.getVolumetricTarget();
                    pObj["pt"] = t.value;
                    pObj["pp"] = brew->currentVolume;
                } else {
                    pObj["pt"] = brew->getPhaseDuration();
                    pObj["pp"] = ts - brew->currentPhaseStarted;
                }
            } else if (process->getType() == MODE_GRIND) {
                auto *grind = static_cast<GrindProcess *>(process);
                unsigned long ts = grind->isActive() && controller->isActive() ? millis() : grind->finished;
                pObj["s"] = "grind";
                pObj["l"] = grind->isActive() ? "Grinding" : "Finished";
                pObj["e"] = ts - grind->started;
                const bool isVolumetric = grind->target == ProcessTarget::VOLUMETRIC && controller->isVolumetricAvailable();
                pObj["tt"] = isVolumetric ? "volumetric" : "time";
                if (isVolumetric) {
                    pObj["pt"] = grind->grindVolume;
                    pObj["pp"] = grind->currentVolume;
                } else {
                    pObj["pt"] = grind->time;
                    pObj["pp"] = ts - grind->started;
                }
            }
        }

        ws.textAll(doc.as<String>());
    }
    if (now > lastCleanup + CLEANUP_PERIOD) {
        lastCleanup = now;
        ws.cleanupClients();
    }
    if (now > lastDns + DNS_PERIOD && dnsServer != nullptr) {
        lastDns = now;
        dnsServer->processNextRequest();
    }
}

void WebUIPlugin::setupServer() {
    server.on("/connecttest.txt", [](AsyncWebServerRequest *request) {
        request->redirect("http://logout.net");
    }); // windows 11 captive portal workaround
    server.on("/wpad.dat", [](AsyncWebServerRequest *request) {
        request->send(404);
    }); // Honestly don't understand what this is but a 404 stops win 10 keep calling this repeatedly and panicking the esp32
        // :)
    server.on("/generate_204",
              [](AsyncWebServerRequest *request) { request->redirect(LOCAL_URL); }); // android captive portal redirect
    server.on("/redirect", [](AsyncWebServerRequest *request) { request->redirect(LOCAL_URL); });            // microsoft redirect
    server.on("/hotspot-detect.html", [](AsyncWebServerRequest *request) { request->redirect(LOCAL_URL); }); // apple call home
    server.on("/canonical.html",
              [](AsyncWebServerRequest *request) { request->redirect(LOCAL_URL); });       // firefox captive portal call home
    server.on("/success.txt", [](AsyncWebServerRequest *request) { request->send(200); }); // firefox captive portal call home
    server.on("/ncsi.txt", [](AsyncWebServerRequest *request) { request->redirect(LOCAL_URL); }); // windows call home
    server.on("/api/settings", [this](AsyncWebServerRequest *request) { handleSettings(request); });
    server.on("/api/status", HTTP_GET, [this](AsyncWebServerRequest *request) {
        AsyncResponseStream *response = request->beginResponseStream("application/json");
        response->addHeader("Access-Control-Allow-Origin", "https://tyrlabsos.github.io");
        response->addHeader("Vary", "Origin");
        JsonDocument doc;
        doc["mode"] = controller->getMode();
        doc["tt"] = controller->getTargetTemp();
        doc["ct"] = controller->getCurrentTemp();
        serializeJson(doc, *response);
        request->send(response);
    });
    server.on("/api/scales/list", [this](AsyncWebServerRequest *request) { handleBLEScaleList(request); });
    server.on("/api/scales/connect", [this](AsyncWebServerRequest *request) { handleBLEScaleConnect(request); });
    server.on("/api/scales/scan", [this](AsyncWebServerRequest *request) { handleBLEScaleScan(request); });
    server.on("/api/scales/info", [this](AsyncWebServerRequest *request) { handleBLEScaleInfo(request); });
    FS *fs = &SPIFFS;
    if (controller->isSDCard()) {
        fs = &SD_MMC;
    }
    server.serveStatic("/api/history/", *fs, "/h/").setCacheControl("no-store");
    server.on("/api/history/index.bin", HTTP_GET, [this, fs](AsyncWebServerRequest *request) {
        // Serve the binary index file directly
        if (fs->exists("/h/index.bin")) {
            request->send(*fs, "/h/index.bin", "application/octet-stream");
        } else {
            request->send(404, "text/plain", "Index not found");
        }
    });
    server.on("/api/core-dump", HTTP_GET, [this](AsyncWebServerRequest *request) { handleCoreDumpDownload(request); });
    server.onNotFound([](AsyncWebServerRequest *request) { request->send(SPIFFS, "/w/index.html"); });
    server.serveStatic("/", SPIFFS, "/w").setDefaultFile("index.html").setCacheControl("max-age=0");
    ws.onEvent(
        [this](AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len) {
            if (type == WS_EVT_CONNECT) {
                client->setCloseClientOnQueueFull(true);
                ESP_LOGI("WebUIPlugin", "WebSocket client connected (%d open connections)", server->getClients().size());
            } else if (type == WS_EVT_DISCONNECT) {
                ESP_LOGI("WebUIPlugin", "WebSocket client disconnected (%d open connections)", server->getClients().size());
                rxBuffers.erase(client->id());
            } else if (type == WS_EVT_DATA) {
                handleWebSocketData(server, client, type, arg, data, len);
            }
        });
    server.addHandler(&ws);
}

void WebUIPlugin::start() {
    stop();
    server.begin();
    ESP_LOGI("WebUIPlugin", "Started webserver");
    if (apMode) {
        dnsServer = new DNSServer();
        dnsServer->setTTL(3600);
        dnsServer->start(53, "*", WIFI_AP_IP);
        ESP_LOGI("WebUIPlugin", "Started catchall DNS for captive portal");
