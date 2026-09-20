#pragma once
#include <cmath>
#include <cstdint>

// Used under Controller::processMutex. No BLE access: timestamps refer to receipt
// on the host task, not to the later consumption of a queued measurement.
class ScaleStartGate {
  public:
    enum class Result { Waiting, Ready, Failed };
    static constexpr uint32_t TimeoutMs = 2500;
    static constexpr uint32_t FreshnessMs = 1500;

    void begin(uint32_t now) {
        started = now;
        zeroConfirmed = false;
    }
    void observe(double weight, uint32_t receivedAt, uint32_t now, bool tareComplete, bool tareOK, uint32_t tareAt) {
        if (tareComplete && tareOK && static_cast<int32_t>(receivedAt - tareAt) > 0 && now - receivedAt < FreshnessMs &&
            std::isfinite(weight) && std::abs(weight) <= 0.5)
            zeroConfirmed = true;
    }
    Result poll(uint32_t now, bool connected, bool tareComplete, bool tareOK) const {
        if (!connected || now - started >= TimeoutMs || (tareComplete && !tareOK))
            return Result::Failed;
        return zeroConfirmed ? Result::Ready : Result::Waiting;
    }

  private:
    uint32_t started = 0;
    bool zeroConfirmed = false;
};
