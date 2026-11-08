// Host shim for DNSServer (captive portal): no-op in the simulator.
#pragma once

#include "IPAddress.h"
#include "WString.h"
#include <stdint.h>

class DNSServer {
  public:
    void setTTL(uint32_t) {}
    bool start(uint16_t port, const String &domainName, const IPAddress &resolvedIP) {
        (void)port;
        (void)domainName;
        (void)resolvedIP;
        return true;
    }
    void stop() {}
    void processNextRequest() {}
};
