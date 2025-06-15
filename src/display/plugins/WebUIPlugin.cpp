#include "WebUIPlugin.h"
#include <DNSServer.h>
#include <SPIFFS.h>
#include <display/core/Controller.h>
#include <display/core/ProfileManager.h>
#include <display/models/profile.h>

#include "BLEScalePlugin.h"

WebUIPlugin::WebUIPlugin() : server(80), ws("/ws") {}

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
        const int apMode = event.getInt("AP");
        start(apMode);
    });
    pluginManager->on("controller:ready", [this](Event const &) {
        ota->setControllerVersion(controller->getSystemInfo().version);
        ota->init(controller->getClientController()->getClient());
    });
    pluginManager->on("controller:autotune:result", [this](Event const &event) { sendAutotuneResult(); });
}

void WebUIPlugin::loop() {
    if (updating) {
        pluginManager->trigger("ota:update:start");
        ota->update(updateComponent != "display", updateComponent != "controller");
        pluginManager->trigger("ota:update:end");
        updating = false;
    }
    const long now = millis();
    if (lastUpdateCheck == 0 || now > lastUpdateCheck + UPDATE_CHECK_INTERVAL) {
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
        doc["m"] = controller->getMode();
        doc["p"] = controller->getProfileManager()->getSelectedProfile().label;
        doc["cp"] = controller->getSystemInfo().capabilities.pressure;
        doc["cd"] = controller->getSystemInfo().capabilities.dimming;
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

void WebUIPlugin::start(bool apMode) {
    if (apMode) {
        server.on("/connecttest.txt", [](AsyncWebServerRequest *request) {
            request->redirect("http://logout.net");
        }); // windows 11 captive portal workaround
        server.on("/wpad.dat", [](AsyncWebServerRequest *request) {
            request->send(404);
        }); // Honestly don't understand what this is but a 404 stops win 10 keep calling this repeatedly and panicking the esp32
            // :)
        server.on("/generate_204",
                  [](AsyncWebServerRequest *request) { request->redirect(LOCAL_URL); }); // android captive portal redirect
        server.on("/redirect", [](AsyncWebServerRequest *request) { request->redirect(LOCAL_URL); }); // microsoft redirect
        server.on("/hotspot-detect.html",
                  [](AsyncWebServerRequest *request) { request->redirect(LOCAL_URL); }); // apple call home
        server.on("/canonical.html",
                  [](AsyncWebServerRequest *request) { request->redirect(LOCAL_URL); });       // firefox captive portal call home
        server.on("/success.txt", [](AsyncWebServerRequest *request) { request->send(200); }); // firefox captive portal call home
        server.on("/ncsi.txt", [](AsyncWebServerRequest *request) { request->redirect(LOCAL_URL); }); // windows call home
    }
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
    server.on("/ota", [](AsyncWebServerRequest *request) { request->send(SPIFFS, "/w/index.html"); });
    server.on("/settings", [](AsyncWebServerRequest *request) { request->send(SPIFFS, "/w/index.html"); });
    server.on("/scales", [](AsyncWebServerRequest *request) { request->send(SPIFFS, "/w/index.html"); });
    server.serveStatic("/", SPIFFS, "/w").setDefaultFile("index.html").setCacheControl("max-age=0");
    ws.onEvent(
        [this](AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len) {
            if (type == WS_EVT_CONNECT) {
                printf("Received new websocket connection\n");
                client->setCloseClientOnQueueFull(true);
            } else if (type == WS_EVT_DISCONNECT) {
                printf("Client disconnected\n");
            } else if (type == WS_EVT_DATA) {
                auto *info = static_cast<AwsFrameInfo *>(arg);
                if (info->final && info->index == 0 && info->len == len) {
                    if (info->opcode == WS_TEXT) {
                        data[len] = 0;
                        Serial.printf("Received request: %s\n", (char *)data);
                        JsonDocument doc;
                        DeserializationError err = deserializeJson(doc, data);
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
                            }
                        }
                    }
                }
            }
        });
    server.addHandler(&ws);
    server.begin();
    printf("Webserver started\n");
    if (apMode) {
        dnsServer = new DNSServer();
        dnsServer->setTTL(3600);
        dnsServer->start(53, "*", WIFI_AP_IP);
        printf("Started catchall DNS for captive portal\n");
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
            response["error"] = "Profile not found";
        }
    } else if (type == "req:profiles:save") {
        auto obj = request["profile"].as<JsonObject>();
        Profile profile;
        parseProfile(obj, profile);
        if (!profileManager->saveProfile(profile)) {
            response["error"] = "Save failed";
        }
        auto respObj = response["profile"].to<JsonObject>();
        writeProfile(respObj, profile);
    } else if (type == "req:profiles:delete") {
        auto id = request["id"].as<String>();
        if (!profileManager->deleteProfile(id)) {
            response["error"] = "Delete failed";
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
    }

    String msg;
    serializeJson(response, msg);
    ws.text(clientId, msg);
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
            if (request->hasArg("wifiSsid"))
                settings->setWifiSsid(request->arg("wifiSsid"));
            if (request->hasArg("mdnsName"))
                settings->setMdnsName(request->arg("mdnsName"));
            if (request->hasArg("wifiPassword"))
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
            settings->save(true);
        });
        controller->setTargetTemp(controller->getTargetTemp());
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
    doc["pid"] = settings.getPid();
    doc["wifiSsid"] = settings.getWifiSsid();
    doc["wifiPassword"] = settings.getWifiPassword();
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
