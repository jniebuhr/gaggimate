#ifndef DIGITALINPUT_H
#define DIGITALINPUT_H

#include <Arduino.h>

constexpr int INPUT_CHECK_INTERVAL_MS = 100;

using input_callback_t = std::function<void(const bool state)>;
using combined_callback_t = std::function<void(const uint8_t state)>;

class DigitalInput {
  public:
    // Single pin constructor — original behavior
    DigitalInput(uint8_t pin, const input_callback_t &callback);

    // Dual pin constructor — combined state
    // state: 0b00=both released, 0b01=steam, 0b10=brew, 0b11=both
    DigitalInput(uint8_t pin1, uint8_t pin2, const combined_callback_t &callback);

    void setup();

  private:
    uint8_t _pin1;
    uint8_t _pin2 = 255; // 255 = not used (single pin mode)
    uint8_t _lastState = 0;
    input_callback_t _singleCallback;
    combined_callback_t _combinedCallback;
    xTaskHandle taskHandle;

    void loopSingle();
    void loopCombined();

    const char *LOG_TAG = "DigitalInput";
    static void loopTask(void *arg);
};

#endif // DIGITALINPUT_H
