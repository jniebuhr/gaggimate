#ifndef WAVESHARELCDDRIVER_H
#define WAVESHARELCDDRIVER_H

#include "Driver.h"
#include <display/drivers/WaveshareLCD/WaveshareLCDPanel.h>

class WaveshareLCDDriver : public Driver {
  public:
    bool isCompatible() override;
    void init() override;
    void setBrightness(int brightness) override { panel.setBrightness(brightness); }
    bool supportsSDCard() override;
    bool installSDCard() override;

    static WaveshareLCDDriver *getInstance() {
        if (instance == nullptr) {
            instance = new WaveshareLCDDriver();
        }
        return instance;
    }

  private:
    static WaveshareLCDDriver *instance;
    WaveshareLCDPanel panel;
    WaveshareLCDDriver() {}

    bool detectHardware();
};

#endif // WAVESHARELCDDRIVER_H