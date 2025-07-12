#include "ShotHistoryPlugin.h"
#include "BLEScalePlugin.h"
#include <SPIFFS.h>
#include <display/core/Controller.h>
#include <display/core/ProfileManager.h>
#include <display/core/utils.h>

ShotHistoryPlugin ShotHistory;

void ShotHistoryPlugin::setup(Controller *c, PluginManager *pm) {
    controller = c;
    pluginManager = pm;
    pm->on("controller:brew:start", [this](Event const &) { startRecording(); });
    pm->on("controller:brew:end", [this](Event const &) { endRecording(); });
}

void ShotHistoryPlugin::loop() {
    if (recording && controller->getMode() == MODE_BREW) {
        unsigned long now = millis();
        if (now - lastSample >= SHOT_HISTORY_INTERVAL) {
            lastSample = now;
            ShotSample s{now - shotStart,
                         controller->getTargetTemp(),
                         controller->getCurrentTemp(),
                         controller->getTargetPressure(),
                         controller->getCurrentPressure(),
                         BLEScales.isConnected() ? BLEScales.getLastWeight() : 0.0f,
                         controller->getCurrentFlow(),
                         controller->getEstimatedWeight()};
            shot.push_back(s);
        }
    }
}

void ShotHistoryPlugin::startRecording() {
    recording = true;
    shot.clear();
    shotStart = millis();
    lastSample = 0;
    currentProfileName = controller->getProfileManager()->getSelectedProfile().label;
}

void ShotHistoryPlugin::endRecording() {
    recording = false;
    unsigned long duration = millis() - shotStart;
    if (duration > 5000) {
        if (!SPIFFS.exists("/h")) {
            SPIFFS.mkdir("/h");
        }
        String id = generateShortID();
        File file = SPIFFS.open("/h/" + id + ".json", "w");
        if (file) {
            JsonDocument doc;
            doc["version"] = 1;
            doc["profile"] = currentProfileName;
            doc["timestamp"] = shotStart;
            JsonArray arr = doc.createNestedArray("samples");
            for (const auto &s : shot) {
                JsonObject o = arr.createNestedObject();
                o["t"] = s.t;
                o["tt"] = s.tt;
                o["ct"] = s.ct;
                o["tp"] = s.tp;
                o["cp"] = s.cp;
                o["sw"] = s.sw;
                o["fl"] = s.fl;
                o["ew"] = s.ew;
            }
            serializeJson(doc, file);
            file.close();
        }
    }
    shot.clear();
}

void ShotHistoryPlugin::handleRequest(JsonDocument &request, JsonDocument &response) {
    String type = request["tp"].as<String>();
    response["tp"] = String("res:") + type.substring(4);
    response["rid"] = request["rid"].as<String>();

    if (type == "req:history:list") {
        JsonArray arr = response["history"].to<JsonArray>();
        File root = SPIFFS.open("/h");
        if (root && root.isDirectory()) {
            File file = root.openNextFile();
            while (file) {
                if (String(file.name()).endsWith(".json")) {
                    JsonDocument d;
                    if (!deserializeJson(d, file)) {
                        JsonObject o = arr.createNestedObject();
                        String name = String(file.name());
                        int start = name.lastIndexOf('/') + 1;
                        int end = name.lastIndexOf('.');
                        o["id"] = name.substring(start, end);
                        o["profile"] = d["profile"].as<String>();
                        o["timestamp"] = d["timestamp"].as<unsigned long>();
                    }
                }
                file = root.openNextFile();
            }
        }
    } else if (type == "req:history:get") {
        String id = request["id"].as<String>();
        File file = SPIFFS.open("/h/" + id + ".json", "r");
        if (file) {
            String data = file.readString();
            response["history"] = data;
            file.close();
        } else {
            response["error"] = "not found";
        }
    }
}
