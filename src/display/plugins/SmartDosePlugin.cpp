#include "SmartDosePlugin.h"
#include <cmath>
#include <display/core/Controller.h>
#include <display/core/Event.h>
#include <display/plugins/BLEScalePlugin.h>
#include <display/plugins/WebSocketHandler.h>
#include <display/util/PsramAllocator.h>

using namespace smartdose;
SmartDosePlugin SmartDose;
namespace {
Mode parseMode(const String &mode) {
    if (mode == "cup")
        return Mode::CUP;
    if (mode == "portafilter")
        return Mode::PORTAFILTER;
    if (mode == "automatic")
        return Mode::AUTOMATIC;
    return Mode::NONE;
}
const char *modeName(Mode mode) {
    switch (mode) {
    case Mode::CUP:
        return "cup";
    case Mode::PORTAFILTER:
        return "portafilter";
    case Mode::AUTOMATIC:
        return "automatic";
    default:
        return "none";
    }
}
} // namespace
void SmartDosePlugin::setup(Controller *c, PluginManager *pm) {
    controller = c;
    pm->on("controller:volumetric-measurement:bluetooth:change",
           [this](Event const &e) { measurement(e.getFloat("value"), false); });
    pm->on("controller:volumetric-measurement:hardware:change",
           [this](Event const &e) { measurement(e.getFloat("value"), true); });
    pm->on("webui:ws:register", [this](Event const &e) { registerWsHandlers(e.getPointer<WebSocketHandler>("ws")); });
    pm->on("webui:scale:tare", [this](Event const &) { onTare(true); });
}
void SmartDosePlugin::registerWsHandlers(WebSocketHandler *ws) {
    if (ws == nullptr)
        return;
    auto handle = [this, ws](const char *type, std::function<bool(JsonDocument &)> action) {
        ws->registerRequestHandler(String("req:") + type, [this, ws, type, action](uint32_t clientId, JsonDocument &request) {
            JsonDocument resp(&psramAllocator);
            resp["rid"] = request["rid"];
            resp["tp"] = String("res:") + type;
            resp["ok"] = action(request);
            status(resp["smartDose"].to<JsonObject>());
            ws->sendJson(clientId, resp);
        });
    };
    handle("smart-dose:set", [this](JsonDocument &) { return setDose(); });
    handle("smart-dose:adjust", [this](JsonDocument &request) {
        return request["direction"].is<int>() && adjustDose(request["direction"].as<int>());
    });
    handle("smart-dose:calibrate", [this](JsonDocument &request) { return calibrate(request["accessory"] | "cup"); });
    ws->registerStatusProvider([this](JsonDocument &doc) { status(doc["smartDose"].to<JsonObject>()); });
}
bool SmartDosePlugin::healthy(bool hardware) const {
    return hardware ? controller->isHardwareScaleHealthy() : controller->isBluetoothScaleHealthy();
}
bool SmartDosePlugin::canAdjustDose() const {
    return controller && controller->getSettings().isSmartDoseActive() && controller->getMode() == MODE_BREW &&
           !controller->isActive() && !controller->isUpdating() && !controller->isAutotuning() &&
           !controller->getProfileManager()->getSelectedProfile().utility;
}
bool SmartDosePlugin::skipDisabled() {
    if (!controller)
        return true;
    if (controller->getSettings().isSmartDoseActive())
        return false;
    std::lock_guard<std::recursive_mutex> lock(mutex);
    coordinator.cancel();
    tarePending = false;
    return true;
}
void SmartDosePlugin::sync() {
    auto &settings = controller->getSettings();
    Config config;
    config.automatic = settings.isSmartDoseAutomagic();
    config.cupEnabled = settings.isDosingCupEnabled();
    config.pfEnabled = settings.isPortafilterEnabled();
    config.cupHardware = settings.getSmartDoseScale() == "hardware";
    config.pfHardware = settings.getPortafilterScale() == "hardware";
    config.cup = settings.getDosingCupWeight();
    config.pf = settings.getPortafilterWeight();
    config.preference = parseMode(settings.getSmartDoseMode());
    // Machines without hardware-scale capability always use Bluetooth.
    if (!controller->getSystemInfo().capabilities.hwScale) {
        config.cupHardware = false;
        config.pfHardware = false;
    }
    auto &profile = controller->getProfileManager()->getSelectedProfile();
    if (!(coordinator.config == config) || profileId != profile.id || !canAdjustDose()) {
        coordinator.cancel();
        tarePending = false;
    }
    coordinator.configure(config);
    profileId = profile.id;
    coordinator.tick(millis(), canAdjustDose(), healthy(false), healthy(true));
}
bool SmartDosePlugin::portafilterSelected() const { return coordinator.owner == Accessory::PORTAFILTER; }
bool SmartDosePlugin::selectedHardware() const {
    if (coordinator.owner != Accessory::NONE)
        return coordinator.ownerHardware;
    return controller->getSystemInfo().capabilities.hwScale && controller->getSettings().getManualDoseScale() == "hardware";
}
float SmartDosePlugin::doseWeight() const {
    float gross = coordinator.readings[selectedHardware()].weight;
    return portafilterSelected() ? gross - coordinator.readings[selectedHardware()].baseline - coordinator.config.pf : gross;
}
bool SmartDosePlugin::available() const {
    const auto &r = coordinator.readings[selectedHardware()];
    if (!canAdjustDose() || !healthy(selectedHardware()) || !r.fresh(millis()) || !validDose(doseWeight()))
        return false;
    if (coordinator.phase == smartdose::Phase::TARING || coordinator.phase == smartdose::Phase::REMOVING)
        return false;
    return r.stable(millis());
}
void SmartDosePlugin::apply(const Action &action) {
    if (action.tare)
        tarePending = true;
    if (action.capture && validDose(action.dose)) {
        controller->getProfileManager()->getSelectedProfile().dose = std::round(action.dose * 10) / 10;
    }
}
void SmartDosePlugin::measurement(float value, bool hardware) {
    if (skipDisabled())
        return;
    // All entry points use process -> plugin; the first serialized valid event wins.
    std::scoped_lock lock(controller->getProcessLock(), mutex);
    auto &live = liveReadings[hardware];
    live.weight = value;
    live.last = millis();
    live.present = std::isfinite(value);
    sync();
    if (!canAdjustDose() || !healthy(hardware))
        return;
    apply(coordinator.sample(value, hardware, millis()));
}
void SmartDosePlugin::loop() {
    if (skipDisabled())
        return;
    std::scoped_lock lock(controller->getProcessLock(), mutex);
    sync();
    if (tarePending && coordinator.owner == Accessory::CUP && coordinator.phase == smartdose::Phase::TARING) {
        tarePending = false;
        coordinator.tareIssued = true;
        if (coordinator.ownerHardware)
            controller->getClientController()->tare();
        else
            BLEScales.tare();
    } else
        tarePending = false;
}
bool SmartDosePlugin::setDose() {
    if (skipDisabled())
        return false;
    std::scoped_lock lock(controller->getProcessLock(), mutex);
    sync();
    if (!available())
        return false;
    const float value = doseWeight();
    coordinator.cancel();
    tarePending = false;
    controller->getProfileManager()->getSelectedProfile().dose = std::round(value * 10) / 10;
    return true;
}
bool SmartDosePlugin::adjustDose(int direction) {
    if (!controller || (direction != -1 && direction != 1))
        return false;
    std::scoped_lock lock(controller->getProcessLock(), mutex);
    sync();
    if (!canAdjustDose())
        return false;
    auto &profile = controller->getProfileManager()->getSelectedProfile();
    const float current = profile.dose;
    const float next = validDose(current) ? (direction > 0 ? std::floor(current * 2) + 1 : std::ceil(current * 2) - 1) / 2 : 5.0f;
    if (!validDose(next))
        return false;
    coordinator.cancel();
    profile.dose = next;
    return true;
}
bool SmartDosePlugin::calibrate(const String &accessory) {
    if (skipDisabled() || (accessory != "cup" && accessory != "portafilter"))
        return false;
    std::scoped_lock lock(controller->getProcessLock(), mutex);
    sync();
    const auto requested = accessory == "cup" ? Accessory::CUP : Accessory::PORTAFILTER;
    // The user tares the empty scale and places the accessory before saving.
    // Automagic must be off so it cannot tare the object during measurement.
    if (coordinator.config.automatic)
        return false;
    const bool hardware = requested == Accessory::CUP ? coordinator.config.cupHardware : coordinator.config.pfHardware;
    const auto &r = coordinator.readings[hardware];
    if (!canAdjustDose() || !healthy(hardware) || !r.stable(millis()) || r.weight <= 0 || r.weight > 2000)
        return false;
    auto &settings = controller->getSettings();
    if (requested == Accessory::CUP)
        settings.setDosingCupWeight(std::round(r.weight * 10) / 10);
    else
        settings.setPortafilterWeight(std::round(r.weight * 10) / 10);
    settings.save(true);
    coordinator.cancel();
    return true;
}
void SmartDosePlugin::cancelCycle() {
    if (!controller)
        return;
    std::scoped_lock lock(controller->getProcessLock(), mutex);
    tarePending = false;
    coordinator.cancel();
}
void SmartDosePlugin::onTare(bool hardware) {
    if (!controller)
        return;
    std::scoped_lock lock(controller->getProcessLock(), mutex);
    if (coordinator.owner == Accessory::NONE || coordinator.ownerHardware == hardware)
        cancelCycle();
    // An explicit tare changes this scale's coordinate system. Non-owner tares
    // must not cancel or alter the active owner's cycle.
    coordinator.readings[hardware] = Reading{};
    liveReadings[hardware] = LiveReading{};
}
void SmartDosePlugin::status(JsonObject out) {
    out.clear();
    if (skipDisabled()) {
        out["enabled"] = false;
        out["connected"] = false;
        out["available"] = false;
        out["blinking"] = false;
        out["adjustable"] = false;
        return;
    }
    std::scoped_lock lock(controller->getProcessLock(), mutex);
    sync();
    const auto &config = coordinator.config;
    const auto &r = coordinator.readings[selectedHardware()];
    const bool ready = canAdjustDose() && healthy(selectedHardware()) && r.fresh(millis());
    out["enabled"] = true;
    out["connected"] = ready;
    out["weight"] = ready ? doseWeight() : 0;
    out["gross"] = ready ? r.weight - r.baseline : 0;
    out["doseIn"] = controller->getProfileManager()->getSelectedProfile().dose;
    out["adjustable"] = canAdjustDose();
    out["available"] = available();
    out["blinking"] = coordinator.owner != Accessory::NONE && !available();
    out["cupWeight"] = config.cup;
    out["portafilterWeight"] = config.pf;
    out["source"] = selectedHardware() ? "hardware" : "bluetooth";
    out["accessory"] = coordinator.owner == Accessory::NONE ? "manual" : portafilterSelected() ? "portafilter" : "cup";
    const bool manualHardware =
        controller->getSystemInfo().capabilities.hwScale && controller->getSettings().getManualDoseScale() == "hardware";
    out["manualSource"] = manualHardware ? "hardware" : "bluetooth";
    out["owner"] = coordinator.owner == Accessory::CUP           ? "cup"
                   : coordinator.owner == Accessory::PORTAFILTER ? "portafilter"
                                                                 : "none";
    out["phase"] = coordinator.phase == smartdose::Phase::TARING     ? "taring"
                   : coordinator.phase == smartdose::Phase::FILLING  ? "filling"
                   : coordinator.phase == smartdose::Phase::REMOVING ? "removing"
                   : coordinator.phase == smartdose::Phase::READY    ? "ready"
                                                                     : "idle";
    out["mode"] = modeName(config.mode());
    out["modePreference"] = controller->getSettings().getSmartDoseMode();
    out["automaticAvailable"] = config.autoReady();
    out["cupConfigured"] = config.cupReady();
    out["portafilterConfigured"] = config.pfReady();
    out["automagic"] = config.automatic;

    // Keep live presentation separate from the coordinator's stable capture
    // candidate, including the other scale while one accessory owns a cycle.
    const uint32_t now = millis();
    auto writeMeasurement = [&](const char *key, bool hardware, bool portafilter) {
        const auto &live = liveReadings[hardware];
        const bool connected = live.present && healthy(hardware) && now - live.last < READING_STALE_MS;
        const float gross = live.weight - coordinator.readings[hardware].baseline;
        auto measurement = out[key].to<JsonObject>();
        measurement["source"] = hardware ? "hardware" : "bluetooth";
        measurement["connected"] = connected;
        measurement["calibration"] = portafilter ? config.pf : config.cup;
        measurement["manual"] = hardware == manualHardware;
        if (connected) {
            measurement["gross"] = gross;
            measurement["raw"] = live.weight;
            measurement["weight"] = portafilter ? gross - config.pf : live.weight;
        }
    };
    writeMeasurement("manual", manualHardware, false);
    if (config.cupReady())
        writeMeasurement("cup", config.cupHardware, false);
    if (config.pfReady())
        writeMeasurement("portafilter", config.pfHardware, true);
    out["stable"] = r.stable(now) && validDose(doseWeight());
}

SmartDosePlugin::DoseUIState SmartDosePlugin::getUIState() {
    DoseUIState result;
    if (skipDisabled())
        return result;
    std::scoped_lock lock(controller->getProcessLock(), mutex);
    sync();
    if (!canAdjustDose())
        return result;
    result.available = available();
    if (coordinator.owner == Accessory::CUP)
        result.state = 1;
    else if (coordinator.owner == Accessory::PORTAFILTER)
        result.state = 3;
    else if (result.available)
        result.state = 2;
    result.blinking = (result.state == 1 || result.state == 3) && !result.available;
    const auto &reading = coordinator.readings[selectedHardware()];
    if (result.state != 0 && healthy(selectedHardware()) && reading.fresh(millis()))
        result.weight = doseWeight();
    return result;
}
