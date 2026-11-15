// Desktop screen driver: an SDL2 window standing in for the device panel, wired
// into LVGL as the display + pointer (mouse) input device. Implements the same
// Driver interface the hardware panels use.
#pragma once

#include <display/drivers/Driver.h>

class SdlDriver : public Driver {
  public:
    bool isCompatible() override { return true; }
    void init() override; // SDL_Init + window + LVGL display/indev registration
    void setBrightness(int) override {}
    bool supportsSDCard() override { return true; } // mounts only with GAGGIMATE_SIM_SD=1 (see sim/platform/SD_MMC.h)
    bool installSDCard() override;

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

// Simulated Bluetooth scale: grams currently on the scale, or < 0 when no scale is connected.
// Keys: 0 = scale off, 3 = empty scale, 4 = empty dosing cup, 5 / 6 = cup with 18.0 g / 20.5 g of beans,
// t = press the scale's tare button. The firmware's own tare requests zero it the same way.
extern float g_simScaleTarget;
extern float g_simScaleOffset; // weight on the scale at the last tare
