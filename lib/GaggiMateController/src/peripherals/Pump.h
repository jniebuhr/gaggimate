#ifndef PUMP_H
#define PUMP_H

class Pump {
  public:
    virtual ~Pump() = default;

    virtual void setup();
    virtual void loop();
    virtual void setPower(float setpoint);
};

#endif // PUMP_H
