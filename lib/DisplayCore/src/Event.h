#ifndef EVENT_H
#define EVENT_H

#include <Arduino.h>
#include <vector>

enum class EventDataType { EVENT_TYPE_INT, EVENT_TYPE_FLOAT, EVENT_TYPE_STRING, EVENT_TYPE_NONE };

struct EventDataEntry {
    String key;
    EventDataType type = EventDataType::EVENT_TYPE_NONE;
    int intValue = 0;
    float floatValue = 0.0f;
    String stringValue = "";

    EventDataEntry() = default;

    EventDataEntry(const String &k, int value) : key(k), type(EventDataType::EVENT_TYPE_INT), intValue(value) {}

    EventDataEntry(const String &k, float value) : key(k), type(EventDataType::EVENT_TYPE_FLOAT), floatValue(value) {}

    EventDataEntry(const String &k, const String &value) : key(k), type(EventDataType::EVENT_TYPE_STRING), stringValue(value) {}
};

using EventData = std::vector<EventDataEntry>;

struct Event {
    String id;
    EventData data;
    bool stopPropagation = false;

    void setInt(const String &key, int value) { data.emplace_back(key, value); }

    void setFloat(const String &key, float value) { data.emplace_back(key, value); }

    void setString(const String &key, const String &value) { data.emplace_back(key, value); }

    int getInt(const String &key) const {
        for (const auto &entry : data) {
            if (entry.key == key && entry.type == EventDataType::EVENT_TYPE_INT) {
                return entry.intValue;
            }
        }
        return 0;
    }

    float getFloat(const String &key) const {
        for (const auto &entry : data) {
            if (entry.key == key && entry.type == EventDataType::EVENT_TYPE_FLOAT) {
                return entry.floatValue;
            }
        }
        return 0.0f;
    }

    String getString(const String &key) const {
        for (const auto &entry : data) {
            if (entry.key == key && entry.type == EventDataType::EVENT_TYPE_STRING) {
                return entry.stringValue;
            }
        }
        return "";
    }
};

#endif // EVENT_H
