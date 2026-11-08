#include "MahlkonigPlugin.h"
#include "GrinderLink.h"

#include <ESPAsyncWebServer.h>
#include <cmath>
#include <display/core/Controller.h>
#include <display/core/ProfileManager.h>
#include <display/core/process/BrewProcess.h>
#include <display/models/shot_log_format.h>
#include <display/plugins/ShotHistoryPlugin.h>
#include <display/plugins/WebSocketHandler.h>
#include <display/util/PsramAllocator.h>

namespace {
constexpr const char *TAG = "MahlkonigPlugin";
constexpr size_t MAX_BODY_SIZE = 1024;
// Scale settle + history write normally take ~4 s; past this the live scale weight is reported instead
constexpr unsigned long SETTLE_TIMEOUT_MS = 8000;
// The grinder counts as connected while it polls at least this often
constexpr unsigned long GRINDER_SEEN_MS = 10000;
// A brew starting this soon after a grinder request (e.g. after a confirm dialog) counts as grinder-started
constexpr unsigned long GRINDER_START_WINDOW_MS = 30000;

float numberLike(JsonVariantConst v) {
    if (v.is<float>())
        return v.as<float>();
    if (v.is<const char *>())
        return String(v.as<const char *>()).toFloat();
    return 0.0f;
}

bool isUsable(float grams) { return std::isfinite(grams) && grams > 0.0f; }
} // namespace

void MahlkonigPlugin::setup(Controller *_controller, PluginManager *_pluginManager) {
    controller = _controller;
    pluginManager = _pluginManager;

    pluginManager->on("webui:server:register",
                      [this](Event const &event) { registerRoutes(event.getPointer<AsyncWebServer>("server")); });
    pluginManager->on("webui:ws:register",
                      [this](Event const &event) { registerWsHandlers(event.getPointer<WebSocketHandler>("ws")); });
    pluginManager->on("controller:brew:start", [this](Event const &) { onBrewStart(); });
    pluginManager->on("controller:brew:end", [this](Event const &) { onBrewEnd(); });
    pluginManager->on("controller:volumetric-measurement:bluetooth:change", [this](Event const &event) {
        std::lock_guard<std::mutex> lock(mutex);
        lastScaleWeight = event.getFloat("value");
    });
    pluginManager->on("evt:history-shot-saved", [this](Event const &event) {
        std::lock_guard<std::mutex> lock(mutex);
        if (phase != Phase::IDLE)
            savedShotId = static_cast<uint32_t>(event.getInt("id"));
    });
}

void MahlkonigPlugin::registerRoutes(AsyncWebServer *server) {
    if (server == nullptr)
        return;
    auto body = [this](void (MahlkonigPlugin::*handler)(const uint8_t *, size_t)) {
        return [this, handler](AsyncWebServerRequest *, uint8_t *data, size_t len, size_t index, size_t total) {
            if (total > MAX_BODY_SIZE)
                return;
            if (index == 0)
                bodyBuffer = "";
            bodyBuffer.concat(reinterpret_cast<const char *>(data), len);
            if (index + len == total)
                (this->*handler)(reinterpret_cast<const uint8_t *>(bodyBuffer.c_str()), bodyBuffer.length());
        };
    };
    auto emptyReply = [](AsyncWebServerRequest *request) { request->send(200, "application/json", "{}"); };

    server->on(gbs::ROUTE_IDENTITY, HTTP_GET, [this](AsyncWebServerRequest *request) { handleIdentity(request); });
    server->on(gbs::ROUTE_STATUS, HTTP_GET, [this](AsyncWebServerRequest *request) { handleStatus(request); });
    server->on(gbs::ROUTE_GRIND_DONE, HTTP_POST, emptyReply, nullptr, body(&MahlkonigPlugin::handleBrewRatioBody));
    server->on(gbs::ROUTE_RUN_SCRIPT, HTTP_POST, emptyReply, nullptr, body(&MahlkonigPlugin::handleExecuteBody));
    server->on(AsyncURIMatcher::prefix(gbs::ROUTE_FAMILY), HTTP_ANY, [](AsyncWebServerRequest *request) {
        ESP_LOGI(TAG, "Unhandled grinder request %s", request->url().c_str());
        request->send(200, "application/json", "{}");
    });
    ESP_LOGI(TAG, "Grind-by-Sync endpoints registered");
}

