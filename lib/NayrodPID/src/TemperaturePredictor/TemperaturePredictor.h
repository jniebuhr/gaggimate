#pragma once

#include <array>
#include <cstddef>
#include <cstdint>

// Predicts the current thermal-process temperature from a delayed temperature
// measurement and recent heater commands.
//
// The identified plant is:
//
//                k'
//   G(s) = ---------------- e^(-Ls)
//           s (tau2 s + 1)
//
// A delay-free copy and a delayed copy are simulated in parallel. Their
// difference advances the measured temperature, while a low-pass correction
// anchors the model to the sensor. The heater input is expressed around a
// slowly moving operating-point estimate; this deviation form keeps normal
// steady-state maintenance power from making the integrating model drift.
class TemperaturePredictor {
  public:
    enum class FallbackReason : uint8_t {
        None = 0,
        Disabled,
        InvalidConfig,
        InvalidInput,
        ModelMismatch,
        PredictionOutOfRange,
    };

    struct Config {
        bool enabled = false;
        float delaySeconds = 0.0f;
        float processGain = 0.0f; // degC/s at full heater power
        float lagSeconds = 0.0f;
        // <= 0 derives a conservative value from delay/lag.
        float correctionTimeSeconds = 0.0f;
        // <= 0 derives a slow operating-point time constant from delay.
        float operatingPointTimeSeconds = 0.0f;
    };

    struct Result {
        float temperature = 0.0f;
        float residual = 0.0f;
        float modelLead = 0.0f;
        float operatingPointDuty = 0.0f;
        bool active = false;
        FallbackReason fallbackReason = FallbackReason::Disabled;
    };

    static constexpr std::size_t MAX_DELAY_SAMPLES = 300;

    TemperaturePredictor();

    bool configure(const Config &config);
    void reset(float measuredTemperature, float currentDuty = 0.0f);

    // duty and disturbanceDuty are normalized fractions of full heater power.
    // disturbanceDuty is positive for a cooling load (for example cold-water
    // flow). dtSeconds is normally the heater controller's 1 s PID interval.
    Result update(float measuredTemperature, float duty, float disturbanceDuty, float dtSeconds);

    const Config &getConfig() const { return config; }
    const Result &getLastResult() const { return lastResult; }
    bool isConfigured() const { return configured; }
    bool isInitialized() const { return initialized; }

  private:
    static bool finite(float value);
    static float clamp(float value, float lower, float upper);

    float derivedCorrectionTime() const;
    float derivedOperatingPointTime() const;
    float predictionBound() const;
    float readDelayed(float delaySeconds) const;
    void pushModelTemperature(float value);
    Result fallback(float measuredTemperature, FallbackReason reason);

    Config config{};
    Result lastResult{};
    std::array<float, MAX_DELAY_SAMPLES + 2> modelHistory{};
    std::array<float, MAX_DELAY_SAMPLES + 2> modelHistoryTime{};
    std::size_t historyHead = 0;
    std::size_t historyCount = 0;

    float modelTemperature = 0.0f;
    float modelTime = 0.0f;
    float modelRate = 0.0f;
    float correction = 0.0f;
    float operatingPointDuty = 0.0f;
    float previousMeasuredTemperature = 0.0f;
    float previousNetDuty = 0.0f;
    float steadySeconds = 0.0f;
    unsigned int mismatchSamples = 0;
    bool configured = false;
    bool initialized = false;
    bool faulted = false;
};
