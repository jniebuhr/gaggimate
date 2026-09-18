// Minimal Arduino shim for the native simulator: just enough of String and
// the few helpers the bean-picker UI code touches.
#pragma once
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <string>

class String {
  public:
    String() = default;
    String(const char *s) : v(s ? s : "") {}
    String(const std::string &s) : v(s) {}
    String(float f, int digits) {
        char buf[32];
        snprintf(buf, sizeof(buf), "%.*f", digits, f);
        v = buf;
    }
    const char *c_str() const { return v.c_str(); }
    unsigned length() const { return v.size(); }
    bool isEmpty() const { return v.empty(); }
    void trim() {
        while (!v.empty() && isspace((unsigned char)v.back())) v.pop_back();
        size_t i = 0;
        while (i < v.size() && isspace((unsigned char)v[i])) i++;
        v.erase(0, i);
    }
    bool operator==(const String &o) const { return v == o.v; }
    bool operator!=(const String &o) const { return v != o.v; }
    String operator+(const String &o) const { return String(v + o.v); }
    String operator+(const char *o) const { return String(v + o); }
    String &operator+=(const String &o) { v += o.v; return *this; }
    std::string v;
};

extern unsigned long sim_millis;
inline unsigned long millis() { return sim_millis; }

#define ESP_LOGI(tag, fmt, ...) printf("[I][%s] " fmt "\n", tag, ##__VA_ARGS__)
#define ESP_LOGW(tag, fmt, ...) printf("[W][%s] " fmt "\n", tag, ##__VA_ARGS__)
#define ESP_LOGE(tag, fmt, ...) printf("[E][%s] " fmt "\n", tag, ##__VA_ARGS__)
