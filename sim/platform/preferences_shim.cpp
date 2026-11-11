// Persistence for the Preferences shim: one JSON file per namespace.
#include "Preferences.h"

#include <ArduinoJson.h>
#include <sys/stat.h>

static std::string nsPath(const std::string &ns) { return "sim_data/nvs/" + ns + ".json"; }

// One store per namespace, shared by all Preferences instances (and the nvs.h shim), loaded once.
static std::map<std::string, std::map<std::string, std::string>> &stores() {
    static std::map<std::string, std::map<std::string, std::string>> all;
    return all;
}

bool Preferences::begin(const char *name, bool readOnly) {
    _ns = name ? name : "default";
    _ro = readOnly;
    const bool fresh = stores().count(_ns) == 0;
    _kv = &stores()[_ns];
    if (fresh)
        load();
    return true;
}

void Preferences::end() {
    if (_kv && !_ro)
        save();
    _ns.clear();
}

void Preferences::load() {
    FILE *fp = fopen(nsPath(_ns).c_str(), "rb");
    if (!fp)
        return;
    std::string buf;
    char chunk[4096];
    size_t n;
    while ((n = fread(chunk, 1, sizeof(chunk), fp)) > 0)
        buf.append(chunk, n);
    fclose(fp);

    JsonDocument doc;
    if (deserializeJson(doc, buf.c_str()) == DeserializationError::Ok) {
        for (JsonPair entry : doc.as<JsonObject>()) {
            const char *v = entry.value().as<const char *>();
            kv()[entry.key().c_str()] = v ? v : "";
        }
    }
}

void Preferences::save() {
    ::mkdir("sim_data", 0755);
    ::mkdir("sim_data/nvs", 0755);
    JsonDocument doc;
    for (auto &entry : *_kv)
        doc[entry.first.c_str()] = entry.second.c_str();
    String out;
    serializeJson(doc, out);
    FILE *fp = fopen(nsPath(_ns).c_str(), "wb");
    if (!fp)
        return;
    fwrite(out.c_str(), 1, out.length(), fp);
    fclose(fp);
}
