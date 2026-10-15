#ifndef MUSELINES_H
#define MUSELINES_H

#include <cstdint>

// Display states the Muse avatar can be in. Determined solely from existing
// machine state (mode, process, temperature, warnings) by MuseAvatarPlugin.
enum class MuseAvatarState : uint8_t {
    HIDDEN = 0,   // menu/info screens, or avatar disabled
    SLEEP,        // standby mode: machine idle/off, screen dimmed
    HEATING,      // awake but boiler below target temperature
    READY,        // awake, at temperature, waiting for the user
    BREWING,      // brew process running (first 25 s)
    BREWING_LATE, // brew process running past 25 s
    STEAMING,     // steam process/mode active
    DONE,         // a brew just finished (shown for ~10 s)
    WARNING,      // a warning/error is active; highest priority
};

// Line-source abstraction (REQUIREMENTS.md §5): the avatar only ever talks to
// this interface. Phase 1 ships the local table below; a Phase 2 bridge can
// provide generated lines by implementing the same interface, without any
// change to the rendering or state code.
class MuseLineSource {
  public:
    virtual ~MuseLineSource() = default;

    // Returns the `rotation`-th line for a state. Implementations must return
    // lines of at most 40 characters so the bubble never wraps past one line.
    // `rotation` increases monotonically; the caller varies it over time and
    // guarantees it does not repeat the previous value back-to-back.
    virtual const char *getLine(MuseAvatarState state, uint32_t rotation) = 0;
};

// Phase 1 line source: static, local line tables (English — the firmware UI
// is English-only and the stock LVGL fonts carry no CJK glyphs, see
// REQUIREMENTS.md §4.4).
class LocalMuseLineSource : public MuseLineSource {
  public:
    const char *getLine(MuseAvatarState state, uint32_t rotation) override;
};

// The default (and currently only) line source instance.
extern LocalMuseLineSource museLocalLines;

#endif // MUSELINES_H
