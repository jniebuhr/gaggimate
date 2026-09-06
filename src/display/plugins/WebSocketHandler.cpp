#include "WebSocketHandler.h"
#include <algorithm>
#include <display/core/Controller.h>
#include <display/core/ProfileManager.h>
#include <display/core/process/BrewProcess.h>
#include <display/core/process/GrindProcess.h>
#include <display/models/profile.h>
#include <display/plugins/BLEScalePlugin.h>
#include <display/plugins/ShotHistoryPlugin.h>
#include <display/util/PsramStlAllocator.h>
#include <display/util/PsramWsBuffer.h>
#include <display/util/mathutils.h>
#include <string>
#include <unordered_map>
#include <vector>

// Incoming WebSocket payloads (profile uploads reserve up to 64 KB) are
// reassembled here. Back the character storage with PSRAM so these large,
// transient buffers don't spike the scarce internal SRAM. The map nodes
// themselves stay on the default heap (tiny: an id + a string handle).
using PsramString = std::basic_string<char, std::char_traits<char>, PsramStlAllocator<char>>;
static std::unordered_map<uint32_t, PsramString> rxBuffers;

// Serialize a JsonDocument straight into a PSRAM-backed WebSocket message
// buffer — one exact-sized allocation, off the internal heap. [GM-139]
static AsyncWebSocketSharedBuffer toWsBuffer(JsonDocument &doc) {
    const size_t len = measureJson(doc);
    auto buffer = makePsramWsBuffer(len);
    serializeJson(doc, buffer->data(), len);
    return buffer;
}

// Serialize each warning as {k, l, a}; onlyShown drops ignored and inactive ones (confirm dialog).
static void addWarnings(JsonArray warn, const WarningManager &wm, bool onlyShown) {
    for (int i = 0; i < WARNING_TYPE_COUNT; i++) {
        const auto type = static_cast<WarningType>(i);
        if (onlyShown && !wm.isWarn(type) && !wm.isError(type))
            continue;
        JsonObject w = warn.add<JsonObject>();
        w["k"] = WarningManager::key(type);
        w["l"] = wm.getLevel(type);
        if (!onlyShown)
            w["a"] = wm.isActive(type);
    }
}

WebSocketHandler::WebSocketHandler() : ws("/ws") {}

void WebSocketHandler::setup(Controller *_controller, PluginManager *_pluginManager) {
    this->controller = _controller;
    this->pluginManager = _pluginManager;
    this->profileManager = _controller->getProfileManager();

    pluginManager->on("controller:autotune:result", [this](Event const &event) { sendAutotuneResult(); });
    pluginManager->on("controller:autotune:failed", [this](Event const &) { sendAutotuneFailed(); });

    // A brew start blocked by an error-level warning asks every dashboard for confirmation.
    pluginManager->on("controller:brew:confirm", [this](Event const &) {
        JsonDocument doc(&psramAllocator);
        doc["tp"] = "evt:brew:confirm";
        addWarnings(doc["warn"].to<JsonArray>(), controller->getWarnings(), true);
        broadcastJson(doc);
    });

    pluginManager->on("controller:brew:confirm:cancel", [this](Event const &) {
        JsonDocument doc(&psramAllocator);
        doc["tp"] = "evt:brew:confirm:cancel";
        broadcastJson(doc);
    });

    // Forward shot history rebuild progress events to WebSocket clients
    pluginManager->on("evt:history-rebuild-progress", [this](Event const &event) {
        JsonDocument doc(&psramAllocator);
        doc["tp"] = "evt:history-rebuild-progress";
        doc["total"] = event.getInt("total");
        doc["current"] = event.getInt("current");
        doc["status"] = event.getString("status");
        broadcastJson(doc);
    });

    // Forward "shot saved to history" events to WebSocket clients, so the
    // dashboard can refetch the recent-shots buffer at the right time.
    pluginManager->on("evt:history-shot-saved", [this](Event const &event) {
        JsonDocument doc(&psramAllocator);
        doc["tp"] = "evt:history-shot-saved";
        doc["id"] = event.getInt("id");
        broadcastJson(doc);
    });

    // Forward live shot-finished stats (pressure/flow) to WebSocket clients, so
    // the dashboard's finished card can show them without waiting for the
    // history file write.
    pluginManager->on("evt:shot-finished-stats", [this](Event const &event) {
        JsonDocument doc(&psramAllocator);
        doc["tp"] = "evt:shot-finished-stats";
        doc["maxPressure"] = event.getFloat("maxPressure");
        doc["avgFlow"] = event.getFloat("avgFlow");
        broadcastJson(doc);
    });

    // Subscribe to Bluetooth scale weight updates
    pluginManager->on("controller:volumetric-measurement:bluetooth:change",
                      [this](Event const &event) { this->currentBluetoothWeight = event.getFloat("value"); });
}

