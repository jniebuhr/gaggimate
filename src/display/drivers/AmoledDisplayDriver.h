#ifndef AMOLEDDISPLAYDRIVER_H
#define AMOLEDDISPLAYDRIVER_H

#ifdef GAGGIMATE_SIM

#include <SdlDriver.h>

// Host-safe stand-in with the same concrete singleton identity as the hardware
// driver. It inherits SDL rendering/input but lets firmware code detect the
// loaded driver with `AmoledDisplayDriver::getInstance()` exactly as on-device.
class AmoledDisplayDriver : public SdlDriver {
  public:
    static AmoledDisplayDriver *getInstance() {
        static AmoledDisplayDriver instance;
        return &instance;
    }

  private:
    AmoledDisplayDriver() = default;
};

#else

#include "Driver.h"
#include <display/drivers/AmoledDisplay/Amoled_DisplayPanel.h>

class AmoledDisplayDriver : public Driver {
  public:
    bool isCompatible() override;
    // Detected hw variant index for NVS caching; selectVariant restores it without probing
    int getVariant() const { return variant; }
    bool selectVariant(int variant);
    void init() override;
    void setBrightness(int brightness) override { panel->setBrightness(brightness); };
    bool supportsSDCard() override;
    bool installSDCard() override;

    static AmoledDisplayDriver *getInstance() {
        if (instance == nullptr) {
            instance = new AmoledDisplayDriver();
        }
        return instance;
    };

  private:
    bool testHw(AmoledHwConfig hwConfig);

    static AmoledDisplayDriver *instance;
    Amoled_DisplayPanel *panel = nullptr;

    AmoledHwConfig hwConfig{};
    int variant = -1;

    AmoledDisplayDriver() {};
};

#endif // GAGGIMATE_SIM

#endif // AMOLEDDISPLAYDRIVER_H
