#include "BeanManager.h"
#include "utils.h"

namespace {
constexpr const char *PREFS_NS = "beans";
constexpr const char *KEY_JSON = "json";
constexpr const char *KEY_ACTIVE = "active";
constexpr const char *KEY_ACTIVE_GRIND = "agrind";
constexpr const char *LOG_TAG = "BeanManager";

struct Lock {
    explicit Lock(SemaphoreHandle_t m) : m(m) { xSemaphoreTakeRecursive(m, portMAX_DELAY); }
    ~Lock() { xSemaphoreGiveRecursive(m); }
    SemaphoreHandle_t m;
};
} // namespace

BeanManager::BeanManager(PluginManager *pluginManager) : pluginManager(pluginManager) {
    mutex = xSemaphoreCreateRecursiveMutex();
}

void BeanManager::setup() {
    Lock lock(mutex);
    preferences.begin(PREFS_NS, false);
    load();
    ESP_LOGI(LOG_TAG, "Loaded %d beans", beans.size());
}

void BeanManager::load() {
    beans.clear();
    String json = preferences.getString(KEY_JSON, "");
    activeId = preferences.getString(KEY_ACTIVE, "");
    activeGrind = preferences.getFloat(KEY_ACTIVE_GRIND, 0.0f);
    if (json.isEmpty()) {
        return;
    }
    JsonDocument doc;
    if (deserializeJson(doc, json) != DeserializationError::Ok) {
        ESP_LOGW(LOG_TAG, "Stored beans are not valid JSON, starting empty");
        return;
    }
    for (JsonObject obj : doc.as<JsonArray>()) {
        if (beans.size() >= MAX_BEANS) {
            break;
        }
        Bean bean;
        bean.id = obj["id"].as<String>();
        bean.name = obj["name"].as<String>();
        bean.profileId = obj["profileId"].as<String>();
        bean.lastGrind = obj["lastGrind"] | 0.0f;
        if (!bean.id.isEmpty()) {
            beans.push_back(bean);
        }
    }
}

void BeanManager::persist() {
    JsonDocument doc;
    JsonArray arr = doc.to<JsonArray>();
    for (const auto &bean : beans) {
        writeBean(arr.add<JsonObject>(), bean);
    }
    String json;
    serializeJson(doc, json);
    preferences.putString(KEY_JSON, json);
    pluginManager->trigger("beans:change");
}

void BeanManager::persistActive() {
    preferences.putString(KEY_ACTIVE, activeId);
    preferences.putFloat(KEY_ACTIVE_GRIND, activeGrind);
}

void BeanManager::writeBean(JsonObject obj, const Bean &bean) {
    obj["id"] = bean.id;
    obj["name"] = bean.name;
    obj["profileId"] = bean.profileId;
    obj["lastGrind"] = bean.lastGrind;
}

std::vector<Bean> BeanManager::list() {
    Lock lock(mutex);
    return beans;
}

bool BeanManager::find(const String &id, Bean &out) {
    Lock lock(mutex);
    for (const auto &bean : beans) {
        if (bean.id == id) {
            out = bean;
            return true;
        }
    }
    return false;
}

bool BeanManager::save(Bean &bean, String &error) {
    Lock lock(mutex);
    bean.name.trim();
    if (bean.name.isEmpty()) {
        error = "Name is required";
        return false;
    }
    if (bean.profileId.isEmpty()) {
        error = "Profile is required";
        return false;
    }
    if (!bean.id.isEmpty()) {
        for (auto &existing : beans) {
            if (existing.id == bean.id) {
                existing.name = bean.name;
                existing.profileId = bean.profileId;
                bean.lastGrind = existing.lastGrind;
                persist();
                return true;
            }
        }
    }
    if (beans.size() >= MAX_BEANS) {
        error = String("Max ") + MAX_BEANS + " beans";
        return false;
    }
    bean.id = generateShortID(6);
    bean.lastGrind = 0.0f;
    beans.push_back(bean);
    persist();
    return true;
}

bool BeanManager::remove(const String &id) {
    Lock lock(mutex);
    for (auto it = beans.begin(); it != beans.end(); ++it) {
        if (it->id == id) {
            beans.erase(it);
            if (activeId == id) {
                activeId = "";
                activeGrind = 0.0f;
                persistActive();
            }
            persist();
            return true;
        }
    }
    return false;
}

bool BeanManager::setLastGrind(const String &id, float grind) {
    Lock lock(mutex);
    for (auto &bean : beans) {
        if (bean.id == id) {
            bean.lastGrind = grind;
            persist();
            return true;
        }
    }
    return false;
}

void BeanManager::setActive(const String &id, float grind) {
    Lock lock(mutex);
    activeId = id;
    activeGrind = grind;
    persistActive();
}

bool BeanManager::getActive(Bean &out, float &grind) {
    Lock lock(mutex);
    if (activeId.isEmpty()) {
        return false;
    }
    for (const auto &bean : beans) {
        if (bean.id == activeId) {
            out = bean;
            grind = activeGrind;
            return true;
        }
    }
    return false;
}

void BeanManager::clearActive() {
    Lock lock(mutex);
    activeId = "";
    activeGrind = 0.0f;
    persistActive();
}
