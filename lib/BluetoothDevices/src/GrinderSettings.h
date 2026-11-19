#pragma once
#include <cstdint>

// Grinder parameters a recipe can carry; a negative value means "not set" and is left untouched on the grinder.
struct GrinderSettings {
    float grindSize = -1.0f; // grinder-specific unit, e.g. burr gap in µm
    int rpm = -1;            // burr speed
    int feedRpm = -1;        // bean feed speed

    bool hasGrindSize() const { return grindSize >= 0.0f; }
    bool hasRpm() const { return rpm >= 0; }
    bool hasFeedRpm() const { return feedRpm >= 0; }
    bool isEmpty() const { return !hasGrindSize() && !hasRpm() && !hasFeedRpm(); }

    bool operator==(const GrinderSettings &other) const {
        return grindSize == other.grindSize && rpm == other.rpm && feedRpm == other.feedRpm;
    }
    bool operator!=(const GrinderSettings &other) const { return !(*this == other); }
};

// BUSY covers every state in which the grinder is neither idle nor grinding (settings menu, cleaning, update, ...).
enum class GrinderState : uint8_t { UNKNOWN = 0, IDLE = 1, GRINDING = 2, BUSY = 3 };

inline const char *grinderStateName(GrinderState state) {
    switch (state) {
    case GrinderState::IDLE:
        return "idle";
    case GrinderState::GRINDING:
        return "grinding";
    case GrinderState::BUSY:
        return "busy";
    case GrinderState::UNKNOWN:
    default:
        return "unknown";
    }
}
