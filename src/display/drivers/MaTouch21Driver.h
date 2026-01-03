#ifndef MATOUCH21DRIVER_H
#define MATOUCH21DRIVER_H
#include "Driver.h"
#include <display/drivers/MaTouch21/MaTouch21Panel.h>

class MaTouch21Driver : public Driver {
  public:
    bool isCompatible() override { return panel.isCompatible(); };
    void init() override;
    void setBrightness(int brightness) override { panel.setBrightness(brightness); };
    bool supportsSDCard() override { return false; };
    bool installSDCard() override { return false; };

    static MaTouch21Driver *getInstance() {
        if (instance == nullptr) {
            instance = new MaTouch21Driver();
        }
        return instance;
    };

  private:
    static MaTouch21Driver *instance;
    MaTouch21Panel panel;

    MaTouch21Driver() {};
};

#endif // MATOUCH21DRIVER_H
