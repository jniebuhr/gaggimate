#ifndef AUTOSLEEPMANAGER_H
#define AUTOSLEEPMANAGER_H

#include <cstdint>

#include "constants.h"

// [display-auto-sleep] Display-only policy deciding when the screen should enter
// deep sleep because the GaggiMate Controller (PCB) has been unreachable over BLE
// for too long. This is pure logic with NO hardware access and NO BLE/controller
// writes, so it also compiles and runs in the simulator and is easy to reason about.
//
// The only sleep reason is "no controller for N ms". Touch resets the UI idle timer
// but never blocks the no-controller countdown (matches the spec). Sleep is also
// suppressed while OTA / firmware update / Wi-Fi setup / web flows are in progress.
class AutoSleepManager {
  public:
    enum class SleepReason { None, NoController };

    void setEnabled(bool enabled) { enabled_ = enabled; }
    bool isEnabled() const { return enabled_; }

    void setTimeoutMs(uint32_t timeoutMs) { timeoutMs_ = timeoutMs; }
    uint32_t timeoutMs() const { return timeoutMs_; }

    // Temporarily block sleeping (OTA / update / Wi-Fi AP setup / web management).
    void setSuppressed(bool suppressed) { suppressed_ = suppressed; }
    bool isSuppressed() const { return suppressed_; }

    // When true and the controller is absent, sleep after a quarter of the timeout
    // (used when the battery is critically low). Display-only behaviour.
    void setForceShortTimeout(bool force) { forceShortTimeout_ = force; }

    bool isControllerConnected() const { return controllerConnected_; }
    uint32_t controllerDisconnectedSince() const { return controllerDisconnectedSince_; }

    // Begin with no connection yet (start the countdown at boot).
    void begin(uint32_t now) {
        controllerConnected_ = false;
        controllerDisconnectedSince_ = now ? now : 1; // 0 means "not counting"
        lastUserInteractionAt_ = now;
    }

    void onControllerConnected(uint32_t now) {
        controllerConnected_ = true;
        lastControllerConnectedAt_ = now;
        controllerDisconnectedSince_ = 0; // cancel the countdown
    }

    void onControllerDisconnected(uint32_t now) {
        // Only (re)start the countdown on a real transition, so repeated
        // "waiting" events don't keep pushing the deadline forward.
        if (controllerConnected_ || controllerDisconnectedSince_ == 0) {
            controllerDisconnectedSince_ = now ? now : 1;
        }
        controllerConnected_ = false;
    }

    // Resets the UI idle timer only; does NOT block no-controller sleep.
    void onUserInteraction(uint32_t now) { lastUserInteractionAt_ = now; }
    uint32_t lastUserInteractionAt() const { return lastUserInteractionAt_; }

    // Returns why the display should sleep right now, or None.
    SleepReason evaluate(uint32_t now) const {
        if (!enabled_ || suppressed_ || controllerConnected_ || controllerDisconnectedSince_ == 0) {
            return SleepReason::None;
        }
        const uint32_t timeout = forceShortTimeout_ ? (timeoutMs_ / 4) : timeoutMs_;
        if (now - controllerDisconnectedSince_ >= timeout) {
            return SleepReason::NoController;
        }
        return SleepReason::None;
    }

    static const char *reasonName(SleepReason r) {
        switch (r) {
        case SleepReason::NoController:
            return "NO_CONTROLLER";
        default:
            return "NONE";
        }
    }

  private:
    bool enabled_ = DEFAULT_AUTO_SLEEP_NO_CONTROLLER;
    bool suppressed_ = false;
    bool forceShortTimeout_ = false;
    bool controllerConnected_ = false;
    uint32_t timeoutMs_ = DEFAULT_NO_CONTROLLER_SLEEP_TIMEOUT_MS;
    uint32_t controllerDisconnectedSince_ = 0;
    uint32_t lastControllerConnectedAt_ = 0;
    uint32_t lastUserInteractionAt_ = 0;
};

#endif // AUTOSLEEPMANAGER_H
