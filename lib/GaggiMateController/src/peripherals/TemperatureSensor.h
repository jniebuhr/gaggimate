#ifndef TEMPERATURESENSOR_H
#define TEMPERATURESENSOR_H

constexpr double MAX_SAFE_TEMP = 170.0;

class TemperatureSensor {
  public:
    virtual ~TemperatureSensor() = default;
    virtual float read();
    virtual bool isErrorState();
    virtual void setup();
};

#endif // TEMPERATURESENSOR_H
