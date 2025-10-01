#include "ShotHistoryPlugin.h"

#include <SPIFFS.h>
#include <display/core/Controller.h>
#include <display/core/ProfileManager.h>
#include <display/core/utils.h>
#include <display/models/shot_log_format.h>

ShotHistoryPlugin ShotHistory;

void ShotHistoryPlugin::setup(Controller *c, PluginManager *pm) {
    controller = c;
    pluginManager = pm;
    pm->on("controller:brew:start", [this](Event const &) { startRecording(); });
    pm->on("controller:brew:end", [this](Event const &) { endRecording(); });
    pm->on("controller:volumetric-measurement:estimation:change",
           [this](Event const &event) { currentEstimatedWeight = event.getFloat("value"); });
    pm->on("controller:volumetric-measurement:bluetooth:change",
           [this](Event const &event) { currentBluetoothWeight = event.getFloat("value"); });
    pm->on("boiler:currentTemperature:change", [this](Event const &event) { currentTemperature = event.getFloat("value"); });
    pm->on("pump:puck-resistance:change", [this](Event const &event) { currentPuckResistance = event.getFloat("value"); });
    xTaskCreatePinnedToCore(loopTask, "ShotHistoryPlugin::loop", configMINIMAL_STACK_SIZE * 4, this, 1, &taskHandle, 0);
}

void ShotHistoryPlugin::record() {
    if (recording && controller->getMode() == MODE_BREW) {
        if (!isFileOpen) {
            if (!SPIFFS.exists("/h")) {
                SPIFFS.mkdir("/h");
            }
            currentFile = SPIFFS.open("/h/" + currentId + ".slog", FILE_WRITE);
            if (currentFile) {
                isFileOpen = true;
                // Prepare header
                memset(&header, 0, sizeof(header));
                header.magic = SHOT_LOG_MAGIC;
                header.version = SHOT_LOG_VERSION;
                header.reserved0 = (uint8_t)SHOT_LOG_SAMPLE_SIZE; // record sample size actually used
                header.headerSize = SHOT_LOG_HEADER_SIZE;
                header.sampleInterval = SHOT_LOG_SAMPLE_INTERVAL_MS;
                header.fieldsMask = SHOT_LOG_FIELDS_MASK_ALL;
                header.startEpoch = getTime();
                Profile profile = controller->getProfileManager()->getSelectedProfile();
                strncpy(header.profileId, profile.id.c_str(), sizeof(header.profileId) - 1);
                header.profileId[sizeof(header.profileId) - 1] = '\0';
                strncpy(header.profileName, profile.label.c_str(), sizeof(header.profileName) - 1);
                header.profileName[sizeof(header.profileName) - 1] = '\0';
                // Write header placeholder
                currentFile.write(reinterpret_cast<const uint8_t *>(&header), sizeof(header));
            }
        }
        float btDiff = currentBluetoothWeight - lastBluetoothWeight;
        float btFlow = btDiff / 0.25f;
        currentBluetoothFlow = currentBluetoothFlow * 0.75f + btFlow * 0.25f;
        lastBluetoothWeight = currentBluetoothWeight;

        ShotLogSample sample{};
        sample.t = millis() - shotStart;
        sample.tt = controller->getTargetTemp();
        sample.ct = currentTemperature;
        sample.tp = controller->getTargetPressure();
        sample.cp = controller->getCurrentPressure();
        sample.fl = controller->getCurrentPumpFlow();
        sample.tf = controller->getTargetFlow();
        sample.pf = controller->getCurrentPuckFlow();
        sample.vf = currentBluetoothFlow;
        sample.v = currentBluetoothWeight;
        sample.ev = currentEstimatedWeight;
        sample.pr = currentPuckResistance;

        if (isFileOpen) {
            if (ioBufferPos + sizeof(sample) > sizeof(ioBuffer)) {
                flushBuffer();
            }
            memcpy(ioBuffer + ioBufferPos, &sample, sizeof(sample));
            ioBufferPos += sizeof(sample);
            sampleCount++;
        }
    }
    if (!recording && isFileOpen) {
        flushBuffer();
        // Patch header with sampleCount and duration
        header.sampleCount = sampleCount;
        header.durationMs = millis() - shotStart;
        currentFile.seek(0, SeekSet);
        currentFile.write(reinterpret_cast<const uint8_t *>(&header), sizeof(header));
        currentFile.close();
        isFileOpen = false;
        unsigned long duration = header.durationMs;
        if (duration <= 7500) { // Exclude failed shots and flushes
            SPIFFS.remove("/h/" + currentId + ".slog");
            SPIFFS.remove("/h/" + currentId + ".json");
        } else {
            controller->getSettings().setHistoryIndex(controller->getSettings().getHistoryIndex() + 1);
            cleanupHistory();
        }
    }
}

void ShotHistoryPlugin::startRecording() {
    currentId = controller->getSettings().getHistoryIndex();
    while (currentId.length() < 6) {
        currentId = "0" + currentId;
    }
    shotStart = millis();
    currentBluetoothWeight = 0.0f;
    currentEstimatedWeight = 0.0f;
    currentBluetoothFlow = 0.0f;
    currentProfileName = controller->getProfileManager()->getSelectedProfile().label;
    recording = true;
    sampleCount = 0;
    ioBufferPos = 0;
}

