#pragma once
#ifndef BEANMANAGER_H
#define BEANMANAGER_H

#include "PluginManager.h"
#include <Arduino.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <vector>

// A coffee bean the user rotates through: a name, the brew profile it's
// dialled in for, and the grind-size setting last used with it. At most
// MAX_BEANS exist. Stored in NVS (not SPIFFS) so they survive filesystem
// re-flashes and OTA updates, which wipe /p and /h.
struct Bean {
    String id;
    String name;
    String profileId;
    float lastGrind = 0.0f;
};

class BeanManager {
  public:
    static constexpr int MAX_BEANS = 4;

    explicit BeanManager(PluginManager *pluginManager);

    void setup();

    std::vector<Bean> list();
    bool find(const String &id, Bean &out);
    // Creates (empty id) or updates. Returns false with `error` set on failure.
    bool save(Bean &bean, String &error);
    bool remove(const String &id);
    bool setLastGrind(const String &id, float grind);

    // The bean the current/last shot was started with from the bean picker.
    void setActive(const String &id, float grind);
    bool getActive(Bean &out, float &grind);
    void clearActive();

    static void writeBean(JsonObject obj, const Bean &bean);

  private:
    void load();
    void persist();
    void persistActive();

    PluginManager *pluginManager;
    Preferences preferences;
    SemaphoreHandle_t mutex;
    std::vector<Bean> beans;
    String activeId;
    float activeGrind = 0.0f;
};

#endif // BEANMANAGER_H