void MahlkonigPlugin::registerWsHandlers(WebSocketHandler *ws) {
    if (ws == nullptr)
        return;
    ws->registerRequestHandler("req:mahlkonig:status", [this, ws](uint32_t clientId, JsonDocument &request) {
        JsonDocument resp(&psramAllocator);
        resp["tp"] = "res:mahlkonig:status";
        if (request["rid"].is<const char *>())
            resp["rid"] = request["rid"];
        {
            std::lock_guard<std::mutex> lock(mutex);
            const unsigned long now = millis();
            resp["connected"] = lastPollAt != 0 && now - lastPollAt < GRINDER_SEEN_MS;
            resp["phase"] = phaseName();
            JsonObject grind = resp["grind"].to<JsonObject>();
            grind["targetWeight"] = recipeWeight;
            grind["recipe"] = grindRecipe;
            grind["profileId"] = grindProfileId;
            JsonObject shot = resp["shot"].to<JsonObject>();
            shot["timeMs"] = extractionMs;
            shot["weight"] = shotWeight;
        }
        ws->sendJson(clientId, resp);
    });
}

void MahlkonigPlugin::sendJson(AsyncWebServerRequest *request, JsonDocument &doc) {
    AsyncResponseStream *response = request->beginResponseStream("application/json");
    serializeJson(doc, *response);
    request->send(response);
}

void MahlkonigPlugin::handleIdentity(AsyncWebServerRequest *request) {
    char serial[11];
    snprintf(serial, sizeof(serial), "%010lu", static_cast<unsigned long>(ESP.getEfuseMac() & 0xFFFFFFFFUL));
    JsonDocument doc(&psramAllocator);
    doc["MA_TYPE"] = gbs::XENIA_TYPE;
    doc["MA_SN"] = serial;
    doc["FW_VERSION_MAJOR"] = gbs::XENIA_FW_MAJOR;
    doc["FW_VERSION_MINOR"] = gbs::XENIA_FW_MINOR;
    doc["ESP_FW_MAJOR"] = gbs::XENIA_ESP_MAJOR;
    doc["ESP_FW_MINOR"] = gbs::XENIA_ESP_MINOR;
    sendJson(request, doc);
}

void MahlkonigPlugin::handleStatus(AsyncWebServerRequest *request) {
    const int mode = controller->getMode();
    const SystemState state = controller->getSystemState();
    // Outside brew mode the boiler may sit at steam/water temp; the grinder only cares about the brew setpoint
    const float setTemp =
        mode == MODE_BREW ? controller->getTargetTemp() : controller->getProfileManager()->getSelectedProfile().temperature;

    auto status = gbs::MachineState::Ready;
    int extraction = gbs::SHOT_IDLE;
    uint32_t timeMs;
    float volume;
    {
        std::lock_guard<std::mutex> lock(mutex);
        const unsigned long now = millis();
        lastPollAt = now;
        timeMs = extractionMs;
        volume = shotWeight;
        switch (phase) {
        case Phase::BREWING:
            status = gbs::MachineState::Brewing;
            extraction = gbs::SHOT_ACTIVE;
            timeMs = now - brewStartedAt;
            volume = 0.0f;
            break;
        case Phase::SETTLING:
            status = gbs::MachineState::Brewing;
            extraction = gbs::SHOT_ACTIVE;
            volume = 0.0f;
            break;
        case Phase::FINISHING:
            status = gbs::MachineState::ShotDone;
            extraction = gbs::SHOT_ACTIVE;
            break;
        case Phase::IDLE:
            if (state == SYSTEM_ERROR || state == SYSTEM_PROTOCOL_MISMATCH)
                status = gbs::MachineState::Error;
            else if (state == SYSTEM_UPDATING || state == SYSTEM_AUTOTUNING)
                status = gbs::MachineState::Service;
            else if (state != SYSTEM_READY || mode == MODE_STANDBY)
                status = gbs::MachineState::Standby;
            break;
        }
    }

    JsonDocument doc(&psramAllocator);
    doc["REAL_EXTRACTION_TIME_MS"] = timeMs;
    doc["PU_SENS_FLOW_METER_VOLUME"] = volume;
    doc["BG_SET_TEMP"] = setTemp;
    doc["BG_SENS_TEMP"] = controller->getCurrentTemp();
    // Same condition as GaggiMate's own water warning; without a level sensor the tank counts as full
    const bool tankEmpty = controller->getSystemInfo().capabilities.tof && controller->isLowWaterLevel();
    doc["TANK_LEVEL"] = tankEmpty ? gbs::WATER_EMPTY : gbs::WATER_OK;
    doc["script"] = "";
    doc["TIMESTAMP"] = "";
    doc["MA_EXTRACTION_STATUS"] = extraction;
    doc["MA_STATUS"] = static_cast<int>(status);
    sendJson(request, doc);
}