unsigned long ShotHistoryPlugin::getTime() {
    time_t now;
    time(&now);
    return now;
}

void ShotHistoryPlugin::endRecording() { recording = false; }

void ShotHistoryPlugin::cleanupHistory() {
    File directory = SPIFFS.open("/h");
    std::vector<String> entries;
    String filename = directory.getNextFileName();
    while (filename != "") {
        entries.push_back(filename);
        filename = directory.getNextFileName();
    }
    sort(entries.begin(), entries.end(), [](String a, String b) { return a < b; });
    if (entries.size() > MAX_HISTORY_ENTRIES) {
        for (unsigned int i = 0; i < entries.size() - MAX_HISTORY_ENTRIES; i++) {
            String name = entries[i];
            SPIFFS.remove(name);
        }
    }
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
                String fname = String(file.name());
                if (fname.endsWith(".slog")) {
                    // Read header only
                    ShotLogHeader hdr{};
                    if (file.read(reinterpret_cast<uint8_t *>(&hdr), sizeof(hdr)) == sizeof(hdr) && hdr.magic == SHOT_LOG_MAGIC) {
                        uint32_t effectiveSamples = hdr.sampleCount;
                        uint32_t effectiveDuration = hdr.durationMs;
                        size_t totalSize = file.size();
                        if (effectiveSamples == 0 || effectiveDuration == 0) {
                            // Interrupted shot (header not patched). Infer from file length.
                            if (totalSize > sizeof(hdr)) {
                                size_t dataBytes = totalSize - sizeof(hdr);
                                uint32_t inferredSamples = dataBytes / SHOT_LOG_SAMPLE_SIZE;
                                if (inferredSamples > 0) {
                                    effectiveSamples = inferredSamples;
                                    // Read last full sample to get actual t
                                    size_t lastOffset = sizeof(hdr) + (static_cast<size_t>(inferredSamples) - 1) * SHOT_LOG_SAMPLE_SIZE;
                                    if (file.seek(lastOffset, SeekSet)) {
                                        ShotLogSample lastSample{};
                                        if (file.read(reinterpret_cast<uint8_t *>(&lastSample), sizeof(lastSample)) == sizeof(lastSample)) {
                                            effectiveDuration = lastSample.t;
                                        } else {
                                            // Fallback: approximate duration from count * interval
                                            effectiveDuration = inferredSamples * SHOT_LOG_SAMPLE_INTERVAL_MS;
                                        }
                                    }
                                }
                            }
                        }
                        auto o = arr.add<JsonObject>();
                        int start = fname.lastIndexOf('/') + 1;
                        int end = fname.lastIndexOf('.');
                        String id = fname.substring(start, end);
                        o["id"] = id;
                        o["version"] = hdr.version;
                        o["timestamp"] = hdr.startEpoch;
                        o["profile"] = hdr.profileName;
                        o["profileId"] = hdr.profileId;
                        o["samples"] = effectiveSamples;
                        o["duration"] = effectiveDuration;
                        if (hdr.sampleCount == 0 && effectiveSamples > 0) {
                            o["incomplete"] = true; // flag partial shot
                        }
                        // Notes
                        JsonDocument notes;
                        loadNotes(id, notes);
                        if (!notes.isNull() && notes.size() > 0) {
                            o["notes"] = notes;
                        }
                    }
                }
                file = root.openNextFile();
            }
        }
    } else if (type == "req:history:get") {
        // Return error: binary must be fetched via HTTP endpoint
        response["error"] = "use HTTP /api/history?id=<id>";
    } else if (type == "req:history:delete") {
        auto id = request["id"].as<String>();
        SPIFFS.remove("/h/" + id + ".slog");
        SPIFFS.remove("/h/" + id + ".json");
        response["msg"] = "Ok";
    } else if (type == "req:history:notes:get") {
        auto id = request["id"].as<String>();
        JsonDocument notes;
        loadNotes(id, notes);
        response["notes"] = notes;
    } else if (type == "req:history:notes:save") {
        const String id = request["id"].as<String>();
        const JsonDocument &notesDoc = request["notes"];

        saveNotes(id, notesDoc);
    }
}

void ShotHistoryPlugin::saveNotes(const String &id, const JsonDocument &notes) {
    File file = SPIFFS.open("/h/" + id + ".json", FILE_WRITE);
    if (file) {
        String notesStr;
        serializeJson(notes, notesStr);
        file.print(notesStr);
        file.close();
    }
}

void ShotHistoryPlugin::loadNotes(const String &id, JsonDocument &notes) {
    File file = SPIFFS.open("/h/" + id + ".json", "r");
    if (file) {
        String notesStr = file.readString();
        file.close();
        deserializeJson(notes, notesStr);
    }
}

void ShotHistoryPlugin::loopTask(void *arg) {
    auto *plugin = static_cast<ShotHistoryPlugin *>(arg);
    while (true) {
        plugin->record();
    // Use canonical interval from shot log format to avoid divergence.
    vTaskDelay(SHOT_LOG_SAMPLE_INTERVAL_MS / portTICK_PERIOD_MS);
    }
}

void ShotHistoryPlugin::flushBuffer() {
    if (isFileOpen && ioBufferPos > 0) {
        currentFile.write(ioBuffer, ioBufferPos);
        ioBufferPos = 0;
    }
}
