// Persistence for the Preferences shim: one JSON file per namespace.
#include "Preferences.h"

#include <ArduinoJson.h>
#include <sys/stat.h>

static std::string nsPath(const std::string &ns) { return "sim_data/nvs/" + ns + ".json"; }

bool Preferences::begin(const char *name, bool readOnly) {
    _ns = name ? name : "default";
    _ro = readOnly;
    _kv.clear();
    load();
    return true;
}

void Preferences::end() {
    save();
    _kv.clear();
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
        for (JsonPair kv : doc.as<JsonObject>()) {
            const char *v = kv.value().as<const char *>();
            _kv[kv.key().c_str()] = v ? v : "";
        }
    }
}

void Preferences::save() {
    ::mkdir("sim_data", 0755);
    ::mkdir("sim_data/nvs", 0755);
    JsonDocument doc;
    for (auto &kv : _kv)
        doc[kv.first.c_str()] = kv.second.c_str();
    String out;
    serializeJson(doc, out);
    FILE *fp = fopen(nsPath(_ns).c_str(), "wb");
    if (!fp)
        return;
    fwrite(out.c_str(), 1, out.length(), fp);
    fclose(fp);
}