void MahlkonigPlugin::handleBrewRatioBody(const uint8_t *data, size_t len) {
    JsonDocument doc(&psramAllocator);
    if (deserializeJson(doc, data, len) != DeserializationError::Ok) {
        ESP_LOGW(TAG, "Unparsable grind result");
        return;
    }
    const int recipe = static_cast<int>(numberLike(doc[gbs::FIELD_RECIPE]));
    const String profileId = recipeProfile(recipe);
    if (profileId.isEmpty())
        ESP_LOGI(TAG, "No profile mapped to recipe %d, keeping the selected profile", recipe);
    const float weight = numberLike(doc[gbs::FIELD_TARGET_WEIGHT]);
    std::lock_guard<std::mutex> lock(mutex);
    recipeWeight = isUsable(weight) ? weight : 0.0f;
    grindRecipe = recipe;
    grindProfileId = profileId;
    pendingProfileId = profileId;
    pendingTargetWeight = recipeWeight;
}

void MahlkonigPlugin::handleExecuteBody(const uint8_t *data, size_t len) {
    JsonDocument doc(&psramAllocator);
    if (deserializeJson(doc, data, len) != DeserializationError::Ok) {
        ESP_LOGW(TAG, "Unparsable script request");
        return;
    }
    const int scriptId = static_cast<int>(numberLike(doc["ID"]));
    if (scriptId != gbs::GRINDER_START_SCRIPT) {
        ESP_LOGI(TAG, "Ignoring script %d", scriptId);
        return;
    }
    std::lock_guard<std::mutex> lock(mutex);
    // Repeats arrive while the shot runs; only an idle machine starts a new one
    if (phase != Phase::BREWING && phase != Phase::SETTLING)
        startRequested = true;
}

void MahlkonigPlugin::onBrewStart() {
    bool utility = true;
    {
        std::lock_guard<std::recursive_mutex> guard(controller->getProcessLock());
        Process *process = controller->getProcess();
        if (process != nullptr && process->getType() == MODE_BREW)
            utility = static_cast<BrewProcess *>(process)->isUtility();
    }
    if (utility)
        return;
    std::lock_guard<std::mutex> lock(mutex);
    const unsigned long now = millis();
    phase = Phase::BREWING;
    phaseSince = now;
    brewStartedAt = now;
    extractionMs = 0;
    shotWeight = 0.0f;
    savedShotId = 0;
    shotIsGrinderStarted = startRequestedAt != 0 && now - startRequestedAt < GRINDER_START_WINDOW_MS;
    startRequestedAt = 0;
}

void MahlkonigPlugin::onBrewEnd() {
    std::lock_guard<std::mutex> lock(mutex);
    if (phase != Phase::BREWING)
        return;
    const unsigned long now = millis();
    extractionMs = now - brewStartedAt;
    phase = Phase::SETTLING;
    phaseSince = now;
}

