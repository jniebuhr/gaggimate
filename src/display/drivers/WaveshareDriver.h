#ifndef WAVESHAREDRIVER_H
#define WAVESHAREDRIVER_H
#include "Driver.h"
#include <display/drivers/Waveshare/WavesharePanel.h>

class WaveshareDriver : public Driver {
  public:
    inline bool isCompatible() override { return true; };
    void init() override;
    void setBrightness(int brightness) override { panel.setBrightness(brightness); };
    bool supportsSDCard() override;
    bool installSDCard() override;
    bool supportsUART() override { return true; }
    UartConf getUARTConf() override { return {UART_TX_PIN, UART_RX_PIN}; }

    static WaveshareDriver *getInstance() {
        if (instance == nullptr) {
            instance = new WaveshareDriver();
        }
        return instance;
    };

  private:
    static WaveshareDriver *instance;
    WavesharePanel panel;

    static constexpr uint8_t UART_TX_PIN = 43;
    static constexpr uint8_t UART_RX_PIN = 44;

    WaveshareDriver() {};
};

#endif // WAVESHAREDRIVER_H