void WebSocketHandler::attach(AsyncWebServer &server) {
    ws.onEvent(
        [this](AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len) {
            if (type == WS_EVT_CONNECT) {
                // Close (and let the browser reconnect) a client whose send
                // queue backs up, instead of keeping it open. With it kept open
                // (false), a client that stalls under load — e.g. while the UI
                // is fetching many shot files for statistics — never has its
                // queued frames / AsyncTCP buffers reclaimed, so they accumulate
                // in internal DRAM until the whole IP stack starves (web + ICMP
                // die, no recovery). Reclaiming via close is the safer failure
                // mode. (Was the v1.8.1 behaviour.)
                client->setCloseClientOnQueueFull(true);
                // Full slow-state snapshot first, so the client never merges telemetry onto an empty state.
                if (lastStateBuffer)
                    client->text(lastStateBuffer);
                ESP_LOGI("WebSocketHandler", "WebSocket client connected (%d open connections)", server->getClients().size());
            } else if (type == WS_EVT_DISCONNECT) {
                ESP_LOGI("WebSocketHandler", "WebSocket client disconnected (%d open connections)", server->getClients().size());
                rxBuffers.erase(client->id());
            } else if (type == WS_EVT_DATA) {
                handleWebSocketData(server, client, type, arg, data, len);
            }
        });
    server.addHandler(&ws);
}

void WebSocketHandler::loop(unsigned long now) {
    if (now > lastStatus + STATUS_PERIOD && hasClients()) {
        lastStatus = now;
        publishState(now);
        publishTelemetry();
    }
    if (now > lastCleanup + CLEANUP_PERIOD) {
        lastCleanup = now;
        ws.cleanupClients();
    }
}

