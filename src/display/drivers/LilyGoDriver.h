#ifndef LILYGODRIVER_H
#define LILYGODRIVER_H

#include "Driver.h"
#include <display/drivers/LilyGo-T-RGB/LilyGo_RGBPanel.h>

constexpr uint8_t LILYGO_DETECT_PIN = 8;

class LilyGoDriver : public Driver {
  public:
    bool isCompatible() override;
    void init() override;
    void setBrightness(int brightness) override { panel.setBrightness(brightness); };
    bool supportsSDCard() override;
    bool installSDCard() override;

    // [display-auto-sleep] Deep sleep with touch wakeup. The chip reboots on wake,
    // so the firmware starts fresh and re-scans for the controller over BLE.
    void sleep() override {
        panel.enableTouchWakeup();
        panel.sleep();
    };

    // [display-battery] The T-RGB exposes the single-cell Li-ion voltage on
    // BOARD_ADC_DET (GPIO4); panel.getBattVoltage() already handles the 1/2 divider
    // and returns millivolts.
    bool hasBattery() override { return true; }
    uint16_t getBatteryMilliVolts() override { return panel.getBattVoltage(); }

    static LilyGoDriver *getInstance() {
        if (instance == nullptr) {
            instance = new LilyGoDriver();
        }
        return instance;
    };

  private:
    static LilyGoDriver *instance;
    LilyGo_RGBPanel panel;

    LilyGoDriver() {};
};

#endif // LILYGODRIVER_H
