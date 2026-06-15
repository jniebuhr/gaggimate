
#ifndef DRIVER_H
#define DRIVER_H

#include <cstdint>

class Driver {
  public:
    virtual ~Driver() = default;

    virtual bool isCompatible();
    virtual void init();
    virtual void setBrightness(int brightness);
    virtual bool supportsSDCard();
    virtual bool installSDCard();

    // [display-auto-sleep] Put the display into deep sleep to save battery. Wakes
    // up (the chip reboots) on a configured source such as touch. Default no-op for
    // panels that don't support it. Display-only; never touches the controller.
    virtual void sleep() {}

    // [display-battery] Single-cell Li-ion battery telemetry, display-only.
    // hasBattery() reports whether the panel can measure the battery; if it can,
    // getBatteryMilliVolts() returns the pack voltage in millivolts (0 if unknown).
    virtual bool hasBattery() { return false; }
    virtual uint16_t getBatteryMilliVolts() { return 0; }
};

#endif // DRIVER_H
