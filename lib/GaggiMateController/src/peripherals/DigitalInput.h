#ifndef DIGITALINPUT_H
#define DIGITALINPUT_H

#include <Arduino.h>

constexpr int INPUT_CHECK_INTERVAL_MS = 100;

using input_callback_t = std::function<void(const bool state)>;

class DigitalInput {
  public:
    DigitalInput(uint8_t pin, const input_callback_t &callback);
    void setup();
    void loop();

  private:
    uint8_t _pin;
    uint8_t _last_state = HIGH;
    xTaskHandle taskHandle;
    input_callback_t _callback;

    const char *LOG_TAG = "Heater";
    static void loopTask(void *arg);
};

#endif // DIGITALINPUT_H
