#ifndef LILYGODRIVER_H
#define LILYGODRIVER_H

#include "Driver.h"
#include <display/drivers/LilyGo-T-RGB/LilyGo_RGBPanel.h>

constexpr uint8_t LILYGO_DETECT_PIN = 8;

class LilyGoDriver : public Driver {
  public:
    bool isCompatible() override;
    void init() override;

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
