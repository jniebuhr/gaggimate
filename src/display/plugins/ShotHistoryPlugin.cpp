#include "ShotHistoryPlugin.h"

#include <SPIFFS.h>
#include <cmath>
#include <display/core/Controller.h>
#include <display/core/ProfileManager.h>
#include <display/core/utils.h>
#include <display/models/shot_log_format.h>

namespace {
constexpr float TEMP_SCALE = 10.0f;
constexpr float PRESSURE_SCALE = 10.0f;
constexpr float FLOW_SCALE = 100.0f;
constexpr float WEIGHT_SCALE = 10.0f;
constexpr float RESISTANCE_SCALE = 100.0f;

constexpr uint16_t TEMP_MAX_VALUE = 2000;       // 200.0 °C
constexpr uint16_t PRESSURE_MAX_VALUE = 200;    // 20.0 bar
constexpr uint16_t WEIGHT_MAX_VALUE = 10000;    // 1000.0 g
constexpr uint16_t RESISTANCE_MAX_VALUE = 0xFFFF;
constexpr int16_t FLOW_MIN_VALUE = -2000;       // -20.00 ml/s
constexpr int16_t FLOW_MAX_VALUE = 2000;        //  20.00 ml/s

uint16_t encodeUnsigned(float value, float scale, uint16_t maxValue) {
    if (!std::isfinite(value)) {
        return 0;
    }
    float scaled = value * scale;
    if (scaled < 0.0f) {
        scaled = 0.0f;
    }
    scaled += 0.5f;
    uint32_t fixed = static_cast<uint32_t>(scaled);
    if (fixed > maxValue) {
        fixed = maxValue;
    }
    return static_cast<uint16_t>(fixed);
}

int16_t encodeSigned(float value, float scale, int16_t minValue, int16_t maxValue) {
    if (!std::isfinite(value)) {
        return 0;
    }
    float scaled = value * scale;
    if (scaled >= 0.0f) {
        scaled += 0.5f;
    } else {
        scaled -= 0.5f;
    }
    int32_t fixed = static_cast<int32_t>(scaled);
    if (fixed < minValue) {
        fixed = minValue;
    }
    if (fixed > maxValue) {
        fixed = maxValue;
    }
    return static_cast<int16_t>(fixed);
}
} // namespace

ShotHistoryPlugin ShotHistory;

void ShotHistoryPlugin::setup(Controller *c, PluginManager *pm) {
    controller = c;
    pluginManager = pm;
    pm->on("controller:brew:start", [this](Event const &) { startRecording(); });
    pm->on("controller:brew:end", [this](Event const &) { endRecording(); });
    pm->on("controller:volumetric-measurement:estimation:change",
           [this](Event const &event) { currentEstimatedWeight = event.getFloat("value"); });
    pm->on("controller:volumetric-measurement:active:change",
           [this](Event const &event) { currentActiveWeight = event.getFloat("value"); });
    pm->on("boiler:currentTemperature:change", [this](Event const &event) { currentTemperature = event.getFloat("value"); });
    pm->on("pump:puck-resistance:change", [this](Event const &event) { currentPuckResistance = event.getFloat("value"); });
    xTaskCreatePinnedToCore(loopTask, "ShotHistoryPlugin::loop", configMINIMAL_STACK_SIZE * 4, this, 1, &taskHandle, 0);
}

