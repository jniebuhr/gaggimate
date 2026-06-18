// Host shim for Arduino Preferences (NVS): an in-memory key/value store per
// namespace, persisted to sim_data/nvs/<namespace>.json (load/save in the .cpp).
#pragma once

#include "WString.h"
#include <cstdint>
#include <map>
#include <string>

class Preferences {
  public:
    bool begin(const char *name, bool readOnly = false);
    void end();

    size_t putString(const char *key, const String &value) { return setRaw(key, value.c_str()); }
    size_t putString(const char *key, const char *value) { return setRaw(key, value ? value : ""); }
    String getString(const char *key, const String &def = String()) {
        auto it = _kv.find(key);
        return it == _kv.end() ? def : String(it->second.c_str());
    }
    size_t getString(const char *key, char *value, size_t maxLen) {
        auto it = _kv.find(key);
        if (it == _kv.end() || maxLen == 0)
            return 0;
        size_t n = it->second.copy(value, maxLen - 1);
        value[n] = '\0';
        return n;
    }

    size_t putInt(const char *key, int32_t value) { return setRaw(key, std::to_string(value)); }
    int32_t getInt(const char *key, int32_t def = 0) {
        auto it = _kv.find(key);
        return it == _kv.end() ? def : (int32_t)strtol(it->second.c_str(), nullptr, 10);
    }
    size_t putUInt(const char *key, uint32_t value) { return setRaw(key, std::to_string(value)); }
    uint32_t getUInt(const char *key, uint32_t def = 0) {
        auto it = _kv.find(key);
        return it == _kv.end() ? def : (uint32_t)strtoul(it->second.c_str(), nullptr, 10);
    }

    size_t putBool(const char *key, bool value) { return setRaw(key, value ? "1" : "0"); }
    bool getBool(const char *key, bool def = false) {
        auto it = _kv.find(key);
        return it == _kv.end() ? def : it->second == "1";
    }

    size_t putFloat(const char *key, float value) { return setRaw(key, std::to_string(value)); }
    float getFloat(const char *key, float def = 0.0f) {
        auto it = _kv.find(key);
        return it == _kv.end() ? def : strtof(it->second.c_str(), nullptr);
    }

    size_t putDouble(const char *key, double value) { return setRaw(key, std::to_string(value)); }
    double getDouble(const char *key, double def = 0.0) {
        auto it = _kv.find(key);
        return it == _kv.end() ? def : strtod(it->second.c_str(), nullptr);
    }

    bool isKey(const char *key) { return _kv.count(key) > 0; }
    bool remove(const char *key) {
        if (_ro || !_kv.count(key))
            return false;
        _kv.erase(key);
        save();
        return true;
    }
    bool clear() {
        if (_ro)
            return false;
        _kv.clear();
        save();
        return true;
    }

  private:
    size_t setRaw(const char *key, const std::string &value) {
        if (_ro)
            return 0;
        _kv[key] = value;
        save();
        return value.size();
    }
    void load();
    void save();

    std::map<std::string, std::string> _kv;
    std::string _ns;
    bool _ro = false;
};
