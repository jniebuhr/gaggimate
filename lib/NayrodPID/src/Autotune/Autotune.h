#pragma once

#include <deque>
#include <functional>

// Open-loop step-response autotuner. PID gains via Skogestad SIMC rule for
// integrator-with-lag plants from three identified parameters:
//
//   L   (dead time)                  — step to first reaction
//   k'  (process gain at full power) — steady-state dT/dt at step
//   τ₂  (parasitic fast lag)         — exponential-peeling of transient
//
// State machine (update() dispatches; helpers do work):
//
//   1. primeBaselineSlope     — fill initial window, capture noise floor
//   2. handlePreReactionSample — wait for sustained slope > noise + epsilon
//   3. handlePostReactionSample — watch slope saturate (inflection)
//   4. finalizeInflection     — capture k'/τ₂, compute SIMC gains
//
// Timeouts bound each phase. On timeout gains stay zero; Heater must detect
// via isTimedOut() rather than write zeros to NVS.
class Autotune {
  public:
    Autotune();

    void reset();
    void update(float temperature, float currentTime);

    bool isFinished() const;
    bool isTimedOut() const { return timedOut; }

    float getKp() const;
    float getKi() const;
    float getKd() const;
    float getKff() const;
    void setupAutotune(unsigned int windowSize, float slopeThreshold, unsigned int confirmationCount);
    void setWindowsize(unsigned int size);
    void setEpsilon(float eps);
    void setRequiredConfirmations(unsigned int confirmations);
    void setTimeOut(float timeOut);
    bool maxPowerOn = false; // Heater drives full power when true

    float getSystemDelay() const { return system_pure_delay; }
    float getSystemGain() const { return system_gain; };
    float getSystemTau2() const { return system_tau2; }
    float getCrossoverFreq() const { return cross_freq; };
    // Configured timeout. Use in failure-path logs (system_pure_delay reads 0
    // on timeout — only set on success).
    float getTimeOut() const { return maxTimeOut_s; }

  private:
    // Step 1: fill initial temperature/time window, freeze noise-floor slope.
    // On full window, raise maxPowerOn (Heater applies step) + record
    // startPowerOnTime as t=0 for downstream phases.
    void primeBaselineSlope(float currentTime);
    // Step 2: count consecutive samples with slope > initialSlope + epsilon.
    // On requiredConfirmations in a row → reactionDetected, capture
    // reactionTime. Trip timeout if reaction never arrives.
    void handlePreReactionSample(float slope, float currentTime);
    // Step 3: feed rolling slope window. When slopeOfSlope ≈ 0 + temp rose ≥
    // 10 °C, capture k' and hand to finalize. Also trips timeout.
    void handlePostReactionSample(float slope, float currentTime, float temperature);
    // Step 4: derive system_pure_delay + system_tau2, run SIMC rule, set
    // finished = true.
    void finalizeInflection();

    float computeSlope(const std::deque<float> &x, const std::deque<float> &y) const;
    float identifyTau2(float k_prime);
    void computeControllerGains(float L, float k_prime, float tau2);

    // ------------------- Tuning knobs (override via setters) ----------------

    // Moving window size for slope LS fit over N samples.
    unsigned int N = 4;
    // Slope threshold for reaction detection. Tuned for MAX31855 (0.25 °C LSB)
    // at ~1 Hz: 0.1 °C/s sits ~2× above quantisation floor, well below real
    // boiler reaction. Override via setEpsilon() for other sensors.
    float epsilon = 0.1f;
    // 5 consecutive confirmations (was 3 pre-SIMC) rejects single-LSB
    // quantisation spikes that trip reaction detection on noise.
    unsigned int requiredConfirmations = 5;
    // Default 120 s covers espresso boilers with thermocouple-on-shell dead
    // times up to ~30 s + rise-to-inflection. Heater::setupAutotune overrides
    // via setTimeOut() from UI "Test Duration" (range 30-300 s).
    float maxTimeOut_s = 120.0f;

    // ------------------- Rolling and full sample history --------------------

    // Rolling temp + time window, capped at N+1 — drives per-sample slope.
    std::deque<float> values;
    std::deque<float> times;
    // Rolling slope window, capped at N — drives inflection detector
    // (slopeOfSlope).
    std::deque<float> slopes;
    std::deque<float> slopeTimes;
    // Full slope history for exponential-peeling τ₂ identifier. `slopes` rolls
    // at N for inflection; `allSlopes` retains every post-power-on sample so
    // log-linear regression of ln(k'-slope) has enough points. Bounded by
    // test duration — at 1 Hz and maxTimeOut_s=300 s, <300 × 8 B = <2.4 KB
    // across both deques.
    std::deque<float> allSlopes;
    std::deque<float> allSlopeTimes;

    // ------------------- State machine flags and moments --------------------

    float initialTemp = 0.0f;  // first temp sample this test
    float initialSlope = 0.0f; // noise-floor slope at step time

    unsigned int currentConfirmations = 0;
    bool reactionDetected = false;
    bool maxSlopeFound = false;
    bool finished = false;
    bool timedOut = false;

    float reactionTime = -1.0f;     // first sample of confirmation streak
    float maxSlope = -1.0f;         // legacy log-line back-compat
    float maxSlopeTime = -1.0f;     // when max-slope sample was taken
    float startPowerOnTime = -1.0f; // when heater step was applied

    // ------------------- SIMC outputs ---------------------------------------

    float Kp = 0.0f;
    float Ki = 0.0f;
    float Kd = 0.0f;
    float Kff = 0.0f;
    float system_pure_delay = 0.0f; // L
    float system_gain = 0.0f;       // k' (max slope at full power)
    float system_tau2 = 0.0f;       // τ₂ (parasitic fast lag)
    float cross_freq = 0.0f;        // approx loop crossover, log telemetry
};
