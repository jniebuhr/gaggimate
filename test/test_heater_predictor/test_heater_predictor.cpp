#include <unity.h>

#include <cmath>

unsigned long gmTestMillis = 0;

#include "SimplePID/SimplePID.cpp"
#include "Autotune/Autotune.cpp"
#include "TemperaturePredictor/TemperaturePredictor.cpp"
#include "../../lib/GaggiMateController/src/peripherals/Heater.cpp"

float TemperatureSensor::read() { return 0.0f; }
bool TemperatureSensor::isErrorState() { return false; }
void TemperatureSensor::setup() {}

namespace {
class FakeTemperatureSensor : public TemperatureSensor {
  public:
    float read() override { return temperature; }
    bool isErrorState() override { return faulted; }
    void setup() override {}

    float temperature = 90.0f;
    bool faulted = false;
};

Heater makeHeater(FakeTemperatureSensor &sensor, int &runawayCount) {
    Heater heater(&sensor, 1, [&runawayCount]() { ++runawayCount; },
                  [](float, float, float, float, float, float, float) {});
    heater.setup();
    heater.setTunings(100.0f, 1.0f, 0.0f);
    heater.configureTemperaturePredictor(true, 17.0f, 0.188f, 3.5f);
    return heater;
}

void tick(Heater &heater, unsigned long milliseconds = 1000) {
    gmTestMillis += milliseconds;
    heater.loop();
}

void test_off_to_automatic_reinitializes_from_current_sensor() {
    FakeTemperatureSensor sensor;
    int runawayCount = 0;
    Heater heater = makeHeater(sensor, runawayCount);
    heater.setSetpoint(93.0f);

    tick(heater);
    TEST_ASSERT_FALSE(heater.isPredictorActive());
    tick(heater);
    TEST_ASSERT_TRUE(heater.isPredictorActive());

    heater.setSetpoint(0.0f);
    tick(heater, 10);
    TEST_ASSERT_FALSE(heater.isPredictorActive());
    TEST_ASSERT_EQUAL_FLOAT(0.0f, heater.getDutyCycle());
    TEST_ASSERT_EQUAL_INT(static_cast<int>(TemperaturePredictor::FallbackReason::Disabled),
                          static_cast<int>(heater.getPredictorFallbackReason()));

    sensor.temperature = 25.0f;
    heater.setSetpoint(93.0f);
    tick(heater);
    TEST_ASSERT_FALSE(heater.isPredictorActive());
    TEST_ASSERT_FLOAT_WITHIN(0.01f, 25.0f, heater.getControlTemperature());
    tick(heater);
    TEST_ASSERT_TRUE(heater.isPredictorActive());
    TEST_ASSERT_NOT_EQUAL(static_cast<int>(TemperaturePredictor::FallbackReason::ModelMismatch),
                          static_cast<int>(heater.getPredictorFallbackReason()));
    TEST_ASSERT_EQUAL_INT(0, runawayCount);
}

void test_sensor_fault_bypasses_and_recovers_without_mismatch() {
    FakeTemperatureSensor sensor;
    int runawayCount = 0;
    Heater heater = makeHeater(sensor, runawayCount);
    heater.setSetpoint(93.0f);
    tick(heater);
    tick(heater);
    TEST_ASSERT_TRUE(heater.isPredictorActive());

    sensor.faulted = true;
    sensor.temperature = 0.0f;
    tick(heater, 10);
    TEST_ASSERT_FALSE(heater.isPredictorActive());
    TEST_ASSERT_EQUAL_FLOAT(0.0f, heater.getDutyCycle());
    TEST_ASSERT_EQUAL_INT(static_cast<int>(TemperaturePredictor::FallbackReason::InvalidInput),
                          static_cast<int>(heater.getPredictorFallbackReason()));

    sensor.faulted = false;
    sensor.temperature = 91.0f;
    tick(heater);
    TEST_ASSERT_FALSE(heater.isPredictorActive());
    tick(heater);
    TEST_ASSERT_TRUE(heater.isPredictorActive());
    TEST_ASSERT_NOT_EQUAL(static_cast<int>(TemperaturePredictor::FallbackReason::ModelMismatch),
                          static_cast<int>(heater.getPredictorFallbackReason()));
}

void test_autotune_timeout_exits_with_predictor_bypassed_and_reset() {
    FakeTemperatureSensor sensor;
    int runawayCount = 0;
    Heater heater = makeHeater(sensor, runawayCount);
    heater.setSetpoint(93.0f);
    tick(heater);
    tick(heater);
    TEST_ASSERT_TRUE(heater.isPredictorActive());

    heater.autotune(1, 1, 1360);
    TEST_ASSERT_FALSE(heater.isPredictorActive());
    heater.loop(); // Constant fake temperature drives the timeout path.
    TEST_ASSERT_FALSE(heater.isPredictorActive());
    TEST_ASSERT_EQUAL_FLOAT(0.0f, heater.getDutyCycle());

    tick(heater);
    TEST_ASSERT_FALSE(heater.isPredictorActive());
    tick(heater);
    TEST_ASSERT_TRUE(heater.isPredictorActive());
}

void test_predicted_overtemperature_inhibits_heat_without_declaring_runaway() {
    FakeTemperatureSensor sensor;
    sensor.temperature = 169.0f;
    int runawayCount = 0;
    Heater heater = makeHeater(sensor, runawayCount);
    heater.configureTemperaturePredictor(true, 2.0f, 5.0f, 0.1f);
    heater.setSetpoint(200.0f);

    bool predictionCutPower = false;
    for (int second = 0; second < 10; ++second) {
        tick(heater);
        if (heater.getControlTemperature() > MAX_SAFE_TEMP && heater.getDutyCycle() == 0.0f) {
            predictionCutPower = true;
            break;
        }
    }
    TEST_ASSERT_TRUE(predictionCutPower);
    TEST_ASSERT_EQUAL_INT(0, runawayCount);
    tick(heater, 10);
    TEST_ASSERT_NOT_EQUAL(static_cast<int>(TemperaturePredictor::FallbackReason::InvalidInput),
                          static_cast<int>(heater.getPredictorFallbackReason()));
    tick(heater, 1000);
    TEST_ASSERT_NOT_EQUAL(static_cast<int>(TemperaturePredictor::FallbackReason::InvalidInput),
                          static_cast<int>(heater.getPredictorFallbackReason()));

    sensor.temperature = 171.0f;
    tick(heater);
    TEST_ASSERT_EQUAL_INT(1, runawayCount);
    TEST_ASSERT_EQUAL_FLOAT(0.0f, heater.getDutyCycle());
}
} // namespace

void setUp(void) { gmTestMillis = 0; }
void tearDown(void) {}

int main(int argc, char **argv) {
    (void)argc;
    (void)argv;
    UNITY_BEGIN();
    RUN_TEST(test_off_to_automatic_reinitializes_from_current_sensor);
    RUN_TEST(test_sensor_fault_bypasses_and_recovers_without_mismatch);
    RUN_TEST(test_autotune_timeout_exits_with_predictor_bypassed_and_reset);
    RUN_TEST(test_predicted_overtemperature_inhibits_heat_without_declaring_runaway);
    return UNITY_END();
}
