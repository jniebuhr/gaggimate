// Host shim for ESPmDNS.h: mDNS is unavailable in the simulator (no-op).
#pragma once

#include "IPAddress.h"
#include "WString.h"
#include <stdint.h>

class MDNSResponder {
  public:
    bool begin(const char *hostname) {
        (void)hostname;
        return true;
    }
    void end() {}
    void setInstanceName(const String &name) { (void)name; }
    bool addService(const char *service, const char *proto, uint16_t port) {
        (void)service;
        (void)proto;
        (void)port;
        return true;
    }
    bool addServiceTxt(const char *s, const char *p, const char *k, const char *v) {
        (void)s;
        (void)p;
        (void)k;
        (void)v;
        return true;
    }
    int queryService(const char *service, const char *proto) {
        (void)service;
        (void)proto;
        return 0;
    }
    IPAddress queryHost(const char *host, uint32_t timeout = 2000) {
        (void)host;
        (void)timeout;
        return IPAddress();
    }
    String hostname(int idx) {
        (void)idx;
        return String();
    }
    IPAddress IP(int idx) {
        (void)idx;
        return IPAddress();
    }
    uint16_t port(int idx) {
        (void)idx;
        return 0;
    }
};

extern MDNSResponder MDNS;
