#pragma once
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <deque>

struct NtcTiming {
    uint16_t updateIntervalMs = 250;
    // Equivalent to the original alpha=0.2 every 250 ms. Zero disables smoothing.
    float smoothingTimeConstantMs = 1120.355f;

    float alpha(uint32_t elapsedMs) const {
        return smoothingTimeConstantMs == 0 ? 1.0f :
            1.0f - expf(-static_cast<float>(elapsedMs) / smoothingTimeConstantMs);
    }
};

// Time-weighted equivalent of 10 invalid entries in the original 20 x 250 ms
// history. Consecutive equal states coalesce, so normal operation stores one run.
class NtcFaultWindow {
  public:
    bool update(bool invalid, uint32_t elapsedMs) {
        elapsedMs = std::min(elapsedMs, WINDOW_MS);
        if (elapsedMs == 0) return _invalidMs >= LIMIT_MS;
        if (!_runs.empty() && _runs.back().invalid == invalid) {
            _runs.back().duration += elapsedMs;
        } else {
            _runs.push_back({elapsedMs, invalid});
        }
        _durationMs += elapsedMs;
        if (invalid) _invalidMs += elapsedMs;
        while (_durationMs > WINDOW_MS) {
            auto &oldest = _runs.front();
            const uint32_t expired = std::min(_durationMs - WINDOW_MS, oldest.duration);
            oldest.duration -= expired;
            _durationMs -= expired;
            if (oldest.invalid) _invalidMs -= expired;
            if (!oldest.duration) _runs.pop_front();
        }
        return _invalidMs >= LIMIT_MS;
    }

  private:
    static constexpr uint32_t WINDOW_MS = 5000;
    static constexpr uint32_t LIMIT_MS = 2500;
    struct Run { uint32_t duration; bool invalid; };
    std::deque<Run> _runs;
    uint32_t _durationMs = 0;
    uint32_t _invalidMs = 0;
};
