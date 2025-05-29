
#ifndef DRIVER_H
#define DRIVER_H

class Driver {
  public:
    virtual ~Driver() = default;

    virtual bool isCompatible();
    virtual void init();
};

#endif // DRIVER_H
