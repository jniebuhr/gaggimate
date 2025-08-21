#ifndef WAVESHAREDRIVER_H
#define WAVESHAREDRIVER_H
#include "Driver.h"
#include <display/drivers/Waveshare/WavesharePanel.h>

class WaveshareDriver : public Driver {
  public:
    inline bool isCompatible() override { return true; };
    void init() override;
    void setBrightness(int brightness) override { panel.setBrightness(brightness); };

    static WaveshareDriver *getInstance() {
        if (instance == nullptr) {
            instance = new WaveshareDriver();
        }
        return instance;
    };

  private:
    static WaveshareDriver *instance;
    WavesharePanel panel;

    WaveshareDriver() {};
};

#endif // WAVESHAREDRIVER_H
