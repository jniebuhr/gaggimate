#ifndef AMOLEDDISPLAYDRIVER_H
#define AMOLEDDISPLAYDRIVER_H
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

#endif // AMOLEDDISPLAYDRIVER_H
