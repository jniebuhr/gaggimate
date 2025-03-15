#include "PluginManager.h"

void PluginManager::registerPlugin(Plugin *plugin) { plugins.push_back(plugin); }

void PluginManager::setup(Controller *controller) {
    printf("Setting up PluginManager\n");
    on("system:dummy", [](const Event &) {
        // Register a dummy event so the event map is initialized properly
    });
    for (const auto &plugin : plugins) {
        plugin->setup(controller, this);
    }
    initialized = true;
}

void PluginManager::loop() {
    if (!initialized)
        return;
    for (auto &plugin : plugins) {
        plugin->loop();
    }
}

void PluginManager::on(const String &eventId, const EventCallback &callback) {
    printf("Registering listener: %s\n", eventId.c_str());
    listeners[std::string(eventId.c_str())].push_back(callback);
}

Event PluginManager::trigger(const String &eventId) {
    Event event;
    event.id = eventId;
    trigger(event);
    return event;
}

Event PluginManager::trigger(const String &eventId, const String &key, const String &value) {
    Event event;
    event.id = eventId;
    event.setString(key, value);
    trigger(event);
    return event;
}

Event PluginManager::trigger(const String &eventId, const String &key, const int value) {
    Event event;
    event.id = eventId;
    event.setInt(key, value);
    trigger(event);
    return event;
}

Event PluginManager::trigger(const String &eventId, const String &key, const float value) {
    Event event;
    event.id = eventId;
    event.setFloat(key, value);
    trigger(event);
    return event;
}

void PluginManager::trigger(Event &event) {
    printf("Triggering event: %s\n", event.id.c_str());
    if (listeners.count(std::string(event.id.c_str()))) {
        for (auto const &callback : listeners[std::string(event.id.c_str())]) {
            callback(event);
            if (event.stopPropagation) {
                break;
            }
        }
    }
}
