#ifndef DRIVER_H
#define DRIVER_H

#include <cstdint>

// Pins of a wired controller link, from the display's point of view.
struct UartConf {
    uint8_t txPin;
    uint8_t rxPin;
};

class Driver {
  public:
    virtual ~Driver() = default;

    virtual bool isCompatible();
    virtual void init();
    virtual void setBrightness(int brightness);
    virtual bool supportsSDCard();
    virtual bool installSDCard();
    // Boards wired straight to the controller PCB report their UART pins here.
    virtual bool supportsUART() { return false; }
    virtual UartConf getUARTConf() { return {}; }
};

#endif // DRIVER_H
