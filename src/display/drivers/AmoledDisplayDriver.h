#ifndef AMOLEDDISPLAYDRIVER_H
#define AMOLEDDISPLAYDRIVER_H
#include "Driver.h"
#include <display/drivers/AmoledDisplay/Amoled_DisplayPanel.h>

class AmoledDisplayDriver : public Driver {
  public:
    bool isCompatible() override;
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
    bool testHw_Waveshare132(AmoledHwConfig hwConfig);

    static AmoledDisplayDriver *instance;
    Amoled_DisplayPanel *panel = nullptr;

    AmoledHwConfig hwConfig{};

    AmoledDisplayDriver() {};
};

#endif // AMOLEDDISPLAYDRIVER_H
