#ifndef PROFILE_H
#define PROFILE_H

#include <Arduino.h>
#include <ArduinoJson.h>

enum class TargetType { TARGET_TYPE_VOLUMETRIC, TARGET_TYPE_PRESSURE, TARGET_TYPE_FLOW, TARGET_TYPE_PUMPED };
enum class TargetOperator { LTE, GTE };
enum class PumpTarget {
    PUMP_TARGET_FLOW,
    PUMP_TARGET_PRESSURE,
};
enum class PhaseType { PHASE_TYPE_PREINFUSION, PHASE_TYPE_BREW };
enum class TransitionType { INSTANT, LINEAR, EASE_IN, EASE_OUT, EASE_IN_OUT };

struct Target {
    TargetType type;
    TargetOperator operator_;
    float value;

    bool isReached(float input) const {
        if (operator_ == TargetOperator::GTE) {
            return input >= value;
        }
        return input <= value;
    }
};

struct PumpAdvanced {
    PumpTarget target; // "pressure" | "flow"
    float pressure;
    float flow;
};

struct Transition {
    TransitionType type;
    float duration;
    bool adaptive;
};

struct Phase {
    String name;
    PhaseType phase; // "preinfusion" | "brew"
    int valve;       // 0 or 1
    float duration;
    bool pumpIsSimple;
    int pumpSimple; // Used if pumpIsSimple == true
    float temperature;
    Transition transition;
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

    bool isFinished(bool enableVolumetric, float volume, float time_in_phase, float current_flow, float current_pressure,
                    float water_pumped) const {
        for (const auto &target : targets) {
            switch (target.type) {
            case TargetType::TARGET_TYPE_VOLUMETRIC:
                if (enableVolumetric && target.isReached(volume)) {
                    return true;
                }
                break;
            case TargetType::TARGET_TYPE_PRESSURE:
                if (target.isReached(current_pressure)) {
                    return true;
                }
                break;
            case TargetType::TARGET_TYPE_FLOW:
                if (target.isReached(current_flow)) {
                    return true;
                }
                break;
            case TargetType::TARGET_TYPE_PUMPED:
                if (target.isReached(water_pumped)) {
                    return true;
                }
                break;
            }
        }
        return time_in_phase > duration;
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
        if (p["temperature"].is<float>()) {
            phase.temperature = p["temperature"].as<float>();
        } else {
            phase.temperature = 0.0f;
        }

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

        if (p["transition"].is<JsonObject>()) {
            auto transition = p["transition"].as<JsonObject>();
            phase.transition = Transition{};
            String type = transition["type"].as<String>();
            if (type == "ease-in-out") {
                phase.transition.type = TransitionType::EASE_IN_OUT;
            } else if (type == "linear") {
                phase.transition.type = TransitionType::LINEAR;
            } else if (type == "ease-in") {
                phase.transition.type = TransitionType::EASE_IN;
            } else if (type == "ease-out") {
                phase.transition.type = TransitionType::EASE_OUT;
            } else {
                phase.transition.type = TransitionType::INSTANT;
            }
            phase.transition.duration = transition["duration"].as<float>();
            phase.transition.adaptive = transition["adaptive"].as<bool>();
        } else {
            phase.transition = Transition{
                .type = TransitionType::INSTANT,
                .duration = 0,
                .adaptive = false,
            };
        }

        if (p["targets"].is<JsonArray>()) {
            auto targetsArray = p["targets"].as<JsonArray>();
            for (JsonObject t : targetsArray) {
                Target target{};
                auto type = t["type"].as<String>();
                if (type == "volumetric") {
                    target.type = TargetType::TARGET_TYPE_VOLUMETRIC;
                } else if (type == "pressure") {
                    target.type = TargetType::TARGET_TYPE_PRESSURE;
                } else if (type == "flow") {
                    target.type = TargetType::TARGET_TYPE_FLOW;
                } else if (type == "pumped") {
                    target.type = TargetType::TARGET_TYPE_PUMPED;
                } else {
                    continue;
                }
                if (t["operator"].is<String>()) {
                    target.operator_ = t["operator"].as<String>() == "gte" ? TargetOperator::GTE : TargetOperator::LTE;
                } else {
                    target.operator_ = TargetOperator::GTE;
                }
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
        p["temperature"] = phase.temperature;
        auto transition = p["transition"].to<JsonObject>();
        switch (phase.transition.type) {
        case TransitionType::LINEAR:
            transition["type"] = "linear";
            break;
        case TransitionType::EASE_IN:
            transition["type"] = "ease-in";
            break;
        case TransitionType::EASE_OUT:
            transition["type"] = "ease-out";
            break;
        case TransitionType::EASE_IN_OUT:
            transition["type"] = "ease-in-out";
            break;
        case TransitionType::INSTANT:
        default:
            transition["type"] = "instant";
            break;
        }
        transition["duration"] = phase.transition.duration;
        transition["adaptive"] = phase.transition.adaptive;

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
                switch (t.type) {
                case TargetType::TARGET_TYPE_VOLUMETRIC:
                    tObj["type"] = "volumetric";
                    break;
                case TargetType::TARGET_TYPE_PRESSURE:
                    tObj["type"] = "pressure";
                    break;
                case TargetType::TARGET_TYPE_FLOW:
                    tObj["type"] = "flow";
                    break;
                case TargetType::TARGET_TYPE_PUMPED:
                    tObj["type"] = "pumped";
                    break;
                default:
                    break;
                }
                tObj["operator"] = t.operator_ == TargetOperator::LTE ? "lte" : "gte";
                tObj["value"] = t.value;
            }
        }
    }
}

#endif // PROFILE_H
