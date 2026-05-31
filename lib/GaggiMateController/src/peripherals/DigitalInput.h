#ifndef DIGITALINPUT_H
#define DIGITALINPUT_H

#include <Arduino.h>

constexpr int INPUT_CHECK_INTERVAL_MS = 100;

using input_callback_t = std::function<void(const bool state)>;

class DigitalInput {
  public:
    DigitalInput(uint8_t pin, const input_callback_t &callback, int debounce_count = 1);
    void setup();
    void loop();
    bool getState() const { return !_current_state; };

  private:
    uint8_t _pin;
    uint8_t _debounce_count;
    uint8_t _stable_counter = 0;
    int _current_state = 2;
    int _last_state = 2;
    xTaskHandle taskHandle;
    input_callback_t _callback;

    const char *LOG_TAG = "DigitalInput";
    static void loopTask(void *arg);
};

#endif // DIGITALINPUT_H
