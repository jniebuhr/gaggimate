// Simulator stand-in for src/display/main.h: exposes a fake `controller`
// with the calls the bean-picker screens make, and records them so the
// scenario can assert the start sequence.
#pragma once
#include <Arduino.h>
#include <display/core/BeanManager.h>
#include <string>
#include <vector>

#include "lvgl.h"

#define MODE_STANDBY 0
#define MODE_BREW 1
#define MODE_STEAM 2
#define MODE_WATER 3
#define MODE_GRIND 4

class SimUI {
  public:
    void changeScreen(lv_obj_t **screen, void (*init)()) {
        targetScreen = screen;
        targetInit = init;
    }
    lv_obj_t **targetScreen = nullptr;
    void (*targetInit)() = nullptr;
};

class Controller {
  public:
    SimUI *getUI() { return &ui; }
    BeanManager *getBeanManager() { return &beans; }
    void deactivate() { calls.push_back("deactivate"); }
    void clear() { calls.push_back("clear"); }
    void setMode(int m) {
        mode = m;
        calls.push_back("setMode(" + std::to_string(m) + ")");
    }
    void activate() { calls.push_back("activate"); }
    bool startBeanShot(const String &beanId, float grind, String &error) {
        calls.push_back("startBeanShot(" + beanId.v + "," + std::to_string(grind) + ")");
        if (failNext) {
            failNext = false;
            error = "Controller not connected";
            return false;
        }
        Bean b;
        beans.find(beanId, b);
        beans.setLastGrind(beanId, grind);
        calls.push_back("selectProfile(" + b.profileId.v + ")");
        setMode(MODE_BREW);
        activate();
        return true;
    }
    SimUI ui;
    BeanManager beans;
    int mode = MODE_BREW;
    bool failNext = false;
    std::vector<std::string> calls;
};

extern Controller controller;
