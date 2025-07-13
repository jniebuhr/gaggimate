#ifndef TEMPERATURESENSOR_H
#define TEMPERATURESENSOR_H

class TemperatureSensor {
  public:
    virtual float read();
    virtual bool isErrorState();
};

#endif // TEMPERATURESENSOR_H
