#ifndef HEADLESSDRIVER_H
#define HEADLESSDRIVER_H

#include "Driver.h"

// Board support for the screenless display PCB: SD card slot and a UART link to the controller it plugs onto.
class HeadlessDriver : public Driver {
  public:
    bool isCompatible() override { return true; }
    void init() override;
    void setBrightness(int brightness) override { (void)brightness; }
    bool supportsSDCard() override { return true; }
    bool installSDCard() override;
    bool supportsUART() override { return true; }
    UartConf getUARTConf() override { return {UART_TX_PIN, UART_RX_PIN}; }

    static HeadlessDriver *getInstance() {
        if (instance == nullptr) {
            instance = new HeadlessDriver();
        }
        return instance;
    }

  private:
    static constexpr uint8_t SD_D0_PIN = 39;
    static constexpr uint8_t SD_CLK_PIN = 40;
    static constexpr uint8_t SD_CMD_PIN = 41;
    static constexpr uint8_t SD_D3_PIN = 42;
    // GPIO43 reaches the controller's ext4, GPIO44 its ext5.
    static constexpr uint8_t UART_TX_PIN = 43;
    static constexpr uint8_t UART_RX_PIN = 44;

    static HeadlessDriver *instance;

    HeadlessDriver() = default;
};

#endif // HEADLESSDRIVER_H