void WebSocketHandler::handleWebSocketData(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg,
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
            ESP_LOGV("WebSocketHandler", "Received request: %.*s", (int)buf.size(), buf.c_str());
            JsonDocument doc(&psramAllocator);
            DeserializationError err = deserializeJson(doc, buf.c_str());
            if (!err) {
                String msgType = doc["tp"].as<String>();
                if (msgType.startsWith("req:profiles:")) {
                    handleProfileRequest(client->id(), doc);
                } else if (msgType == "req:ota-settings") {
                    if (otaSettingsHandler)
                        otaSettingsHandler(doc);
                } else if (msgType == "req:ota-start") {
                    if (otaStartHandler)
                        otaStartHandler(doc);
                } else if (msgType == "req:autotune-start") {
                    handleAutotuneStart(client->id(), doc);
                } else if (msgType == "req:process:activate") {
                    controller->activate(doc["ignoreWarnings"].as<bool>());
                } else if (msgType == "req:brew:confirm:cancel") {
                    controller->cancelBrewConfirm();
                } else if (msgType == "req:process:deactivate") {
                    controller->deactivate();
                    controller->clear();
                } else if (msgType == "req:process:clear") {
                    controller->clear();
                } else if (msgType == "req:grind:activate") {
                    controller->activateGrind();
                } else if (msgType == "req:grind:deactivate") {
                    controller->deactivateGrind();
                } else if (msgType == "req:change-grind-target") {
                    if (doc["target"].is<uint8_t>()) {
                        auto target = doc["target"].as<uint8_t>();
                        controller->getSettings().setVolumetricTarget(target);
                    }
                } else if (msgType == "req:raise-temp") {
                    controller->raiseTemp();
                } else if (msgType == "req:lower-temp") {
                    controller->lowerTemp();
                } else if (msgType == "req:raise-grind-target") {
                    controller->raiseGrindTarget();
                } else if (msgType == "req:lower-grind-target") {
                    controller->lowerGrindTarget();
                } else if (msgType == "req:raise-brew-target") {
                    controller->raiseBrewTarget();
                } else if (msgType == "req:lower-brew-target") {
                    controller->lowerBrewTarget();
                } else if (msgType == "req:change-mode") {
                    // Locked in standby while the controller is not ready, like the touch UI's wake gate.
                    if (doc["mode"].is<uint8_t>() && controller->getSystemState() == SYSTEM_READY) {
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
                } else if (msgType == "req:history:rebuild") {
                    // Handle rebuild asynchronously - send immediate ack, progress comes via events
                    JsonDocument resp(&psramAllocator);
                    resp["tp"] = "res:history:rebuild";
                    if (doc["rid"].is<const char *>()) {
                        resp["rid"] = doc["rid"];
                    }
                    resp["msg"] = "Rebuild started";
                    client->text(toWsBuffer(resp));
                    ShotHistory.startAsyncRebuild();
                } else if (msgType.startsWith("req:history")) {
                    JsonDocument resp(&psramAllocator);
                    ShotHistory.handleRequest(doc, resp);
                    client->text(toWsBuffer(resp));
                } else if (msgType == "req:flush:start") {
                    handleFlushStart(client->id(), doc);
                } else if (msgType == "req:flush:stop") {
                    handleFlushStop(client->id(), doc);
                }
            }
        }
        // Done with this message
        rxBuffers.erase(cid);
    }
}

void WebSocketHandler::handleAutotuneStart(uint32_t clientId, JsonDocument &request) {
    int testTime = request["time"].as<int>();
    int samples = request["samples"].as<int>();
    // Heater wattage drives combinedKff = TUNER_OUTPUT_SPAN / wattage on the
    // controller. 0 = "skip combinedKff derivation" — happens when older Web
    // UI builds omit the field. WebUI form default is 680 W (Gaggia Classic
    // Pro 2019 / E24, 230 V boiler).
    int heaterWattage = request["wattage"] | 0;
    controller->autotune(testTime, samples, heaterWattage);
}

