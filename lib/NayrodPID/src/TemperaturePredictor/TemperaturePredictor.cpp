#include "TemperaturePredictor.h"

#include <algorithm>
#include <cmath>

namespace {
constexpr float MIN_DELAY_SECONDS = 0.25f;
constexpr float MAX_DELAY_SECONDS = 240.0f;
constexpr float MIN_PROCESS_GAIN = 0.0001f;
constexpr float MAX_PROCESS_GAIN = 5.0f;
constexpr float MIN_LAG_SECONDS = 0.05f;
constexpr float MAX_LAG_SECONDS = 240.0f;
constexpr float MIN_DT_SECONDS = 0.05f;
constexpr float MAX_DT_SECONDS = 5.0f;
constexpr float MIN_SENSOR_TEMPERATURE = -20.0f;
constexpr float MAX_SENSOR_TEMPERATURE = 200.0f;
constexpr float MAX_ABS_DUTY = 1.5f;
constexpr unsigned int MISMATCH_CONFIRMATIONS = 3;
} // namespace

TemperaturePredictor::TemperaturePredictor() { lastResult.fallbackReason = FallbackReason::Disabled; }

bool TemperaturePredictor::finite(float value) { return std::isfinite(value); }

float TemperaturePredictor::clamp(float value, float lower, float upper) {
    return std::max(lower, std::min(value, upper));
}

bool TemperaturePredictor::configure(const Config &newConfig) {
    config = newConfig;
    configured = config.enabled && finite(config.delaySeconds) && config.delaySeconds >= MIN_DELAY_SECONDS &&
                 config.delaySeconds <= MAX_DELAY_SECONDS && finite(config.processGain) &&
                 config.processGain >= MIN_PROCESS_GAIN && config.processGain <= MAX_PROCESS_GAIN &&
                 finite(config.lagSeconds) && config.lagSeconds >= MIN_LAG_SECONDS &&
                 config.lagSeconds <= MAX_LAG_SECONDS && finite(config.correctionTimeSeconds) &&
                 finite(config.operatingPointTimeSeconds);
    initialized = false;
    faulted = false;
    mismatchSamples = 0;
    lastResult = {};
    lastResult.fallbackReason =
        configured ? FallbackReason::None : (config.enabled ? FallbackReason::InvalidConfig : FallbackReason::Disabled);
    return configured;
}

void TemperaturePredictor::reset(float measuredTemperature, float currentDuty) {
    faulted = false;
    initialized = configured && finite(measuredTemperature) && measuredTemperature >= MIN_SENSOR_TEMPERATURE &&
                  measuredTemperature <= MAX_SENSOR_TEMPERATURE && finite(currentDuty);
    modelTemperature = measuredTemperature;
    modelRate = 0.0f;
    correction = 0.0f;
    operatingPointDuty = clamp(currentDuty, 0.0f, 1.0f);
    previousMeasuredTemperature = measuredTemperature;
    previousNetDuty = operatingPointDuty;
    steadySeconds = 0.0f;
    mismatchSamples = 0;
    historyHead = 0;
    historyCount = 1;
    modelHistory.fill(measuredTemperature);
    modelHistoryTime.fill(0.0f);
    modelTime = 0.0f;
    lastResult = {};
    lastResult.temperature = measuredTemperature;
    lastResult.operatingPointDuty = operatingPointDuty;
    lastResult.active = initialized;
    lastResult.fallbackReason =
        initialized ? FallbackReason::None : (configured ? FallbackReason::InvalidInput : FallbackReason::Disabled);
}

float TemperaturePredictor::derivedCorrectionTime() const {
    if (config.correctionTimeSeconds > 0.0f) {
        return config.correctionTimeSeconds;
    }
    return std::max(config.lagSeconds, config.delaySeconds * 0.5f);
}

float TemperaturePredictor::derivedOperatingPointTime() const {
    if (config.operatingPointTimeSeconds > 0.0f) {
        return config.operatingPointTimeSeconds;
    }
    // Slow enough that a heater step remains visible throughout the sensor
    // dead time, but finite so maintenance duty cannot drive the model forever.
    return std::max(60.0f, config.delaySeconds * 5.0f);
}

float TemperaturePredictor::predictionBound() const {
    // The largest nominal unseen movement over delay + lag at full power,
    // with margin for identification error. Keep a useful floor for very slow
    // plants and an absolute ceiling for corrupt-but-finite configurations.
    return clamp(1.5f * config.processGain * (config.delaySeconds + config.lagSeconds), 1.0f, 15.0f);
}

void TemperaturePredictor::pushModelTemperature(float value) {
    historyHead = (historyHead + 1) % modelHistory.size();
    modelHistory[historyHead] = value;
    modelHistoryTime[historyHead] = modelTime;
    if (historyCount < modelHistory.size()) {
        ++historyCount;
    }
}

float TemperaturePredictor::readDelayed(float delaySeconds) const {
    if (historyCount == 0) {
        return modelTemperature;
    }
    const float targetTime = modelTime - std::max(0.0f, delaySeconds);
    std::size_t newerIndex = historyHead;
    if (targetTime >= modelHistoryTime[newerIndex]) {
        return modelHistory[newerIndex];
    }
    for (std::size_t age = 1; age < historyCount; ++age) {
        const std::size_t olderIndex = (historyHead + modelHistory.size() - age) % modelHistory.size();
        const float olderTime = modelHistoryTime[olderIndex];
        if (olderTime <= targetTime) {
            const float newerTime = modelHistoryTime[newerIndex];
            const float interval = newerTime - olderTime;
            if (interval <= 0.0f) {
                return modelHistory[olderIndex];
            }
            const float fraction = clamp((targetTime - olderTime) / interval, 0.0f, 1.0f);
            return modelHistory[olderIndex] * (1.0f - fraction) + modelHistory[newerIndex] * fraction;
        }
        newerIndex = olderIndex;
    }
    // During startup the requested delayed time predates the history; the
    // reset temperature is the model's known pre-history.
    return modelHistory[newerIndex];
}

