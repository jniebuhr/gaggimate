#ifndef HEATERCOORDINATOR_H
#define HEATERCOORDINATOR_H
#include "Heater.h"
#include <cstdint>
#include <mutex>

// Arbitrates brew and steam heater outputs; with coordination only one is on at a time, brew first unless steam is autotuning.
class HeaterCoordinator {
  public:
    static constexpr uint32_t MIN_HANDOVER_MS = 20;
    static constexpr uint32_t MAX_HANDOVER_MS = 5000;

    HeaterCoordinator(Heater *brew, Heater *steam);
    void configure(bool heaterCoordinationEnabled, uint32_t handoverMs);
    void request(Heater *heater, bool on);

  private:
    void set(int channel, bool on, uint32_t now);

    Heater *heaters[2];
    bool active[2] = {false, false};
    uint32_t offAt[2] = {0, 0};
    bool wanted[2] = {false, false};
    bool heaterCoordinationEnabled = false;
    uint32_t handoverMs = 50;
    std::mutex mutex;
};

#endif // HEATERCOORDINATOR_H
