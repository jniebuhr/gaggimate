// Host shim for HTTPClient.h: outbound HTTP is unavailable in the simulator.
#pragma once

#include "WString.h"
#include <stdint.h>

#define HTTP_CODE_OK 200

class HTTPClient {
  public:
    bool begin(const String &url) {
        (void)url;
        return true;
    }
    bool begin(const char *url) {
        (void)url;
        return true;
    }
    void end() {}
    void setTimeout(uint16_t t) { (void)t; }
    void setConnectTimeout(int t) { (void)t; }
    void addHeader(const String &name, const String &value) {
        (void)name;
        (void)value;
    }
    int GET() { return -1; }
    int POST(const String &payload) {
        (void)payload;
        return -1;
    }
    String getString() { return String(); }
    String errorToString(int code) {
        (void)code;
        return String("disabled in simulator");
    }
};
