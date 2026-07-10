#pragma once
#ifndef PROPERTY_H
#define PROPERTY_H

#include <Arduino.h>
#include <Preferences.h>
#include <display/core/utils.h>
#include <vector>

// Type-specific NVS access used by Property<T>; add a specialization to support a new type.
template <typename T> struct PreferencesCodec;

template <> struct PreferencesCodec<int> {
    static int read(Preferences &prefs, const char *key, const int &def) { return prefs.getInt(key, def); }
    static void write(Preferences &prefs, const char *key, const int &value) { prefs.putInt(key, value); }
};

template <> struct PreferencesCodec<bool> {
    static bool read(Preferences &prefs, const char *key, const bool &def) { return prefs.getBool(key, def); }
    static void write(Preferences &prefs, const char *key, const bool &value) { prefs.putBool(key, value); }
};

template <> struct PreferencesCodec<float> {
    static float read(Preferences &prefs, const char *key, const float &def) { return prefs.getFloat(key, def); }
    static void write(Preferences &prefs, const char *key, const float &value) { prefs.putFloat(key, value); }
};

template <> struct PreferencesCodec<double> {
    static double read(Preferences &prefs, const char *key, const double &def) { return prefs.getDouble(key, def); }
    static void write(Preferences &prefs, const char *key, const double &value) { prefs.putDouble(key, value); }
};

template <> struct PreferencesCodec<String> {
    static String read(Preferences &prefs, const char *key, const String &def) { return prefs.getString(key, def); }
    static void write(Preferences &prefs, const char *key, const String &value) { prefs.putString(key, value); }
};

template <> struct PreferencesCodec<std::vector<String>> {
    static std::vector<String> read(Preferences &prefs, const char *key, const std::vector<String> &def) {
        if (!prefs.isKey(key))
            return def;
        return explode(prefs.getString(key, ""), ',');
    }
    static void write(Preferences &prefs, const char *key, const std::vector<String> &value) {
        prefs.putString(key, implode(value, ","));
    }
};

class PropertyBase {
  public:
    virtual ~PropertyBase() = default;
    virtual void load(Preferences &prefs) = 0;
    virtual void store(Preferences &prefs) = 0;
    virtual bool isDirty() const = 0;
};

using PropertyRegistry = std::vector<PropertyBase *>;

// A persisted setting: tracks its own dirty state so only changed values hit NVS.
template <typename T> class Property : public PropertyBase {
  public:
    Property(PropertyRegistry &registry, const char *key, T defaultValue) : key(key), value(std::move(defaultValue)) {
        registry.push_back(this);
    }

    const T &get() const { return value; }

    // Returns true if the value changed and was marked for persisting.
    bool set(const T &newValue) {
        if (value == newValue)
            return false;
        value = newValue;
        dirty = true;
        return true;
    }

    // Overrides the value without marking it dirty (migration defaults for absent keys).
    void initDefault(const T &newValue) { value = newValue; }

    bool isDirty() const override { return dirty; }

    void load(Preferences &prefs) override { value = PreferencesCodec<T>::read(prefs, key, value); }

    void store(Preferences &prefs) override {
        if (!dirty)
            return;
        // Clear before writing so a concurrent set() is not lost, only deferred to the next flush.
        dirty = false;
        PreferencesCodec<T>::write(prefs, key, value);
    }

  private:
    const char *key;
    T value;
    bool dirty = false;
};

#endif // PROPERTY_H
