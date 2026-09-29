#ifndef SOFTWIREBUS_H
#define SOFTWIREBUS_H

#include <Arduino.h>
#include <SoftWire.h>

// Serialises a bit-banged SoftWire bus across tasks and can un-stick it.
class SoftWireBus {
  public:
    explicit SoftWireBus(SoftWire *wire);
    SoftWire *wire() const { return _wire; }
    bool lock(uint32_t timeoutMs = 500);
    void unlock();
    // Caller must hold the lock; returns true if both lines idle high afterwards.
    bool clear();

    class Guard {
      public:
        explicit Guard(SoftWireBus *bus, uint32_t timeoutMs = 500) : _bus(bus), _locked(bus->lock(timeoutMs)) {}
        ~Guard() {
            if (_locked)
                _bus->unlock();
        }
        Guard(const Guard &) = delete;
        Guard &operator=(const Guard &) = delete;
        explicit operator bool() const { return _locked; }

      private:
        SoftWireBus *_bus;
        bool _locked;
    };

  private:
    SoftWire *_wire;
    SemaphoreHandle_t _mutex;
};

#endif // SOFTWIREBUS_H
