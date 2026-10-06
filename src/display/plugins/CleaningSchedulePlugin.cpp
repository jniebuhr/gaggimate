#include "CleaningSchedulePlugin.h"
#include <display/core/Controller.h>
#include <display/core/ProfileManager.h>
#include <display/core/process/BrewProcess.h>
#include <display/plugins/WebSocketHandler.h>
#include <time.h>

namespace {
constexpr unsigned long CHECK_INTERVAL_MS = 60000;
constexpr unsigned long SECONDS_PER_DAY = 24UL * 60UL * 60UL;
constexpr time_t MIN_VALID_TIME = 1700000000; // before this the clock has not been synced yet

unsigned long nowSeconds() {
    const time_t now = time(nullptr);
    return now >= MIN_VALID_TIME ? static_cast<unsigned long>(now) : 0;
}

bool isDue(unsigned long lastTime, unsigned long intervalSeconds, int shotsSince, int intervalShots) {
    if (intervalShots > 0 && shotsSince >= intervalShots)
        return true;
    const unsigned long now = nowSeconds();
    return intervalSeconds > 0 && lastTime > 0 && now > lastTime && now - lastTime >= intervalSeconds;
}
} // namespace

void CleaningSchedulePlugin::setup(Controller *controller, PluginManager *pluginManager) {
    this->controller = controller;
    this->pluginManager = pluginManager;

    pluginManager->on("webui:ws:register",
                      [this](Event const &event) { registerWsHandlers(event.getPointer<WebSocketHandler>("ws")); });
    pluginManager->on("controller:brew:end", [this](Event const &) { onBrewEnd(); });
}

void CleaningSchedulePlugin::registerWsHandlers(WebSocketHandler *ws) {
    if (ws == nullptr)
        return;
    auto reply = [ws](uint32_t clientId, JsonDocument &request, const char *type, bool success) {
        JsonDocument resp;
        resp["tp"] = type;
        resp["rid"] = request["rid"];
        resp["success"] = success;
        ws->sendJson(clientId, resp);
    };
    ws->registerRequestHandler("req:cleaning:backflush:start", [this, reply](uint32_t clientId, JsonDocument &request) {
        reply(clientId, request, "res:cleaning:backflush:start", startCleaning(BACKFLUSH_PROFILE_ID));
    });
    ws->registerRequestHandler("req:cleaning:descaling:start", [this, reply](uint32_t clientId, JsonDocument &request) {
        reply(clientId, request, "res:cleaning:descaling:start", startCleaning(DESCALING_PROFILE_ID));
    });
    ws->registerRequestHandler("req:cleaning:backflush:complete", [this, reply](uint32_t clientId, JsonDocument &request) {
        completeBackflush();
        reply(clientId, request, "res:cleaning:backflush:complete", true);
    });
    ws->registerRequestHandler("req:cleaning:descaling:complete", [this, reply](uint32_t clientId, JsonDocument &request) {
        completeDescaling();
        reply(clientId, request, "res:cleaning:descaling:complete", true);
    });
}

// Start the schedules once the clock is synced and pull future timestamps (clock moved back) to now.
void CleaningSchedulePlugin::loop() {
    const unsigned long nowMs = millis();
    if (lastCheck != 0 && nowMs - lastCheck < CHECK_INTERVAL_MS)
        return;
    lastCheck = nowMs;
    const unsigned long now = nowSeconds();
    if (now == 0)
        return;
    Settings &settings = controller->getSettings();
    if (settings.getLastBackflushTime() == 0 || settings.getLastBackflushTime() > now)
        settings.setLastBackflushTime(now);
    if (settings.getLastDescalingTime() == 0 || settings.getLastDescalingTime() > now)
        settings.setLastDescalingTime(now);
}

bool CleaningSchedulePlugin::isBackflushDue(const Settings &settings) {
    return isDue(settings.getLastBackflushTime(), settings.getBackflushIntervalDays() * SECONDS_PER_DAY,
                 settings.getShotsSinceBackflush(), settings.getBackflushIntervalShots());
}

bool CleaningSchedulePlugin::isDescalingDue(const Settings &settings) {
    return isDue(settings.getLastDescalingTime(), settings.getDescalingIntervalWeeks() * 7 * SECONDS_PER_DAY,
                 settings.getShotsSinceDescaling(), settings.getDescalingIntervalShots());
}

// Selects the cleaning profile and starts it; error-level warnings still go through the brew confirmation.
bool CleaningSchedulePlugin::startCleaning(const char *profileId) {
    if (controller->isActive())
        return false;
    ESP_LOGI("CleaningSchedulePlugin", "Starting cleaning profile %s", profileId);
    controller->getProfileManager()->selectProfile(profileId);
    controller->setMode(MODE_BREW);
    controller->activate();
    return true;
}

void CleaningSchedulePlugin::completeBackflush() {
    Settings &settings = controller->getSettings();
    settings.setLastBackflushTime(nowSeconds());
    settings.setShotsSinceBackflush(0);
    ESP_LOGI("CleaningSchedulePlugin", "Backflush completed");
}

void CleaningSchedulePlugin::completeDescaling() {
    Settings &settings = controller->getSettings();
    settings.setLastDescalingTime(nowSeconds());
    settings.setShotsSinceDescaling(0);
    ESP_LOGI("CleaningSchedulePlugin", "Descaling completed");
}

// A finished cleaning profile resets its schedule; every other non-utility brew counts as a shot.
void CleaningSchedulePlugin::onBrewEnd() {
    String profileId;
    bool finished = false;
    bool utility = false;
    {
        std::lock_guard<std::recursive_mutex> guard(controller->getProcessLock());
        Process *last = controller->getLastProcess();
        if (last == nullptr || last->getType() != MODE_BREW)
            return;
        auto *brew = static_cast<BrewProcess *>(last);
        profileId = brew->profile.id;
        finished = brew->processPhase == ProcessPhase::FINISHED;
        utility = brew->isUtility();
    }
    if (profileId == BACKFLUSH_PROFILE_ID) {
        if (finished)
            completeBackflush();
    } else if (profileId == DESCALING_PROFILE_ID) {
        if (finished)
            completeDescaling();
    } else if (!utility) {
        Settings &settings = controller->getSettings();
        settings.setShotsSinceBackflush(settings.getShotsSinceBackflush() + 1);
        settings.setShotsSinceDescaling(settings.getShotsSinceDescaling() + 1);
    }
}
