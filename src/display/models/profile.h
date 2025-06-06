#ifndef PROFILE_H
#define PROFILE_H

#include <Arduino.h>
#include <ArduinoJson.h>

enum class TargetType { TARGET_TYPE_VOLUMETRIC, TARGET_TYPE_PRESSURE };

struct Target {
    TargetType type;
    float value;
};

enum class PumpTarget { PUMP_TARGET_PRESSURE, PUMP_TARGET_FLOW };

struct PumpAdvanced {
    PumpTarget target; // "pressure" | "flow"
    float pressure;
    float flow;
};

enum class PhaseType { PHASE_TYPE_PREINFUSION, PHASE_TYPE_BREW };

struct Phase {
    String name;
    PhaseType phase; // "preinfusion" | "brew"
    int valve;       // 0 or 1
    float duration;
    bool pumpIsSimple;
    int pumpSimple; // Used if pumpIsSimple == true
    PumpAdvanced pumpAdvanced;
    std::vector<Target> targets;

    bool hasVolumetricTarget() const {
        for (const auto &target : targets) {
            if (target.type == TargetType::TARGET_TYPE_VOLUMETRIC && target.value > 0.0f) {
                return true;
            }
        }
        return false;
    }

    Target getVolumetricTarget() const {
        for (const auto &target : targets) {
            if (target.type == TargetType::TARGET_TYPE_VOLUMETRIC) {
                return target;
            }
        }
        return Target{};
    }
};

struct Profile {
    String id;
    String label;
    String type; // "standard" | "pro"
    String description;
    float temperature;
    bool favorite = false;
    bool selected = false;
    std::vector<Phase> phases;

    unsigned int getPhaseCount() const {
        int brew = 0;
        int preinfusion = 0;
        for (const auto &phase : phases) {
            if (phase.phase == PhaseType::PHASE_TYPE_BREW) {
                brew = 1;
            } else {
                preinfusion = 1;
            }
        }
        return brew + preinfusion;
    }

    unsigned long getTotalDuration() const {
        unsigned long duration = 0;
        for (const auto &phase : phases) {
            duration += phase.duration;
        }
        return duration;
    }
};

inline bool parseProfile(const JsonObject &obj, Profile &profile) {
    if (obj["id"].is<String>())
        profile.id = obj["id"].as<String>();
    profile.label = obj["label"].as<String>();
    profile.type = obj["type"].as<String>();
    profile.description = obj["description"].as<String>();
    profile.temperature = obj["temperature"].as<float>();
    profile.favorite = obj["favorite"] | false;
    profile.selected = obj["selected"] | false;

    auto phasesArray = obj["phases"].as<JsonArray>();
    for (JsonObject p : phasesArray) {
        Phase phase;
        phase.name = p["name"].as<String>();
        phase.phase = p["phase"].as<String>() == "preinfusion" ? PhaseType::PHASE_TYPE_PREINFUSION : PhaseType::PHASE_TYPE_BREW;
        phase.valve = p["valve"].as<int>();
        phase.duration = p["duration"].as<float>();

        if (p["pump"].is<int>()) {
            phase.pumpIsSimple = true;
            phase.pumpSimple = p["pump"].as<int>();
        } else {
            phase.pumpIsSimple = false;
            auto pump = p["pump"].as<JsonObject>();
            phase.pumpAdvanced.target =
                pump["target"].as<String>() == "pressure" ? PumpTarget::PUMP_TARGET_PRESSURE : PumpTarget::PUMP_TARGET_FLOW;
            phase.pumpAdvanced.pressure = pump["pressure"].as<float>();
            phase.pumpAdvanced.flow = pump["flow"].as<float>();
        }

        if (p["targets"].is<JsonArray>()) {
            auto targetsArray = p["targets"].as<JsonArray>();
            for (JsonObject t : targetsArray) {
                Target target{};
                target.type = t["type"].as<String>() == "volumetric" ? TargetType::TARGET_TYPE_VOLUMETRIC
                                                                     : TargetType::TARGET_TYPE_PRESSURE;
                target.value = t["value"].as<float>();
                phase.targets.push_back(target);
            }
        }

        profile.phases.push_back(phase);
    }

    return true;
}

inline void writeProfile(JsonObject &obj, const Profile &profile) {
    obj["id"] = profile.id;
    obj["label"] = profile.label;
    obj["type"] = profile.type;
    obj["description"] = profile.description;
    obj["temperature"] = profile.temperature;
    obj["favorite"] = profile.favorite;
    obj["selected"] = profile.selected;

    auto phasesArray = obj["phases"].to<JsonArray>();
    for (const Phase &phase : profile.phases) {
        auto p = phasesArray.add<JsonObject>();
        p["name"] = phase.name;
        p["phase"] = phase.phase == PhaseType::PHASE_TYPE_PREINFUSION ? "preinfusion" : "brew";
        p["valve"] = phase.valve;
        p["duration"] = phase.duration;

        if (phase.pumpIsSimple) {
            p["pump"] = phase.pumpSimple;
        } else {
            auto pump = p["pump"].to<JsonObject>();
            pump["target"] = phase.pumpAdvanced.target == PumpTarget::PUMP_TARGET_PRESSURE ? "pressure" : "flow";
            pump["pressure"] = phase.pumpAdvanced.pressure;
            pump["flow"] = phase.pumpAdvanced.flow;
        }

        if (!phase.targets.empty()) {
            JsonArray targets = p["targets"].to<JsonArray>();
            for (const Target &t : phase.targets) {
                auto tObj = targets.add<JsonObject>();
                tObj["type"] = t.type == TargetType::TARGET_TYPE_VOLUMETRIC ? "volumetric" : "pressure";
                tObj["value"] = t.value;
            }
        }
    }
}

#endif // PROFILE_H
