#include <unity.h>

#include <algorithm>
#include <cmath>
#include <deque>

#include "TemperaturePredictor/TemperaturePredictor.cpp"

namespace {
TemperaturePredictor::Config typicalConfig() {
    TemperaturePredictor::Config config;
    config.enabled = true;
    config.delaySeconds = 17.0f;
    config.processGain = 0.188f;
    config.lagSeconds = 3.5f;
    return config;
}

struct SyntheticPlant {
    explicit SyntheticPlant(float initialTemperature = 90.0f)
        : currentTemperature(initialTemperature), measuredTemperature(initialTemperature),
          delayLine(17, initialTemperature) {}

    float currentTemperature;
    float measuredTemperature;
    float rate = 0.0f;
    std::deque<float> delayLine;

    void update(float netDuty) {
        constexpr float processGain = 0.188f;
        constexpr float lagSeconds = 3.5f;
        const float decay = std::exp(-1.0f / lagSeconds);
        const float targetRate = processGain * netDuty;
        const float previousRate = rate;
        rate = decay * previousRate + (1.0f - decay) * targetRate;
        currentTemperature += targetRate + (previousRate - targetRate) * lagSeconds * (1.0f - decay);
        delayLine.push_back(currentTemperature);
        measuredTemperature = delayLine.front();
        delayLine.pop_front();
    }
};

struct ClosedLoopMetrics {
    float setpointOvershoot = 0.0f;
    float disturbanceIae = 0.0f;
    bool bounded = true;
};

ClosedLoopMetrics driveClosedLoop(bool predictive, float identifiedDelayScale = 1.0f,
                                  float identifiedGainScale = 1.0f, float identifiedLagScale = 1.0f,
                                  float feedforwardFraction = 0.8f) {
    SyntheticPlant plant;
    TemperaturePredictor predictor;
    auto config = typicalConfig();
    config.enabled = predictive;
    config.delaySeconds *= identifiedDelayScale;
    config.processGain *= identifiedGainScale;
    config.lagSeconds *= identifiedLagScale;
    predictor.configure(config);

    constexpr float maintenanceDuty = 0.08f;
    constexpr float proportionalGain = 0.112f; // 112 output units/degC
    constexpr float integralGain = 0.000658f;   // 0.658 output units/degC/s
    constexpr float derivativeGain = 0.4f;      // 400 output units*s/degC
    predictor.reset(90.0f, maintenanceDuty);
    float duty = maintenanceDuty;
    float integral = maintenanceDuty / integralGain;
    float previousError = 0.0f;
    float previousFlowLoad = 0.0f;
    ClosedLoopMetrics metrics;

    for (int second = 0; second < 700; ++second) {
        const float setpoint = second < 120 ? 90.0f : 93.0f;
        const float flowLoad = second >= 500 && second < 530 ? 0.45f : 0.0f;
        float feedback = plant.measuredTemperature;
        if (predictive) {
            const auto prediction = predictor.update(plant.measuredTemperature, duty, previousFlowLoad, 1.0f);
            if (prediction.active) {
                feedback = prediction.temperature;
            }
            metrics.bounded =
                metrics.bounded && std::isfinite(prediction.temperature) && std::abs(prediction.modelLead) <= 15.0f;
        }

        const float error = setpoint - feedback;
        const float derivative = error - previousError;
        const float candidate =
            proportionalGain * error + integralGain * (integral + error) + derivativeGain * derivative +
            feedforwardFraction * flowLoad;
        if (!((candidate > 1.0f && error > 0.0f) || (candidate < 0.0f && error < 0.0f))) {
            integral += error;
        }
        duty = std::clamp(proportionalGain * error + integralGain * integral + derivativeGain * derivative +
                              feedforwardFraction * flowLoad,
                          0.0f, 1.0f);
        previousError = error;
        previousFlowLoad = flowLoad;
        plant.update(duty - maintenanceDuty - flowLoad);

        metrics.bounded = metrics.bounded && std::isfinite(duty) && duty >= 0.0f && duty <= 1.0f &&
                          std::isfinite(plant.currentTemperature);
        if (second >= 120 && second < 400) {
            metrics.setpointOvershoot =
                std::max(metrics.setpointOvershoot, plant.currentTemperature - setpoint);
        }
        if (second >= 500 && second < 580) {
            metrics.disturbanceIae += std::abs(setpoint - plant.currentTemperature);
        }
    }
    return metrics;
}

ClosedLoopMetrics driveFullWarmup(bool predictive) {
    SyntheticPlant plant(25.0f);
    TemperaturePredictor predictor;
    auto config = typicalConfig();
    config.enabled = predictive;
    predictor.configure(config);

    constexpr float maintenanceDuty = 0.08f;
    constexpr float proportionalGain = 0.112f;
    constexpr float integralGain = 0.000658f;
    constexpr float derivativeGain = 0.4f;
    predictor.reset(25.0f, maintenanceDuty);
    float duty = maintenanceDuty;
    float integral = maintenanceDuty / integralGain;
    float previousError = 0.0f;
    ClosedLoopMetrics metrics;

    for (int second = 0; second < 700; ++second) {
        float feedback = plant.measuredTemperature;
        if (predictive) {
            const auto prediction = predictor.update(plant.measuredTemperature, duty, 0.0f, 1.0f);
            if (prediction.active) {
                feedback = prediction.temperature;
            }
            metrics.bounded =
                metrics.bounded && std::isfinite(prediction.temperature) && std::abs(prediction.modelLead) <= 15.0f;
        }
        const float error = 93.0f - feedback;
        const float derivative = error - previousError;
        const float candidate = proportionalGain * error + integralGain * (integral + error) + derivativeGain * derivative;
        if (!((candidate > 1.0f && error > 0.0f) || (candidate < 0.0f && error < 0.0f))) {
            integral += error;
        }
        duty = std::clamp(proportionalGain * error + integralGain * integral + derivativeGain * derivative, 0.0f, 1.0f);
        previousError = error;
        plant.update(duty - maintenanceDuty);
        metrics.bounded = metrics.bounded && std::isfinite(duty) && std::isfinite(plant.currentTemperature);
        metrics.setpointOvershoot =
            std::max(metrics.setpointOvershoot, plant.currentTemperature - 93.0f);
    }
    return metrics;
}

void test_rejects_invalid_model() {
    TemperaturePredictor predictor;
    auto config = typicalConfig();
    config.processGain = NAN;

    TEST_ASSERT_FALSE(predictor.configure(config));
    const auto result = predictor.update(90.0f, 0.5f, 0.0f, 1.0f);
    TEST_ASSERT_FALSE(result.active);
    TEST_ASSERT_EQUAL_INT(static_cast<int>(TemperaturePredictor::FallbackReason::InvalidConfig),
                          static_cast<int>(result.fallbackReason));
    TEST_ASSERT_EQUAL_FLOAT(90.0f, result.temperature);
}

void test_predicts_heater_response_before_delayed_sensor() {
    TemperaturePredictor predictor;
    TEST_ASSERT_TRUE(predictor.configure(typicalConfig()));
    predictor.reset(90.0f, 0.0f);

    TemperaturePredictor::Result result;
    for (int second = 0; second < 12; ++second) {
        result = predictor.update(90.0f, 1.0f, 0.0f, 1.0f);
    }

    TEST_ASSERT_TRUE(result.active);
    TEST_ASSERT_EQUAL_INT(static_cast<int>(TemperaturePredictor::FallbackReason::None),
                          static_cast<int>(result.fallbackReason));
    TEST_ASSERT_GREATER_THAN(90.5f, result.temperature);
    TEST_ASSERT_GREATER_THAN(0.5f, result.modelLead);
}

void test_flow_load_reduces_predicted_temperature() {
    TemperaturePredictor heating;
    TemperaturePredictor loaded;
    TEST_ASSERT_TRUE(heating.configure(typicalConfig()));
    TEST_ASSERT_TRUE(loaded.configure(typicalConfig()));
    heating.reset(93.0f, 0.2f);
    loaded.reset(93.0f, 0.2f);

    TemperaturePredictor::Result heatResult;
    TemperaturePredictor::Result loadResult;
    for (int second = 0; second < 8; ++second) {
        heatResult = heating.update(93.0f, 0.8f, 0.0f, 1.0f);
        loadResult = loaded.update(93.0f, 0.8f, 0.6f, 1.0f);
    }

    TEST_ASSERT_TRUE(heatResult.active);
    TEST_ASSERT_TRUE(loadResult.active);
    TEST_ASSERT_GREATER_THAN_FLOAT(loadResult.temperature, heatResult.temperature);
}

void test_steady_maintenance_power_is_bumpless() {
    TemperaturePredictor predictor;
    TEST_ASSERT_TRUE(predictor.configure(typicalConfig()));
    predictor.reset(93.0f, 0.12f);

    TemperaturePredictor::Result result;
    for (int second = 0; second < 120; ++second) {
        result = predictor.update(93.0f, 0.12f, 0.0f, 1.0f);
    }

    TEST_ASSERT_TRUE(result.active);
    TEST_ASSERT_FLOAT_WITHIN(0.05f, 93.0f, result.temperature);
    TEST_ASSERT_FLOAT_WITHIN(0.01f, 0.12f, result.operatingPointDuty);
}

void test_invalid_runtime_input_falls_back_to_sensor() {
    TemperaturePredictor predictor;
    TEST_ASSERT_TRUE(predictor.configure(typicalConfig()));
    predictor.reset(93.0f, 0.0f);

    const auto result = predictor.update(93.0f, NAN, 0.0f, 1.0f);
    TEST_ASSERT_FALSE(result.active);
    TEST_ASSERT_EQUAL_FLOAT(93.0f, result.temperature);
    TEST_ASSERT_EQUAL_FLOAT(0.0f, result.residual);
    TEST_ASSERT_EQUAL_FLOAT(0.0f, result.modelLead);
    TEST_ASSERT_EQUAL_INT(static_cast<int>(TemperaturePredictor::FallbackReason::InvalidInput),
                          static_cast<int>(result.fallbackReason));
}

void test_delay_compensation_is_invariant_to_irregular_control_intervals() {
    TemperaturePredictor regular;
    TemperaturePredictor irregular;
    TEST_ASSERT_TRUE(regular.configure(typicalConfig()));
    TEST_ASSERT_TRUE(irregular.configure(typicalConfig()));
    regular.reset(90.0f, 0.0f);
    irregular.reset(90.0f, 0.0f);

    TemperaturePredictor::Result regularResult;
    for (int second = 0; second < 12; ++second) {
        regularResult = regular.update(90.0f, 1.0f, 0.0f, 1.0f);
    }
    const float intervals[] = {1.0f, 1.0f, 3.0f, 1.0f, 2.0f, 1.0f, 3.0f};
    TemperaturePredictor::Result irregularResult;
    for (float interval : intervals) {
        irregularResult = irregular.update(90.0f, 1.0f, 0.0f, interval);
    }

    TEST_ASSERT_TRUE(irregularResult.active);
    TEST_ASSERT_FLOAT_WITHIN(0.05f, regularResult.temperature, irregularResult.temperature);
    TEST_ASSERT_FLOAT_WITHIN(0.05f, regularResult.residual, irregularResult.residual);
}

void test_prediction_is_bounded_to_reachable_temperature() {
    TemperaturePredictor predictor;
    auto config = typicalConfig();
    config.delaySeconds = 2.0f;
    config.processGain = 5.0f;
    config.lagSeconds = 0.1f;
    config.correctionTimeSeconds = 1000.0f;
    TEST_ASSERT_TRUE(predictor.configure(config));
    predictor.reset(90.0f, 0.0f);

    TemperaturePredictor::Result result;
    for (int second = 0; second < 5; ++second) {
        result = predictor.update(90.0f, 1.0f, 0.0f, 1.0f);
    }

    TEST_ASSERT_TRUE(result.active);
    TEST_ASSERT_LESS_OR_EQUAL(15.0f, std::abs(result.temperature - 90.0f));
    TEST_ASSERT_EQUAL_INT(static_cast<int>(TemperaturePredictor::FallbackReason::PredictionOutOfRange),
                          static_cast<int>(result.fallbackReason));
}

void test_persistent_model_mismatch_latches_until_reset() {
    TemperaturePredictor predictor;
    auto config = typicalConfig();
    config.delaySeconds = 2.0f;
    config.processGain = 5.0f;
    config.lagSeconds = 0.1f;
    TEST_ASSERT_TRUE(predictor.configure(config));
    predictor.reset(90.0f, 0.0f);

    TemperaturePredictor::Result result;
    for (int second = 0; second < 120; ++second) {
        result = predictor.update(90.0f, 1.0f, 0.0f, 1.0f);
        if (!result.active) {
            break;
        }
    }
    TEST_ASSERT_FALSE(result.active);
    TEST_ASSERT_EQUAL_INT(static_cast<int>(TemperaturePredictor::FallbackReason::ModelMismatch),
                          static_cast<int>(result.fallbackReason));

    const auto stillLatched = predictor.update(90.0f, 1.0f, 0.0f, 1.0f);
    TEST_ASSERT_FALSE(stillLatched.active);
    predictor.reset(90.0f, 1.0f);
    const auto recovered = predictor.update(90.0f, 1.0f, 0.0f, 1.0f);
    TEST_ASSERT_TRUE(recovered.active);
}

void test_predictive_control_improves_nominal_closed_loop_response() {
    const auto conventional = driveClosedLoop(false);
    const auto predictive = driveClosedLoop(true);

    TEST_ASSERT_TRUE(predictive.bounded);
    TEST_ASSERT_LESS_OR_EQUAL_FLOAT(conventional.setpointOvershoot + 0.01f, predictive.setpointOvershoot);
    TEST_ASSERT_LESS_THAN_FLOAT(conventional.disturbanceIae * 0.9f, predictive.disturbanceIae);
}

void test_closed_loop_remains_bounded_with_25_percent_model_mismatch() {
    const auto lowModel = driveClosedLoop(true, 0.75f, 0.75f, 0.75f);
    const auto highModel = driveClosedLoop(true, 1.25f, 1.25f, 1.25f);

    TEST_ASSERT_TRUE(lowModel.bounded);
    TEST_ASSERT_TRUE(highModel.bounded);
    TEST_ASSERT_LESS_THAN_FLOAT(1.0f, lowModel.setpointOvershoot);
    TEST_ASSERT_LESS_THAN_FLOAT(1.0f, highModel.setpointOvershoot);
}

void test_predictor_rejects_flow_disturbance_with_feedforward_disabled() {
    const auto conventional = driveClosedLoop(false, 1.0f, 1.0f, 1.0f, 0.0f);
    const auto predictive = driveClosedLoop(true, 1.0f, 1.0f, 1.0f, 0.0f);

    TEST_ASSERT_TRUE(predictive.bounded);
    TEST_ASSERT_LESS_THAN_FLOAT(conventional.disturbanceIae, predictive.disturbanceIae);
}

void test_full_warmup_stays_bounded_without_material_extra_overshoot() {
    const auto conventional = driveFullWarmup(false);
    const auto predictive = driveFullWarmup(true);

    TEST_ASSERT_TRUE(predictive.bounded);
    TEST_ASSERT_LESS_OR_EQUAL_FLOAT(conventional.setpointOvershoot + 0.05f, predictive.setpointOvershoot);
}
} // namespace

void setUp(void) {}
void tearDown(void) {}

int main(int argc, char **argv) {
    (void)argc;
    (void)argv;
    UNITY_BEGIN();
    RUN_TEST(test_rejects_invalid_model);
    RUN_TEST(test_predicts_heater_response_before_delayed_sensor);
    RUN_TEST(test_flow_load_reduces_predicted_temperature);
    RUN_TEST(test_steady_maintenance_power_is_bumpless);
    RUN_TEST(test_invalid_runtime_input_falls_back_to_sensor);
    RUN_TEST(test_delay_compensation_is_invariant_to_irregular_control_intervals);
    RUN_TEST(test_prediction_is_bounded_to_reachable_temperature);
    RUN_TEST(test_persistent_model_mismatch_latches_until_reset);
    RUN_TEST(test_predictive_control_improves_nominal_closed_loop_response);
    RUN_TEST(test_closed_loop_remains_bounded_with_25_percent_model_mismatch);
    RUN_TEST(test_predictor_rejects_flow_disturbance_with_feedforward_disabled);
    RUN_TEST(test_full_warmup_stays_bounded_without_material_extra_overshoot);
    return UNITY_END();
}
