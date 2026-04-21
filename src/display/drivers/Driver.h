
#ifndef DRIVER_H
#define DRIVER_H

class Driver {
  public:
    virtual ~Driver() = default;

    virtual bool isCompatible() { return false; }
    virtual void init() {}
    virtual void setBrightness(int /*brightness*/) {}
    virtual bool supportsSDCard() { return false; }
    virtual bool installSDCard() { return false; }
};

#endif // DRIVER_H
