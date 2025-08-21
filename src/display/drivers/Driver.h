
#ifndef DRIVER_H
#define DRIVER_H

class Driver {
  public:
    virtual ~Driver() = default;

    virtual bool isCompatible();
    virtual void init();
    virtual void setBrightness(int brightness);
};

#endif // DRIVER_H
