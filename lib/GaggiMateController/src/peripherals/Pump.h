#ifndef PUMP_H
#define PUMP_H

class Pump {
  public:
    virtual ~Pump() = default;

    virtual void setup() = 0;
    virtual void loop() = 0;
    virtual void setPower(float setpoint) = 0;
};

#endif // PUMP_H
