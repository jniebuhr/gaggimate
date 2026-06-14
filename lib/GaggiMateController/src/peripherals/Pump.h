#ifndef PUMP_H
#define PUMP_H

class Pump {
  public:
    virtual ~Pump() = default;

    virtual void setup();
    virtual void loop();
    virtual void setPower(float setpoint);
    virtual float *getPumpPowerPtr(); // For external pump control
    virtual float getDutyCycle() const { return 0.0f; } // current duty cycle 0..100 %
};

#endif // PUMP_H
