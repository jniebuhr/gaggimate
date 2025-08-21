#ifndef LILYGOTDISPLAYDRIVER_H
#define LILYGOTDISPLAYDRIVER_H
#include "Driver.h"
#include <display/drivers/LilyGo-T-Display-S3-DS/LilyGo_TDisplayPanel.h>

class LilyGoTDisplayDriver : public Driver {
  public:
    bool isCompatible() override;
    void init() override;
    void setBrightness(int brightness) override { panel.setBrightness(brightness); };

    static LilyGoTDisplayDriver *getInstance() {
        if (instance == nullptr) {
            instance = new LilyGoTDisplayDriver();
        }
        return instance;
    };

  private:
    static LilyGoTDisplayDriver *instance;
    LilyGo_TDisplayPanel panel;

    LilyGoTDisplayDriver() {};
};

#endif // LILYGOTDISPLAYDRIVER_H