void WebSocketHandler::handleProfileRequest(uint32_t clientId, JsonDocument &request) {
    // Allocate the response node pool from PSRAM — list responses can be tens
    // of KB and would otherwise fragment the ~300 KB internal heap.
    JsonDocument response(&psramAllocator);
    auto type = request["tp"].as<String>();
    ESP_LOGI("WebSocketHandler", "Handling request: %s", type.c_str());
    response["tp"] = String("res:") + type.substring(4);
    response["rid"] = request["rid"].as<String>();

    if (type == "req:profiles:list") {
        auto arr = response["profiles"].to<JsonArray>();
        for (auto const &id : profileManager->listProfiles()) {
            Profile profile{};
            // Skip entries whose JSON couldn't be opened or failed validation
            // (parseProfile returns false for missing label/type/phases). Without
            // this, corrupt or partial profile files surface as blank cards in
            // the UI — the user reported "blank Simple cards" originating here.
            if (!profileManager->loadProfile(id, profile)) {
                ESP_LOGW("WebSocketHandler", "Skipping unreadable profile %s in list response", id.c_str());
                continue;
            }
            auto p = arr.add<JsonObject>();
            if (request["minimal"].as<bool>()) {
                p["id"] = profile.id;
                p["label"] = profile.label;
            } else {
                writeProfile(p, profile);
            }
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
        profileManager->addFavoritedProfile(id);
    } else if (type == "req:profiles:unfavorite") {
        auto id = request["id"].as<String>();
        profileManager->removeFavoritedProfile(id);
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

    ws.text(clientId, toWsBuffer(response));
}

// Slow-changing part of evt:status: sent when its content changes, every STATE_RESEND_PERIOD, and to new clients.
void WebSocketHandler::publishState(unsigned long now) {
    JsonDocument doc(&psramAllocator);
    doc["tp"] = "evt:status";
    doc["m"] = controller->getMode();
    const Profile &profile = controller->getProfileManager()->getSelectedProfile();
    doc["p"] = profile.label;
    doc["puid"] = profile.id;
    const auto &caps = controller->getSystemInfo().capabilities;
    doc["cp"] = caps.pressure;
    doc["cd"] = caps.dimming;
    doc["gp"] = caps.hasAddon(7);
    doc["led"] = caps.ledControl;
    doc["tw"] = profile.getTotalVolume(); // total target weight for the process
    doc["bta"] = controller->isVolumetricAvailable() ? 1 : 0;
    doc["bt"] = controller->isVolumetricAvailable() && profile.isVolumetric() ? 1 : 0;
    doc["btd"] = profile.getTotalDuration();
    doc["gtd"] = controller->getTargetGrindDuration();
    doc["gtv"] = controller->getSettings().getTargetGrindVolume();
    doc["gt"] = controller->isVolumetricAvailable() && controller->getSettings().isVolumetricTarget() ? 1 : 0;
    doc["gact"] = controller->isGrindActive() ? 1 : 0;
    doc["up"] = updateAvailableProvider ? updateAvailableProvider() : false;
    // Same text as the display's standby label, so headless users see starting/waiting/error states too.
    JsonObject sys = doc["sys"].to<JsonObject>();
    sys["s"] = systemStateKey(controller->getSystemState());
    sys["m"] = controller->getSystemStateMessage();
    sys["c"] = controller->getError();
    const bool bleConnected = BLEScales.isConnected();
    doc["bc"] = bleConnected;
    // Scale battery: null when disconnected or the driver reports the UNKNOWN sentinel, so merging clients clear it.
    if (bleConnected && BLEScales.hasBatteryLevel() && BLEScales.getBatteryLevel() != REMOTE_SCALES_BATTERY_UNKNOWN) {
        doc["sbat"] = BLEScales.getBatteryLevel();
    } else {
        doc["sbat"] = nullptr;
    }
    addWarnings(doc["warn"].to<JsonArray>(), controller->getWarnings(), false);

    auto buffer = toWsBuffer(doc);
    const bool unchanged = lastStateBuffer && lastStateBuffer->size() == buffer->size() &&
                           memcmp(lastStateBuffer->data(), buffer->data(), buffer->size()) == 0;
    if (unchanged && now - lastStateSent < STATE_RESEND_PERIOD)
        return;
    lastStateBuffer = buffer;
    lastStateSent = now;
    ws.textAll(buffer);
}

// Fast part of evt:status, every STATUS_PERIOD: live readings plus the process progress.
void WebSocketHandler::publishTelemetry() {
    statusDoc.clear();
    statusDoc["tp"] = "evt:status";
    statusDoc["ct"] = round_to(controller->getCurrentTemp(), 3);
    statusDoc["tt"] = controller->getTargetTemp();
    statusDoc["pr"] = round_to(controller->getCurrentPressure(), 3);
    statusDoc["fl"] = round_to(controller->getCurrentPumpFlow(), 3);
    statusDoc["pt"] = controller->getTargetPressure();
    statusDoc["wl"] = controller->getWaterLevel();
    statusDoc["tof"] = controller->getTofDistance();
    statusDoc["rssi"] = 0;
    statusDoc["lat"] = -1; // BLE round-trip latency (ms); -1 = not yet measured
    statusDoc["pw"] = controller->getCurrentPumpPower();
    statusDoc["hp"] = round_to(controller->getCurrentHeaterPower(), 3);
    if (controller->getClientController()->getClient()->isConnected()) {
        statusDoc["rssi"] = controller->getClientController()->getClient()->getRssi();
    }
    if (controller->getClientController()->hasLatency()) {
        statusDoc["lat"] = controller->getClientController()->getLatencyMs();
    }
    const bool bleConnected = BLEScales.isConnected();
    statusDoc["bw"] = bleConnected ? this->currentBluetoothWeight : 0; // current bluetooth weight
    statusDoc["cw"] = bleConnected ? this->currentBluetoothWeight : 0; // Use 'currentWeight' for forward compatbility
    // Explicit null/zero so merging clients drop a finished process instead of keeping the last one.
    statusDoc["process"] = nullptr;
    statusDoc["pkr"] = 0;
    statusDoc["pf"] = 0;
    statusDoc["tf"] = 0;

    // Deref under the process lock — other tasks delete the process at any time (GM-147).
    // Released before broadcastJson so the ws send never runs under the lock.
    std::unique_lock<std::recursive_mutex> processGuard(controller->getProcessLock());
    Process *process = controller->getProcess();
    if (process == nullptr) {
        process = controller->getLastProcess();
    }
    if (process != nullptr) {
        auto pObj = statusDoc["process"].to<JsonObject>();
        pObj["a"] = controller->isActive() ? 1 : 0;
        statusDoc["pkr"] = round_to(controller->getCurrentPuckResistance(), 3);
        statusDoc["pf"] = round_to(controller->getCurrentPuckFlow(), 3);
        statusDoc["tf"] = controller->getTargetFlow();
        if (process->getType() == MODE_BREW) {
            auto *brew = static_cast<BrewProcess *>(process);
            unsigned long ts = brew->isActive() && controller->isActive() ? millis() : brew->finished;
            pObj["s"] = brew->currentPhase.phase == PhaseType::PHASE_TYPE_BREW ? "brew" : "infusion";
            pObj["l"] = brew->isActive() ? brew->currentPhase.name.c_str() : "Finished";
            pObj["e"] = ts - brew->processStarted;
            pObj["u"] = brew->isUtility() ? 1 : 0;
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
    processGuard.unlock();

    broadcastJson(statusDoc);
}

void WebSocketHandler::broadcastJson(JsonDocument &doc) {
    if (ws.getClients().empty()) {
        return;
    }
    ws.textAll(toWsBuffer(doc));
}

void WebSocketHandler::sendAutotuneResult() {
    JsonDocument doc(&psramAllocator);
    doc["tp"] = "evt:autotune-result";
    doc["pid"] = controller->getSettings().getPid();
    broadcastJson(doc);
}

void WebSocketHandler::sendAutotuneFailed() {
    // Distinct WS event — Autotune page renders "timed out" error card
    // instead of stuck spinner. Fires on ERROR_CODE_AUTOTUNE_TIMEOUT.
    JsonDocument doc(&psramAllocator);
    doc["tp"] = "evt:autotune-failed";
    broadcastJson(doc);
}

void WebSocketHandler::handleFlushStart(uint32_t clientId, JsonDocument &request) {
    controller->onFlush();

    JsonDocument response(&psramAllocator);
    response["tp"] = "res:flush:start";
    response["rid"] = request["rid"];
    response["success"] = true;
    ws.text(clientId, toWsBuffer(response));
}

// Ends a hold-to-flush (flush duration 0); a no-op while a fixed-length flush runs.
void WebSocketHandler::handleFlushStop(uint32_t clientId, JsonDocument &request) {
    controller->onFlushRelease();

    JsonDocument response(&psramAllocator);
    response["tp"] = "res:flush:stop";
    response["rid"] = request["rid"];
    response["success"] = true;
    ws.text(clientId, toWsBuffer(response));
}