void MahlkonigPlugin::loop() {
    bool start;
    float targetWeight;
    String profileId;
    {
        std::lock_guard<std::mutex> lock(mutex);
        const unsigned long now = millis();
        start = startRequested && phase != Phase::BREWING && phase != Phase::SETTLING;
        startRequested = false;
        if (start)
            startRequestedAt = now;
        targetWeight = pendingTargetWeight;
        pendingTargetWeight = 0.0f;
        profileId = pendingProfileId;
        pendingProfileId = "";
        if (phase == Phase::SETTLING && (savedShotId != 0 || now - phaseSince > SETTLE_TIMEOUT_MS))
            finishShot(now);
        else if (phase == Phase::FINISHING && now - phaseSince > gbs::SHOT_DONE_VISIBLE_MS)
            phase = Phase::IDLE;
    }
    // Profile first, so the grinder's target weight lands on the recipe's profile
    if (!profileId.isEmpty())
        selectRecipeProfile(profileId);
    if (isUsable(targetWeight))
        applyTargetWeight(targetWeight);
    if (start)
        startRequestedBrew();
}

void MahlkonigPlugin::finishShot(unsigned long now) {
    float weight = 0.0f;
    if (savedShotId != 0) {
        ShotIndexEntry entry{};
        if (ShotHistory.readRecentEntries(&entry, 1) == 1 && entry.id == savedShotId)
            weight = entry.volume / 10.0f;
    }
    if (!isUsable(weight))
        weight = lastScaleWeight;
    if (!isUsable(weight))
        weight = controller->getCurrentCoffeeVolume();
    if (!isUsable(weight))
        weight = recipeWeight;
    shotWeight = isUsable(weight) ? weight : 0.0f;
    phase = Phase::FINISHING;
    phaseSince = now;
    ESP_LOGI(TAG, "Shot finished: %u ms, %.1f g%s", extractionMs, shotWeight,
             shotIsGrinderStarted ? "" : " (not started by grinder)");
}

void MahlkonigPlugin::startRequestedBrew() {
    if (controller->isActive() || controller->getSystemState() != SYSTEM_READY || controller->getMode() == MODE_STANDBY) {
        ESP_LOGW(TAG, "Grinder asked to start a brew, but the machine is not ready");
        return;
    }
    ESP_LOGI(TAG, "Grinder starts a brew");
    if (controller->getMode() != MODE_BREW)
        controller->setMode(MODE_BREW);
    controller->activate();
}

void MahlkonigPlugin::applyTargetWeight(float weight) {
    if (controller->isActive())
        return;
    Profile &profile = controller->getProfileManager()->getSelectedProfile();
    const float current = profile.getTotalVolume();
    if (!profile.isVolumetric() || current <= 0.0f) {
        ESP_LOGI(TAG, "Selected profile has no weight target, ignoring grinder target %.1f g", weight);
        return;
    }
    if (std::fabs(current - weight) < 0.05f)
        return;
    profile.adjustVolumetricTarget(weight - current);
    ESP_LOGI(TAG, "Target weight %.1f g -> %.1f g from grinder", current, profile.getTotalVolume());
    pluginManager->trigger("controller:targetVolume:change", "value", profile.getTotalVolume());
}

void MahlkonigPlugin::selectRecipeProfile(const String &profileId) {
    if (controller->isActive())
        return;
    ProfileManager *profileManager = controller->getProfileManager();
    if (profileManager->getSelectedProfile().id == profileId)
        return;
    if (!profileManager->profileExists(profileId)) {
        ESP_LOGW(TAG, "Profile %s mapped to a grinder recipe no longer exists", profileId.c_str());
        return;
    }
    ESP_LOGI(TAG, "Selecting profile %s for grinder recipe", profileId.c_str());
    profileManager->selectProfile(profileId);
}

String MahlkonigPlugin::recipeProfile(int recipe) const {
    if (recipe < 1)
        return "";
    const String profiles = controller->getSettings().getMahlkonigRecipeProfiles();
    int from = 0;
    for (int index = 1; from <= static_cast<int>(profiles.length()); index++) {
        int comma = profiles.indexOf(',', from);
        if (comma < 0)
            comma = profiles.length();
        if (index == recipe)
            return profiles.substring(from, comma);
        from = comma + 1;
    }
    return "";
}

const char *MahlkonigPlugin::phaseName() const {
    switch (phase) {
    case Phase::BREWING:
        return "brewing";
    case Phase::SETTLING:
        return "settling";
    case Phase::FINISHING:
        return "finishing";
    default:
        return "idle";
    }
}
