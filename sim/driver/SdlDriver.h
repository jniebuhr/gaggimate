// Desktop screen driver: an SDL2 window standing in for the device panel, wired
// into LVGL as the display + pointer (mouse) input device. Implements the same
// Driver interface the hardware panels use.
#pragma once

#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <display/drivers/Driver.h>

class SdlDriver : public Driver {
  public:
    bool isCompatible() override { return true; }
    void init() override; // SDL_Init + window + LVGL display/indev registration
    void setBrightness(int) override {}
    bool supportsSDCard() override { return false; }
    bool installSDCard() override { return false; }

    // [display-auto-sleep] The simulator must never really sleep/exit; just record
    // the event so auto-sleep behaviour can be exercised on the desktop.
    void sleep() override { printf("[sim] AutoSleep: enterDisplaySleep() (mock, not sleeping)\n"); }

    // [display-battery] Mock battery for the simulator. Defaults to 3900 mV; override
    // with the GM_SIM_BATTERY_MV environment variable (e.g. 4200 / 3700 / 3400).
    bool hasBattery() override { return true; }
    uint16_t getBatteryMilliVolts() override {
        const char *mv = getenv("GM_SIM_BATTERY_MV");
        if (mv == nullptr) {
            return 3900;
        }
        // Validate: a bare atoi()+cast would wrap invalid input (e.g. "-1" -> 65535),
        // which distorts the simulated battery %. Reject non-numeric/out-of-range.
        char *end = nullptr;
        const long parsed = strtol(mv, &end, 10);
        if (end == mv || *end != '\0' || parsed < 0 || parsed > 5000) {
            return 3900;
        }
        return static_cast<uint16_t>(parsed);
    }

    static SdlDriver *getInstance() {
        if (instance == nullptr)
            instance = new SdlDriver();
        return instance;
    }

    // Driven from the simulator main loop (main thread).
    void pumpAndRender(); // poll SDL events + present the LVGL framebuffer
    bool shouldQuit() const;
    void screenshot(const char *path); // writes a BMP of the current frame

  private:
    static SdlDriver *instance;
    SdlDriver() = default;
};
