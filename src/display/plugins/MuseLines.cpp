#include "MuseLines.h"

LocalMuseLineSource museLocalLines;

namespace {
// 3-5 short lines per state, each <= 40 characters (bubble budget, §4.1).
const char *const HEATING_LINES[] = {
    "Warming up, almost there",
    "Getting nice and hot",
    "Heating up for you",
    "Just a moment longer",
};
const char *const READY_LINES[] = {
    "Ready when you are",
    "All warmed up and waiting",
    "Let's pull a great shot",
    "At temperature, standing by",
};
const char *const BREWING_LINES[] = {
    "Steady... looking good",
    "Extracting, stay with it",
    "Nice and even so far",
};
const char *const BREWING_LATE_LINES[] = {
    "Almost there, hang on",
    "Deep into the shot now",
    "This one's going long",
};
const char *const STEAMING_LINES[] = {
    "Full steam ahead!",
    "Careful, it's hot",
    "Steam power maxed out",
};
const char *const DONE_LINES[] = {
    "Done! Enjoy your coffee",
    "Fresh shot, ready to drink",
    "That smelled amazing",
};

const char *pick(const char *const *lines, uint32_t count, uint32_t rotation) { return lines[rotation % count]; }
} // namespace

const char *LocalMuseLineSource::getLine(MuseAvatarState state, uint32_t rotation) {
    switch (state) {
    case MuseAvatarState::HEATING:
        return pick(HEATING_LINES, sizeof(HEATING_LINES) / sizeof(HEATING_LINES[0]), rotation);
    case MuseAvatarState::READY:
        return pick(READY_LINES, sizeof(READY_LINES) / sizeof(READY_LINES[0]), rotation);
    case MuseAvatarState::BREWING:
        return pick(BREWING_LINES, sizeof(BREWING_LINES) / sizeof(BREWING_LINES[0]), rotation);
    case MuseAvatarState::BREWING_LATE:
        return pick(BREWING_LATE_LINES, sizeof(BREWING_LATE_LINES) / sizeof(BREWING_LATE_LINES[0]), rotation);
    case MuseAvatarState::STEAMING:
        return pick(STEAMING_LINES, sizeof(STEAMING_LINES) / sizeof(STEAMING_LINES[0]), rotation);
    case MuseAvatarState::DONE:
        return pick(DONE_LINES, sizeof(DONE_LINES) / sizeof(DONE_LINES[0]), rotation);
    case MuseAvatarState::SLEEP:
    case MuseAvatarState::WARNING: // warning bubble text comes from WarningManager labels, not this table
    case MuseAvatarState::HIDDEN:
    default:
        return "";
    }
}