void ShotHistoryPlugin::record() {
    bool shouldRecord = recording || extendedRecording;
    
    if (shouldRecord && (controller->getMode() == MODE_BREW || extendedRecording)) {
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
        float btDiff = currentActiveWeight - lastActiveWeight;
        float btFlow = btDiff / 0.25f;
        currentActiveFlow = currentActiveFlow * 0.75f + btFlow * 0.25f;
        lastActiveWeight = currentActiveWeight;

        ShotLogSample sample{};
        uint32_t tick = sampleCount <= 0xFFFF ? sampleCount : 0xFFFF;
        sample.t = static_cast<uint16_t>(tick);
        sample.tt = encodeUnsigned(controller->getTargetTemp(), TEMP_SCALE, TEMP_MAX_VALUE);
        sample.ct = encodeUnsigned(currentTemperature, TEMP_SCALE, TEMP_MAX_VALUE);
        sample.tp = encodeUnsigned(controller->getTargetPressure(), PRESSURE_SCALE, PRESSURE_MAX_VALUE);
        sample.cp = encodeUnsigned(controller->getCurrentPressure(), PRESSURE_SCALE, PRESSURE_MAX_VALUE);
        sample.fl = encodeSigned(controller->getCurrentPumpFlow(), FLOW_SCALE, FLOW_MIN_VALUE, FLOW_MAX_VALUE);
        sample.tf = encodeSigned(controller->getTargetFlow(), FLOW_SCALE, FLOW_MIN_VALUE, FLOW_MAX_VALUE);
        sample.pf = encodeSigned(controller->getCurrentPuckFlow(), FLOW_SCALE, FLOW_MIN_VALUE, FLOW_MAX_VALUE);
        sample.vf = encodeSigned(currentActiveFlow, FLOW_SCALE, FLOW_MIN_VALUE, FLOW_MAX_VALUE);
        sample.v = encodeUnsigned(currentActiveWeight, WEIGHT_SCALE, WEIGHT_MAX_VALUE);
        sample.ev = encodeUnsigned(currentEstimatedWeight, WEIGHT_SCALE, WEIGHT_MAX_VALUE);
        sample.pr = encodeUnsigned(currentPuckResistance, RESISTANCE_SCALE, RESISTANCE_MAX_VALUE);

        if (isFileOpen) {
            if (ioBufferPos + sizeof(sample) > sizeof(ioBuffer)) {
                flushBuffer();
            }
            memcpy(ioBuffer + ioBufferPos, &sample, sizeof(sample));
            ioBufferPos += sizeof(sample);
            sampleCount++;
        }
        
        // Check for weight stabilization during extended recording
        if (extendedRecording) {
            const unsigned long now = millis();
            
            bool canProcessWeight = (controller != nullptr);
            if (canProcessWeight) {
                canProcessWeight = controller->isVolumetricAvailable();
            }
            
            if (!canProcessWeight) {
                // If BLE connection is unstable, end extended recording early
                extendedRecording = false;
                return;
            }
            
            const float weightDiff = abs(currentActiveWeight - lastStableWeight);
            
            if (weightDiff < WEIGHT_STABILIZATION_THRESHOLD) {
                if (lastWeightChangeTime == 0) {
                    lastWeightChangeTime = now;
                }
                // Weight has been stable for the threshold time, stop extended recording
                if (now - lastWeightChangeTime >= WEIGHT_STABILIZATION_TIME) {
                    extendedRecording = false;
                }
            } else {
                // Weight changed, reset stabilization timer
                lastWeightChangeTime = 0;
                lastStableWeight = currentActiveWeight;
            }
            
            // Also stop extended recording after maximum duration
            if (now - extendedRecordingStart >= EXTENDED_RECORDING_DURATION) {
                extendedRecording = false;
            }
        }
    }
    
    if (!recording && !extendedRecording && isFileOpen) {
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
    lastWeightChangeTime = 0;
    extendedRecordingStart = 0;
    currentActiveWeight = 0.0f;        // Changed from currentBluetoothWeight
    lastStableWeight = 0.0f;
    currentEstimatedWeight = 0.0f;
    currentActiveFlow = 0.0f;          // Changed from currentBluetoothFlow
    currentProfileName = controller->getProfileManager()->getSelectedProfile().label;
    recording = true;
    extendedRecording = false;
    sampleCount = 0;
    ioBufferPos = 0;
}

unsigned long ShotHistoryPlugin::getTime() {
    time_t now;
    time(&now);
    return now;
}

void ShotHistoryPlugin::endRecording() {
    recording = false;
    
    
    if (controller &&
        controller->isVolumetricAvailable() &&
        currentActiveWeight > 0) {
        // Start extended recording for any shot with active weight data
        extendedRecording = true;
        extendedRecordingStart = millis();
        lastStableWeight = currentActiveWeight;
        lastWeightChangeTime = 0;
        return; // Don't finalize the recording yet
    }
    
    // For shots without weight data, finalize immediately
    finalizeRecording();
}

void ShotHistoryPlugin::finalizeRecording() {
    unsigned long duration = millis() - shotStart;
    if (duration <= 7500) { // Exclude failed shots and flushes
        SPIFFS.remove("/h/" + currentId + ".dat");
    } else {
        controller->getSettings().setHistoryIndex(controller->getSettings().getHistoryIndex() + 1);
        cleanupHistory();
    }
}

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
                                            effectiveDuration = static_cast<uint32_t>(lastSample.t) * SHOT_LOG_SAMPLE_INTERVAL_MS;
                                        } else {
                                            // Fallback: approximate duration from count * interval
                                            effectiveDuration = inferredSamples > 0
                                                                     ? (inferredSamples - 1) * SHOT_LOG_SAMPLE_INTERVAL_MS
                                                                     : 0;
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
