#pragma once
#include "Heater.h"
#include "HeaterInterlock.h"

// Single owner of coordinated ON commands. OFF remains available to local
// fault/disable paths. No dependency on ADC rates or pressure-control timing.
class HeaterCoordinator {
  public:
    HeaterCoordinator(Heater *brew, Heater *steam, uint32_t handoverMs, bool enabled);
    bool setup();

  private:
    bool priorityEnabled;
    Heater *brew;
    Heater *steam;
    HeaterInterlock interlock;
    TaskHandle_t task = nullptr;
    static void loopTask(void *arg);
    void loop();
};