TemperaturePredictor::Result TemperaturePredictor::fallback(float measuredTemperature, FallbackReason reason) {
    lastResult.temperature = measuredTemperature;
    lastResult.residual = 0.0f;
    lastResult.modelLead = 0.0f;
    lastResult.operatingPointDuty = operatingPointDuty;
    lastResult.active = false;
    lastResult.fallbackReason = reason;
    return lastResult;
}

TemperaturePredictor::Result TemperaturePredictor::update(float measuredTemperature, float duty, float disturbanceDuty,
                                                          float dtSeconds) {
    if (!configured) {
        return fallback(measuredTemperature, config.enabled ? FallbackReason::InvalidConfig : FallbackReason::Disabled);
    }
    if (faulted) {
        return fallback(measuredTemperature, FallbackReason::ModelMismatch);
    }
    if (!finite(measuredTemperature) || measuredTemperature < MIN_SENSOR_TEMPERATURE ||
        measuredTemperature > MAX_SENSOR_TEMPERATURE || !finite(duty) || !finite(disturbanceDuty) || !finite(dtSeconds) ||
        dtSeconds < MIN_DT_SECONDS || dtSeconds > MAX_DT_SECONDS) {
        initialized = false;
        return fallback(measuredTemperature, FallbackReason::InvalidInput);
    }
    if (!initialized) {
        reset(measuredTemperature, duty);
        return lastResult;
    }

    const float boundedDuty = clamp(duty, 0.0f, 1.0f);
    const float boundedDisturbance = clamp(disturbanceDuty, 0.0f, MAX_ABS_DUTY);
    const float netDuty = boundedDuty - boundedDisturbance;

    // Only learn a new maintenance-power operating point after both the sensor
    // and actuator have been settled for longer than the dead time. Adapting
    // continuously would erase a real heater step before the delayed sensor
    // has had a chance to observe it.
    const float measuredRate = (measuredTemperature - previousMeasuredTemperature) / dtSeconds;
    const bool steady = boundedDisturbance < 0.01f && std::abs(measuredRate) < 0.05f &&
                        std::abs(netDuty - previousNetDuty) < 0.10f;
    steadySeconds = steady ? steadySeconds + dtSeconds : 0.0f;
    if (steadySeconds >= std::max(10.0f, config.delaySeconds * 2.0f)) {
        const float opAlpha = 1.0f - std::exp(-dtSeconds / derivedOperatingPointTime());
        operatingPointDuty += opAlpha * (netDuty - operatingPointDuty);
    }
    previousMeasuredTemperature = measuredTemperature;
    previousNetDuty = netDuty;
    const float deviationDuty = clamp(netDuty - operatingPointDuty, -MAX_ABS_DUTY, MAX_ABS_DUTY);

    // Exact zero-order-hold update for:
    //   rateDot = (k' * deviationDuty - rate) / tau2
    //   tempDot = rate
    const float lagDecay = std::exp(-dtSeconds / config.lagSeconds);
    const float targetRate = config.processGain * deviationDuty;
    const float previousRate = modelRate;
    modelRate = lagDecay * previousRate + (1.0f - lagDecay) * targetRate;
    modelTemperature += targetRate * dtSeconds + (previousRate - targetRate) * config.lagSeconds * (1.0f - lagDecay);
    modelTime += dtSeconds;
    pushModelTemperature(modelTemperature);

    const float delayedModel = readDelayed(config.delaySeconds);
    const float residual = measuredTemperature - delayedModel;
    const float correctionTau = derivedCorrectionTime();
    const float correctionAlpha = 1.0f - std::exp(-dtSeconds / correctionTau);
    correction += correctionAlpha * (residual - correction);

    const float rawPrediction = modelTemperature + correction;
    const float modelLead = rawPrediction - measuredTemperature;
    const float bound = predictionBound();
    const float mismatchLimit = std::max(10.0f, bound * 3.0f);

    if (!finite(rawPrediction) || !finite(residual) || !finite(modelLead)) {
        initialized = false;
        return fallback(measuredTemperature, FallbackReason::InvalidInput);
    }

    if (std::abs(residual) > mismatchLimit) {
        ++mismatchSamples;
        if (mismatchSamples >= MISMATCH_CONFIRMATIONS) {
            initialized = false;
            faulted = true;
            return fallback(measuredTemperature, FallbackReason::ModelMismatch);
        }
    } else {
        mismatchSamples = 0;
    }

    if (std::abs(modelLead) > bound) {
        lastResult.residual = residual;
        lastResult.modelLead = clamp(modelLead, -bound, bound);
        lastResult.operatingPointDuty = operatingPointDuty;
        lastResult.temperature = measuredTemperature + lastResult.modelLead;
        lastResult.active = true;
        lastResult.fallbackReason = FallbackReason::PredictionOutOfRange;
        return lastResult;
    }

    lastResult.temperature = rawPrediction;
    lastResult.residual = residual;
    lastResult.modelLead = modelLead;
    lastResult.operatingPointDuty = operatingPointDuty;
    lastResult.active = true;
    lastResult.fallbackReason = FallbackReason::None;
    return lastResult;
}
