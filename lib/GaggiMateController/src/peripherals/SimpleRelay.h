#ifndef SIMPLERELAY_H
#define SIMPLERELAY_H

#include <Arduino.h>

class SimpleRelay {
  public:
    SimpleRelay(int pin, uint8_t onState);
    ~SimpleRelay() = default;

    void setup();
    void set(bool state);
    inline bool getState() const { return state; }

  private:
    int _pin;
    uint8_t _onState;
    bool state;

    const char *LOG_TAG = "SimpleRelay";
};

#endif // SIMPLERELAY_H
