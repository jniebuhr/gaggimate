#include "WebUIPlugin.h"
#include <DNSServer.h>
#include <SPIFFS.h>
#include <esp_system.h>
#include <esp_core_dump.h>
#include <esp_debug_helpers.h>
#include <esp_err.h>
#include <esp_log.h>
#include <esp_partition.h>
#include <display/core/Controller.h>
#include <display/core/ProfileManager.h>
#include <display/core/process/BrewProcess.h>
#include <display/models/profile.h>

#include "BLEScalePlugin.h"
#include "ShotHistoryPlugin.h"
#include <algorithm>
#include <string>
#include <unordered_map>
#include <vector>
static std::unordered_map<uint32_t, std::string> rxBuffers;
static WebUIPlugin* g_webUIPlugin = nullptr;

WebUIPlugin::WebUIPlugin() : server(80), ws("/ws") {
    g_webUIPlugin = this;
    setupCrashHandler();
}

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
    setupServer();
    
    // Check for crash on startup
    checkForCrashOnStartup();
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
    if (now > lastStatus + STATUS_PERIOD) {
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
        doc["cp"] = controller->getSystemInfo().capabilities.pressure;
        doc["cd"] = controller->getSystemInfo().capabilities.dimming;
        doc["bta"] = controller->isVolumetricAvailable() ? 1 : 0;
        doc["bt"] = controller->isVolumetricAvailable() && controller->getSettings().isVolumetricTarget() ? 1 : 0;
        doc["led"] = controller->getSystemInfo().capabilities.ledControl;

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
    server.on("/api/status", [this](AsyncWebServerRequest *request) {
        AsyncResponseStream *response = request->beginResponseStream("application/json");
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
    server.on("/api/crash-log", HTTP_GET, [this](AsyncWebServerRequest *request) { handleCrashLogDownload(request); });
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
    }
    lastUpdateCheck = millis();
    serverRunning = true;
}

void WebUIPlugin::stop() {
    if (!serverRunning)
        return;
    server.end();
    ws.closeAll();
    if (dnsServer != nullptr) {
        dnsServer->stop();
        delete dnsServer;
        dnsServer = nullptr;
    }
    serverRunning = false;
}

void WebUIPlugin::handleWebSocketData(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg,
                                      uint8_t *data, size_t len) {

    auto *info = static_cast<AwsFrameInfo *>(arg);
    const uint32_t cid = client->id();

    if (info->index == 0) {
        auto &buf = rxBuffers[cid];
        buf.clear();
        if (info->len <= 64 * 1024) {
            buf.reserve(info->len);
        }
    }

    auto &buf = rxBuffers[cid];
    buf.append(reinterpret_cast<const char *>(data), len);
    const bool isFinal = info->final && (info->index + len) == info->len;

    // If this is the final frame of the message, process and clear
    if (isFinal) {
        if (info->opcode == WS_TEXT) {
            ESP_LOGV("WebUIPlugin", "Received request: %.*s", (int)buf.size(), buf.c_str());
            JsonDocument doc;
            DeserializationError err = deserializeJson(doc, buf.c_str());
            if (!err) {
                String msgType = doc["tp"].as<String>();
                if (msgType.startsWith("req:profiles:")) {
                    handleProfileRequest(client->id(), doc);
                } else if (msgType == "req:ota-settings") {
                    handleOTASettings(client->id(), doc);
                } else if (msgType == "req:ota-start") {
                    handleOTAStart(client->id(), doc);
                } else if (msgType == "req:autotune-start") {
                    handleAutotuneStart(client->id(), doc);
                } else if (msgType == "req:process:activate") {
                    controller->activate();
                } else if (msgType == "req:process:deactivate") {
                    controller->deactivate();
                    controller->clear();
                } else if (msgType == "req:process:clear") {
                    controller->clear();
                } else if (msgType == "req:change-mode") {
                    if (doc["mode"].is<uint8_t>()) {
                        auto mode = doc["mode"].as<uint8_t>();
                        controller->deactivate();
                        controller->clear();
                        controller->setMode(mode);
                    }
                } else if (msgType == "req:change-brew-target") {
                    if (doc["target"].is<uint8_t>()) {
                        auto target = doc["target"].as<uint8_t>();
                        controller->getSettings().setVolumetricTarget(target);
                    }
                } else if (msgType.startsWith("req:history")) {
                    JsonDocument resp;
                    ShotHistory.handleRequest(doc, resp);
                    size_t bufferSize = measureJson(resp);
                    auto *buffer = ws.makeBuffer(bufferSize);
                    serializeJson(resp, buffer->get(), bufferSize);
                    client->text(buffer);
                } else if (msgType == "req:flush:start") {
                    handleFlushStart(client->id(), doc);
                }
            }
        }
        // Done with this message
        rxBuffers.erase(cid);
    }
}

void WebUIPlugin::handleOTASettings(uint32_t clientId, JsonDocument &request) {
    if (request["update"].as<bool>()) {
        if (!request["channel"].isNull()) {
            controller->getSettings().setOTAChannel(request["channel"].as<String>() == "latest" ? "latest" : "nightly");
            ota->setReleaseUrl(RELEASE_URL + (controller->getSettings().getOTAChannel() == "latest" ? "latest" : "tag/nightly"));
            lastUpdateCheck = 0;
        }
    }
    updateOTAStatus("Checking...");
}

void WebUIPlugin::handleOTAStart(uint32_t clientId, JsonDocument &request) {
    updating = true;
    if (request["cp"].is<String>()) {
        updateComponent = request["cp"].as<String>();
    } else {
        updateComponent = "";
    }
}

void WebUIPlugin::handleAutotuneStart(uint32_t clientId, JsonDocument &request) {
    int testTime = request["time"].as<int>();
    int samples = request["samples"].as<int>();
    controller->autotune(testTime, samples);
}

void WebUIPlugin::handleProfileRequest(uint32_t clientId, JsonDocument &request) {
    JsonDocument response;
    auto type = request["tp"].as<String>();
    ESP_LOGI("WebUIPlugin", "Handling request: %s", type.c_str());
    response["tp"] = String("res:") + type.substring(4);
    response["rid"] = request["rid"].as<String>();

    if (type == "req:profiles:list") {
        auto arr = response["profiles"].to<JsonArray>();
        for (auto const &id : profileManager->listProfiles()) {
            Profile profile{};
            profileManager->loadProfile(id, profile);
            auto p = arr.add<JsonObject>();
            writeProfile(p, profile);
        }
    } else if (type == "req:profiles:load") {
        auto id = request["id"].as<String>();
        Profile profile;
        if (profileManager->loadProfile(id, profile)) {
            auto obj = response["profile"].to<JsonObject>();
            writeProfile(obj, profile);
        } else {
            response["error"] = F("Profile not found");
        }
    } else if (type == "req:profiles:save") {
        auto obj = request["profile"].as<JsonObject>();
        Profile profile;
        parseProfile(obj, profile);
        if (!profileManager->saveProfile(profile)) {
            response["error"] = F("Save failed");
        }
        auto respObj = response["profile"].to<JsonObject>();
        writeProfile(respObj, profile);
    } else if (type == "req:profiles:delete") {
        auto id = request["id"].as<String>();
        if (!profileManager->deleteProfile(id)) {
            response["error"] = F("Delete failed");
        }
    } else if (type == "req:profiles:select") {
        auto id = request["id"].as<String>();
        profileManager->selectProfile(id);
    } else if (type == "req:profiles:favorite") {
        auto id = request["id"].as<String>();
        controller->getSettings().addFavoritedProfile(id);
    } else if (type == "req:profiles:unfavorite") {
        auto id = request["id"].as<String>();
        controller->getSettings().removeFavoritedProfile(id);
    } else if (type == "req:profiles:reorder") {
        // Expect an array of profile IDs in desired order
        if (request["order"].is<JsonArray>()) {
            std::vector<String> order;
            for (JsonVariant v : request["order"].as<JsonArray>()) {
                if (v.is<String>()) {
                    String id = v.as<String>();
                    if (!id.isEmpty() && std::find(order.begin(), order.end(), id) == order.end()) {
                        order.emplace_back(std::move(id));
                    }
                }
            }
            controller->getSettings().setProfileOrder(order);
        }
    }

    size_t bufferSize = measureJson(response);
    auto *buffer = ws.makeBuffer(bufferSize);
    serializeJson(response, buffer->get(), bufferSize);
    ws.text(clientId, buffer);
}

void WebUIPlugin::handleSettings(AsyncWebServerRequest *request) const {
    if (request->method() == HTTP_POST) {
        controller->getSettings().batchUpdate([request](Settings *settings) {
            if (request->hasArg("startupMode"))
                settings->setStartupMode(request->arg("startupMode") == "brew" ? MODE_BREW : MODE_STANDBY);
            if (request->hasArg("targetSteamTemp"))
                settings->setTargetSteamTemp(request->arg("targetSteamTemp").toInt());
            if (request->hasArg("targetWaterTemp"))
                settings->setTargetWaterTemp(request->arg("targetWaterTemp").toInt());
            if (request->hasArg("temperatureOffset"))
                settings->setTemperatureOffset(request->arg("temperatureOffset").toInt());
            if (request->hasArg("pressureScaling"))
                settings->setPressureScaling(request->arg("pressureScaling").toFloat());
            if (request->hasArg("pid"))
                settings->setPid(request->arg("pid"));
            if (request->hasArg("pumpModelCoeffs"))
                settings->setPumpModelCoeffs(request->arg("pumpModelCoeffs"));
            if (request->hasArg("wifiSsid"))
                settings->setWifiSsid(request->arg("wifiSsid"));
            if (request->hasArg("mdnsName"))
                settings->setMdnsName(request->arg("mdnsName"));
            if (request->hasArg("wifiPassword") && request->arg("wifiPassword") != "---unchanged---")
                settings->setWifiPassword(request->arg("wifiPassword"));
            settings->setHomekit(request->hasArg("homekit"));
            settings->setBoilerFillActive(request->hasArg("boilerFillActive"));
            if (request->hasArg("startupFillTime"))
                settings->setStartupFillTime(request->arg("startupFillTime").toInt() * 1000);
            if (request->hasArg("steamFillTime"))
                settings->setSteamFillTime(request->arg("steamFillTime").toInt() * 1000);
            settings->setSmartGrindActive(request->hasArg("smartGrindActive"));
            if (request->hasArg("smartGrindIp"))
                settings->setSmartGrindIp(request->arg("smartGrindIp"));
            if (request->hasArg("smartGrindMode"))
                settings->setSmartGrindMode(request->arg("smartGrindMode").toInt());
            settings->setHomeAssistant(request->hasArg("homeAssistant"));
            if (request->hasArg("haUser"))
                settings->setHomeAssistantUser(request->arg("haUser"));
            if (request->hasArg("haPassword"))
                settings->setHomeAssistantPassword(request->arg("haPassword"));
            if (request->hasArg("haIP"))
                settings->setHomeAssistantIP(request->arg("haIP"));
            if (request->hasArg("haPort"))
                settings->setHomeAssistantPort(request->arg("haPort").toInt());
            if (request->hasArg("haTopic"))
                settings->setHomeAssistantTopic(request->arg("haTopic"));
            settings->setMomentaryButtons(request->hasArg("momentaryButtons"));
            settings->setDelayAdjust(request->hasArg("delayAdjust"));
            if (request->hasArg("brewDelay"))
                settings->setBrewDelay(request->arg("brewDelay").toDouble());
            if (request->hasArg("grindDelay"))
                settings->setGrindDelay(request->arg("grindDelay").toDouble());
            if (request->hasArg("timezone"))
                settings->setTimezone(request->arg("timezone"));
            settings->setClockFormat(request->hasArg("clock24hFormat"));
            if (request->hasArg("standbyTimeout"))
                settings->setStandbyTimeout(request->arg("standbyTimeout").toInt() * 1000);
            if (request->hasArg("mainBrightness"))
                settings->setMainBrightness(request->arg("mainBrightness").toInt());
            if (request->hasArg("standbyBrightness"))
                settings->setStandbyBrightness(request->arg("standbyBrightness").toInt());
            if (request->hasArg("standbyBrightnessTimeout"))
                settings->setStandbyBrightnessTimeout(request->arg("standbyBrightnessTimeout").toInt() * 1000);
            if (request->hasArg("steamPumpPercentage"))
                settings->setSteamPumpPercentage(request->arg("steamPumpPercentage").toFloat());
            if (request->hasArg("steamPumpCutoff"))
                settings->setSteamPumpCutoff(request->arg("steamPumpCutoff").toFloat());
            if (request->hasArg("themeMode"))
                settings->setThemeMode(request->arg("themeMode").toInt());
            if (request->hasArg("sunriseR"))
                settings->setSunriseR(request->arg("sunriseR").toInt());
            if (request->hasArg("sunriseG"))
                settings->setSunriseG(request->arg("sunriseG").toInt());
            if (request->hasArg("sunriseB"))
                settings->setSunriseB(request->arg("sunriseB").toInt());
            if (request->hasArg("sunriseW"))
                settings->setSunriseW(request->arg("sunriseW").toInt());
            if (request->hasArg("sunriseExtBrightness"))
                settings->setSunriseExtBrightness(request->arg("sunriseExtBrightness").toInt());
            if (request->hasArg("emptyTankDistance"))
                settings->setEmptyTankDistance(request->arg("emptyTankDistance").toInt());
            if (request->hasArg("fullTankDistance"))
                settings->setFullTankDistance(request->arg("fullTankDistance").toInt());
            settings->save(true);
        });
        controller->setTargetTemp(controller->getTargetTemp());
        controller->setPumpModelCoeffs();
    }

    AsyncResponseStream *response = request->beginResponseStream("application/json");
    JsonDocument doc;
    Settings const &settings = controller->getSettings();
    doc["startupMode"] = settings.getStartupMode() == MODE_BREW ? "brew" : "standby";
    doc["targetSteamTemp"] = settings.getTargetSteamTemp();
    doc["targetWaterTemp"] = settings.getTargetWaterTemp();
    doc["homekit"] = settings.isHomekit();
    doc["homeAssistant"] = settings.isHomeAssistant();
    doc["haUser"] = settings.getHomeAssistantUser();
    doc["haPassword"] = settings.getHomeAssistantPassword();
    doc["haIP"] = settings.getHomeAssistantIP();
    doc["haPort"] = settings.getHomeAssistantPort();
    doc["haTopic"] = settings.getHomeAssistantTopic();
    doc["pid"] = settings.getPid();
    doc["pumpModelCoeffs"] = settings.getPumpModelCoeffs();
    doc["wifiSsid"] = settings.getWifiSsid();
    doc["wifiPassword"] = apMode ? "---unchanged---" : settings.getWifiPassword();
    doc["mdnsName"] = settings.getMdnsName();
    doc["temperatureOffset"] = String(settings.getTemperatureOffset());
    doc["pressureScaling"] = String(settings.getPressureScaling());
    doc["boilerFillActive"] = settings.isBoilerFillActive();
    doc["startupFillTime"] = settings.getStartupFillTime() / 1000;
    doc["steamFillTime"] = settings.getSteamFillTime() / 1000;
    doc["smartGrindActive"] = settings.isSmartGrindActive();
    doc["smartGrindIp"] = settings.getSmartGrindIp();
    doc["smartGrindMode"] = settings.getSmartGrindMode();
    doc["momentaryButtons"] = settings.isMomentaryButtons();
    doc["brewDelay"] = settings.getBrewDelay();
    doc["grindDelay"] = settings.getGrindDelay();
    doc["delayAdjust"] = settings.isDelayAdjust();
    doc["timezone"] = settings.getTimezone();
    doc["clock24hFormat"] = settings.isClock24hFormat();
    doc["standbyTimeout"] = settings.getStandbyTimeout() / 1000;
    doc["mainBrightness"] = settings.getMainBrightness();
    doc["standbyBrightness"] = settings.getStandbyBrightness();
    doc["standbyBrightnessTimeout"] = settings.getStandbyBrightnessTimeout() / 1000;
    doc["steamPumpPercentage"] = settings.getSteamPumpPercentage();
    doc["steamPumpCutoff"] = settings.getSteamPumpCutoff();
    doc["themeMode"] = settings.getThemeMode();
    doc["sunriseR"] = settings.getSunriseR();
    doc["sunriseG"] = settings.getSunriseG();
    doc["sunriseB"] = settings.getSunriseB();
    doc["sunriseW"] = settings.getSunriseW();
    doc["sunriseExtBrightness"] = settings.getSunriseExtBrightness();
    doc["emptyTankDistance"] = settings.getEmptyTankDistance();
    doc["fullTankDistance"] = settings.getFullTankDistance();
    serializeJson(doc, *response);
    request->send(response);

    if (request->method() == HTTP_POST && request->hasArg("restart"))
        ESP.restart();
}

void WebUIPlugin::handleBLEScaleList(AsyncWebServerRequest *request) {
    JsonDocument doc;
    JsonArray scalesArray = doc.to<JsonArray>();
    std::vector<DiscoveredDevice> devices = BLEScales.getDiscoveredScales();
    for (const DiscoveredDevice &device : BLEScales.getDiscoveredScales()) {
        JsonDocument scale;
        scale["uuid"] = device.getAddress().toString();
        scale["name"] = device.getName();
        scalesArray.add(scale);
    }
    AsyncResponseStream *response = request->beginResponseStream("application/json");
    serializeJson(doc, *response);
    request->send(response);
}

void WebUIPlugin::handleBLEScaleScan(AsyncWebServerRequest *request) {
    if (request->method() != HTTP_POST) {
        request->send(404);
        return;
    }
    BLEScales.scan();
    JsonDocument doc;
    doc["success"] = true;
    AsyncResponseStream *response = request->beginResponseStream("application/json");
    serializeJson(doc, *response);
    request->send(response);
}

void WebUIPlugin::handleBLEScaleConnect(AsyncWebServerRequest *request) {
    if (request->method() != HTTP_POST) {
        request->send(404);
        return;
    }
    BLEScales.connect(request->arg("uuid").c_str());
    JsonDocument doc;
    doc["success"] = true;
    AsyncResponseStream *response = request->beginResponseStream("application/json");
    serializeJson(doc, *response);
    request->send(response);
}

void WebUIPlugin::handleBLEScaleInfo(AsyncWebServerRequest *request) {
    JsonDocument doc;
    doc["connected"] = BLEScales.isConnected();
    doc["name"] = BLEScales.getName();
    doc["uuid"] = BLEScales.getUUID();
    AsyncResponseStream *response = request->beginResponseStream("application/json");
    serializeJson(doc, *response);
    request->send(response);
}

void WebUIPlugin::updateOTAStatus(const String &version) {
    Settings const &settings = controller->getSettings();
    JsonDocument doc;
    doc["latestVersion"] = ota->getCurrentVersion();
    doc["tp"] = "res:ota-settings";
    doc["displayUpdateAvailable"] = ota->isUpdateAvailable(false);
    doc["controllerUpdateAvailable"] = ota->isUpdateAvailable(true);
    doc["displayVersion"] = BUILD_GIT_VERSION;
    doc["controllerVersion"] = controller->getSystemInfo().version;
    doc["hardware"] = controller->getSystemInfo().hardware;
    doc["latestVersion"] = ota->getCurrentVersion();
    doc["channel"] = settings.getOTAChannel();
    doc["updating"] = updating;
    ws.textAll(doc.as<String>());
}

void WebUIPlugin::updateOTAProgress(uint8_t phase, int progress) {
    JsonDocument doc;
    doc["tp"] = "evt:ota-progress";
    doc["phase"] = phase;
    doc["progress"] = progress;
    String message = doc.as<String>();
    ws.textAll(message);
}

void WebUIPlugin::sendAutotuneResult() {
    JsonDocument doc;
    doc["tp"] = "evt:autotune-result";
    doc["pid"] = controller->getSettings().getPid();
    String message = doc.as<String>();
    ws.textAll(message);
}

void WebUIPlugin::handleFlushStart(uint32_t clientId, JsonDocument &request) {
    controller->onFlush();

    JsonDocument response;
    response["tp"] = "res:flush:start";
    response["rid"] = request["rid"];
    response["success"] = true;

    String msg;
    serializeJson(response, msg);
    ws.text(clientId, msg);
}

// Crash logging implementation
void WebUIPlugin::setupCrashHandler() {
    // ESP32 crash handling is built into the framework
    // We'll capture crash information at startup if available
    ESP_LOGI("WebUIPlugin", "Crash logging system initialized");
}

void WebUIPlugin::logDetailedCrash(const String &panicReason, const String &registers, const String &backtrace) {
    if (!SPIFFS.begin(true)) {
        ESP_LOGE("WebUIPlugin", "Failed to mount SPIFFS for detailed crash logging");
        return;
    }

    // Read existing crash log
    JsonDocument crashLog;
    File file = SPIFFS.open(CRASH_LOG_PATH, "r");
    if (file) {
        deserializeJson(crashLog, file);
        file.close();
    }

    // Initialize structure if needed
    if (!crashLog["crashes"].is<JsonArray>()) {
        crashLog["crashes"] = JsonArray();
    }

    // Create new detailed crash entry
    JsonObject newCrash = crashLog["crashes"].add<JsonObject>();
    newCrash["timestamp"] = millis();
    newCrash["uptime_ms"] = millis();
    newCrash["free_heap"] = ESP.getFreeHeap();
    newCrash["min_free_heap"] = ESP.getMinFreeHeap();
    newCrash["chip_revision"] = ESP.getChipRevision();
    newCrash["cpu_freq_mhz"] = ESP.getCpuFreqMHz();
    newCrash["flash_size"] = ESP.getFlashChipSize();
    
    // Add detailed crash information
    newCrash["panic_reason"] = panicReason;
    newCrash["registers"] = registers;
    newCrash["backtrace"] = backtrace;
    
    // Add reset reason
    esp_reset_reason_t resetReason = esp_reset_reason();
    String resetReasonStr;
    switch (resetReason) {
        case ESP_RST_POWERON: resetReasonStr = "Power on reset"; break;
        case ESP_RST_EXT: resetReasonStr = "External reset"; break;
        case ESP_RST_SW: resetReasonStr = "Software reset"; break;
        case ESP_RST_PANIC: resetReasonStr = "Software reset due to exception/panic"; break;
        case ESP_RST_INT_WDT: resetReasonStr = "Reset due to interrupt watchdog"; break;
        case ESP_RST_TASK_WDT: resetReasonStr = "Reset due to task watchdog"; break;
        case ESP_RST_WDT: resetReasonStr = "Reset due to other watchdogs"; break;
        case ESP_RST_DEEPSLEEP: resetReasonStr = "Reset after exiting deep sleep"; break;
        case ESP_RST_BROWNOUT: resetReasonStr = "Brownout reset"; break;
        case ESP_RST_SDIO: resetReasonStr = "Reset over SDIO"; break;
        default: resetReasonStr = "Unknown reset reason"; break;
    }
    newCrash["reset_reason"] = resetReasonStr;

    // Check if we need to trim the log
    String tempJson;
    serializeJson(crashLog, tempJson);
    if (tempJson.length() > CRASH_LOG_MAX_SIZE) {
        trimCrashLog();
        // Re-serialize after trimming
        tempJson.clear();
        serializeJson(crashLog, tempJson);
    }

    // Write updated crash log
    file = SPIFFS.open(CRASH_LOG_PATH, "w");
    if (file) {
        serializeJson(crashLog, file);
        file.close();
        ESP_LOGI("WebUIPlugin", "Detailed crash logged successfully, total size: %d bytes", tempJson.length());
    } else {
        ESP_LOGE("WebUIPlugin", "Failed to write detailed crash log");
    }
}

void WebUIPlugin::logCrash(const String &crashInfo) {
    if (!SPIFFS.begin(true)) {
        ESP_LOGE("WebUIPlugin", "Failed to mount SPIFFS for crash logging");
        return;
    }

    // Read existing crash log
    JsonDocument crashLog;
    File file = SPIFFS.open(CRASH_LOG_PATH, "r");
    if (file) {
        deserializeJson(crashLog, file);
        file.close();
    }

    // Initialize structure if needed
    if (!crashLog["crashes"].is<JsonArray>()) {
        crashLog["crashes"] = JsonArray();
    }

    // Create new crash entry
    JsonObject newCrash = crashLog["crashes"].add<JsonObject>();
    newCrash["timestamp"] = millis();
    newCrash["uptime_ms"] = millis();
    newCrash["free_heap"] = ESP.getFreeHeap();
    newCrash["min_free_heap"] = ESP.getMinFreeHeap();
    newCrash["chip_revision"] = ESP.getChipRevision();
    newCrash["cpu_freq_mhz"] = ESP.getCpuFreqMHz();
    newCrash["flash_size"] = ESP.getFlashChipSize();
    newCrash["crash_info"] = crashInfo;
    
    // Add reset reason
    esp_reset_reason_t resetReason = esp_reset_reason();
    String resetReasonStr;
    switch (resetReason) {
        case ESP_RST_POWERON: resetReasonStr = "Power on reset"; break;
        case ESP_RST_EXT: resetReasonStr = "External reset"; break;
        case ESP_RST_SW: resetReasonStr = "Software reset"; break;
        case ESP_RST_PANIC: resetReasonStr = "Software reset due to exception/panic"; break;
        case ESP_RST_INT_WDT: resetReasonStr = "Reset due to interrupt watchdog"; break;
        case ESP_RST_TASK_WDT: resetReasonStr = "Reset due to task watchdog"; break;
        case ESP_RST_WDT: resetReasonStr = "Reset due to other watchdogs"; break;
        case ESP_RST_DEEPSLEEP: resetReasonStr = "Reset after exiting deep sleep"; break;
        case ESP_RST_BROWNOUT: resetReasonStr = "Brownout reset"; break;
        case ESP_RST_SDIO: resetReasonStr = "Reset over SDIO"; break;
        default: resetReasonStr = "Unknown reset reason"; break;
    }
    newCrash["reset_reason"] = resetReasonStr;

    // Check if we need to trim the log
    String tempJson;
    serializeJson(crashLog, tempJson);
    if (tempJson.length() > CRASH_LOG_MAX_SIZE) {
        trimCrashLog();
        // Re-serialize after trimming
        tempJson.clear();
        serializeJson(crashLog, tempJson);
    }

    // Write updated crash log
    file = SPIFFS.open(CRASH_LOG_PATH, "w");
    if (file) {
        serializeJson(crashLog, file);
        file.close();
        ESP_LOGI("WebUIPlugin", "Crash logged successfully, total size: %d bytes", tempJson.length());
    } else {
        ESP_LOGE("WebUIPlugin", "Failed to write crash log");
    }
}

void WebUIPlugin::trimCrashLog() {
    if (!SPIFFS.exists(CRASH_LOG_PATH)) {
        return;
    }

    File file = SPIFFS.open(CRASH_LOG_PATH, "r");
    if (!file) {
        return;
    }

    JsonDocument crashLog;
    deserializeJson(crashLog, file);
    file.close();

    if (crashLog["crashes"].is<JsonArray>()) {
        JsonArray crashes = crashLog["crashes"];
        
        // Keep only the most recent crashes that fit within the trim size
        while (crashes.size() > 1) {
            String tempJson;
            serializeJson(crashLog, tempJson);
            if (tempJson.length() <= CRASH_LOG_TRIM_SIZE) {
                break;
            }
            crashes.remove(0); // Remove oldest crash
        }

        // Write trimmed log
        file = SPIFFS.open(CRASH_LOG_PATH, "w");
        if (file) {
            serializeJson(crashLog, file);
            file.close();
            ESP_LOGI("WebUIPlugin", "Crash log trimmed");
        }
    }
}

void WebUIPlugin::handleCrashLogDownload(AsyncWebServerRequest *request) {
    if (!SPIFFS.exists(CRASH_LOG_PATH)) {
        // Create empty crash log if it doesn't exist
        JsonDocument emptyLog;
        emptyLog["crashes"] = JsonArray();
        
        String response;
        serializeJson(emptyLog, response);
        
        request->send(200, "application/json", response);
        return;
    }

    // Stream the crash log file
    request->send(SPIFFS, CRASH_LOG_PATH, "application/json", true);
}

void WebUIPlugin::handleCoreDumpDownload(AsyncWebServerRequest *request) {
    // Check if core dump is available
    size_t coreAddr, coreSize;
    if (esp_core_dump_image_get(&coreAddr, &coreSize) != ESP_OK || coreSize == 0) {
        request->send(404, "text/plain", "No core dump available");
        return;
    }
    
    // Find the coredump partition
    const esp_partition_t* coredump_partition = esp_partition_find_first(ESP_PARTITION_TYPE_DATA, ESP_PARTITION_SUBTYPE_DATA_COREDUMP, NULL);
    if (coredump_partition == NULL) {
        request->send(500, "text/plain", "Core dump partition not found");
        return;
    }
    
    ESP_LOGI("WebUIPlugin", "Streaming core dump: %d bytes from 0x%x", coreSize, coreAddr);
    
    // Create a streaming response
    AsyncWebServerResponse *response = request->beginResponse(
        "application/octet-stream", 
        coreSize,
        [coredump_partition, coreSize](uint8_t *buffer, size_t maxLen, size_t index) -> size_t {
            // Calculate how much to read
            size_t remaining = coreSize - index;
            size_t toRead = (remaining < maxLen) ? remaining : maxLen;
            
            if (toRead == 0) return 0;
            
            // Read from partition
            esp_err_t err = esp_partition_read(coredump_partition, index, buffer, toRead);
            if (err != ESP_OK) {
                ESP_LOGE("WebUIPlugin", "Failed to read core dump: %s", esp_err_to_name(err));
                return 0;
            }
            
            return toRead;
        }
    );
    
    // Set appropriate headers
    response->addHeader("Content-Disposition", "attachment; filename=\"coredump.bin\"");
    response->addHeader("Cache-Control", "no-cache");
    
    request->send(response);
}

void WebUIPlugin::checkForCrashOnStartup() {
    esp_reset_reason_t resetReason = esp_reset_reason();
    
    // Check if the reset was due to a crash/panic
    if (resetReason == ESP_RST_PANIC || resetReason == ESP_RST_INT_WDT || 
        resetReason == ESP_RST_TASK_WDT || resetReason == ESP_RST_WDT) {
        
        String panicReason = "Crash detected at startup - Reset reason: ";
        switch (resetReason) {
            case ESP_RST_PANIC: panicReason += "Software exception/panic"; break;
            case ESP_RST_INT_WDT: panicReason += "Interrupt watchdog timeout"; break;
            case ESP_RST_TASK_WDT: panicReason += "Task watchdog timeout"; break;
            case ESP_RST_WDT: panicReason += "Other watchdog timeout"; break;
            default: panicReason += "Unknown watchdog/panic"; break;
        }
        
        // Try to get detailed crash information from stored crash data
        String registers = "";
        String backtrace = "";
        
        size_t coreAddr, coreSize;
        if (esp_core_dump_image_get(&coreAddr, &coreSize) == ESP_OK && coreSize > 0) {
            panicReason += " - Core dump available (" + String(coreSize) + " bytes at 0x" + String(coreAddr, HEX) + ")";
            
            // The ESP32 stores crash info in RTC memory that survives resets
            // Try to get the actual crash information from RTC slow memory
            esp_reset_reason_t detailed_reason = esp_reset_reason();
            
            // Try to extract actual crash info from the core dump
            String coreDumpInfo = extractCrashInfoFromCoreDump(coreAddr, coreSize);
            
            registers += "Core_dump_addr=0x" + String(coreAddr, HEX) + " ";
            registers += "Core_dump_size=" + String(coreSize) + " ";
            registers += "Reset_reason_code=" + String((int)detailed_reason) + " ";
            registers += coreDumpInfo;
            
            // Add system state information that's actually useful
            registers += "Free_heap=" + String(ESP.getFreeHeap()) + " ";
            registers += "Min_free_heap=" + String(ESP.getMinFreeHeap()) + " ";
            registers += "Chip_rev=" + String(ESP.getChipRevision()) + " ";
            registers += "CPU_freq=" + String(ESP.getCpuFreqMHz()) + "MHz ";
            registers += "Flash_size=" + String(ESP.getFlashChipSize()) + " ";
            
            // Check if we can get more info from the crash
            switch (resetReason) {
                case ESP_RST_PANIC:
                    backtrace += "PANIC: Software exception occurred. ";
                    backtrace += "Core dump contains register state and stack trace. ";
                    backtrace += "To analyze: 1) Download core dump from flash at 0x" + String(coreAddr, HEX) + " ";
                    backtrace += "2) Use espcoredump.py tool: 'espcoredump.py info_corefile -t raw -c core.bin firmware.elf' ";
                    break;
                case ESP_RST_INT_WDT:
                    backtrace += "INTERRUPT_WDT: Interrupt watchdog timeout. ";
                    backtrace += "An interrupt handler took too long or got stuck in a loop. ";
                    backtrace += "Check interrupt handlers and disable interrupts for shorter periods. ";
                    break;
                case ESP_RST_TASK_WDT:
                    backtrace += "TASK_WDT: Task watchdog timeout. ";
                    backtrace += "A task was blocked for too long (>5 seconds by default). ";
                    backtrace += "Check for infinite loops, blocking operations, or increase watchdog timeout. ";
                    break;
                default:
                    backtrace += "UNKNOWN: Reset reason " + String((int)resetReason) + ". ";
                    backtrace += "Check ESP32 reset reason documentation. ";
                    break;
            }
            
            backtrace += "Uptime_at_crash=unknown (check logs) ";
            backtrace += "Core_dump_available=YES ";
            backtrace += "Use_espcoredump_tool_for_detailed_analysis=true";
            
        } else {
            registers += "No core dump available - crash analysis limited. ";
            registers += "Enable core dump in partition table for detailed crash analysis. ";
            backtrace += "No core dump found. To enable: add 'coredump' partition to partition table. ";
            backtrace += "Without core dump, only basic reset reason is available: " + String((int)resetReason);
        }
        
        // Log detailed crash information
        logDetailedCrash(panicReason, registers, backtrace);
        ESP_LOGI("WebUIPlugin", "Detailed crash logged: %s", panicReason.c_str());
    }
}

void WebUIPlugin::crashHandler(void *data) {
    // This function is called during a crash, so we need to be very careful
    // We can't use complex operations or dynamic memory allocation
    if (g_webUIPlugin) {
        // For now, just log that a crash occurred
        // The actual crash data will be captured by the ESP32 system
    }
}

String WebUIPlugin::extractCrashInfoFromCoreDump(size_t coreAddr, size_t coreSize) {
    String crashInfo = "";
    
    // Try to read basic crash information from the core dump
    const esp_partition_t* coredump_partition = esp_partition_find_first(ESP_PARTITION_TYPE_DATA, ESP_PARTITION_SUBTYPE_DATA_COREDUMP, NULL);
    if (coredump_partition == NULL) {
        return "No_coredump_partition_found ";
    }
    
    // Read the first few bytes of the core dump to get basic crash info
    uint8_t header_buffer[64];
    esp_err_t err = esp_partition_read(coredump_partition, 0, header_buffer, sizeof(header_buffer));
    if (err != ESP_OK) {
        return "Failed_to_read_core_dump: " + String(esp_err_to_name(err)) + " ";
    }
    
    // Try to extract meaningful information
    // The ESP32 core dump format contains panic info in the first part
    uint32_t* uint_buffer = (uint32_t*)header_buffer;
    
    // Look for potential PC (Program Counter) values
    String pcInfo = "";
    for (int i = 0; i < 8; i++) {
        uint32_t addr = uint_buffer[i];
        // Check if this looks like a code address (in flash range)
        if (addr >= 0x40000000 && addr <= 0x50000000) {
            pcInfo += "PC_candidate_" + String(i) + "=0x" + String(addr, HEX) + " ";
            
            // Simple heuristic: addresses in certain ranges might indicate specific modules
            if (addr >= 0x42000000 && addr <= 0x43000000) {
                pcInfo += "(likely_app_code) ";
            } else if (addr >= 0x40370000 && addr <= 0x40380000) {
                pcInfo += "(likely_freertos) ";
            } else if (addr >= 0x40080000 && addr <= 0x40090000) {
                pcInfo += "(likely_bootloader) ";
            }
        }
    }
    
    if (pcInfo.length() > 0) {
        crashInfo += pcInfo;
    } else {
        crashInfo += "No_valid_PC_found ";
    }
    
    crashInfo += "Core_dump_readable=YES ";
    return crashInfo;
}


