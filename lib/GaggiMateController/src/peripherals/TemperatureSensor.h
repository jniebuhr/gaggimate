#ifndef TEMPERATURESENSOR_H
#define TEMPERATURESENSOR_H

class TemperatureSensor {
  public:
    virtual float read();
    virtual bool hasError();
};

#endif // TEMPERATURESENSOR_H
