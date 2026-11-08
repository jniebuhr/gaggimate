#ifndef FLOWSENSOR_H
#define FLOWSENSOR_H
#include <Arduino.h>

constexpr float ML_PER_PULSE = 0.19;

using flow_amount_callback_t = std::function<void(float)>;

class FlowSensor {
  public:
    FlowSensor(uint8_t pin, flow_amount_callback_t callback);
    ~FlowSensor() = default;

    void setup();
    void loop();
    void tare();

    static void onInterrupt();

    float getVolume() {
        ESP_LOGI("FlowSensor", "getVolume: %d, %.2f", _ticks, _ticks * ML_PER_PULSE);
        return _ticks * ML_PER_PULSE;
    };
    float getFlow() const;

  private:
    void updateValue(int ticks);
    void addValue(int ticks);

    uint8_t _pin;
    flow_amount_callback_t _callback;
    int _ticks = 0;
    xTaskHandle taskHandle;
    float _currentFlow = 0.0f;
    int _lastRunTicks = 0;

    const char *LOG_TAG = "FlowSensor";
    static void loopTask(void *arg);

    static FlowSensor *_instance;
};

#endif // FLOWSENSOR_H
