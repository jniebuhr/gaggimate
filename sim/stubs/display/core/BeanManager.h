// Simulator stub of BeanManager: same public surface the UI code uses, backed
// by an in-memory list the scenario can seed.
#pragma once
#include <Arduino.h>
#include <vector>

struct Bean {
    String id;
    String name;
    String profileId;
    float lastGrind = 0.0f;
};

class BeanManager {
  public:
    static constexpr int MAX_BEANS = 4;
    std::vector<Bean> list() { return beans; }
    bool find(const String &id, Bean &out) {
        for (auto &b : beans)
            if (b.id == id) { out = b; return true; }
        return false;
    }
    bool setLastGrind(const String &id, float grind) {
        for (auto &b : beans)
            if (b.id == id) { b.lastGrind = grind; return true; }
        return false;
    }
    std::vector<Bean> beans;
};
