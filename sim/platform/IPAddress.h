// Host shim for Arduino IPAddress.
#pragma once

#include "WString.h"
#include <stdint.h>
#include <stdio.h>

class IPAddress {
  public:
    IPAddress() : _addr{0, 0, 0, 0} {}
    IPAddress(uint8_t a, uint8_t b, uint8_t c, uint8_t d) : _addr{a, b, c, d} {}
    IPAddress(uint32_t addr) {
        _addr[0] = addr & 0xff;
        _addr[1] = (addr >> 8) & 0xff;
        _addr[2] = (addr >> 16) & 0xff;
        _addr[3] = (addr >> 24) & 0xff;
    }
    uint8_t operator[](int i) const { return _addr[i]; }
    uint8_t &operator[](int i) { return _addr[i]; }
    bool operator==(const IPAddress &o) const {
        return _addr[0] == o._addr[0] && _addr[1] == o._addr[1] && _addr[2] == o._addr[2] && _addr[3] == o._addr[3];
    }
    bool operator!=(const IPAddress &o) const { return !(*this == o); }
    operator uint32_t() const {
        return (uint32_t)_addr[0] | ((uint32_t)_addr[1] << 8) | ((uint32_t)_addr[2] << 16) | ((uint32_t)_addr[3] << 24);
    }
    String toString() const {
        char buf[16];
        snprintf(buf, sizeof(buf), "%u.%u.%u.%u", _addr[0], _addr[1], _addr[2], _addr[3]);
        return String(buf);
    }

  private:
    uint8_t _addr[4];
};

const IPAddress INADDR_NONE(0, 0, 0, 0);
