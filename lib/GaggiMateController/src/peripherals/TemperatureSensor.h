#ifndef TEMPERATURESENSOR_H
#define TEMPERATURESENSOR_H

class TemperatureSensor {
  public:
    virtual float read() = 0;
    virtual bool isErrorState() = 0;
};

#endif // TEMPERATURESENSOR_H
