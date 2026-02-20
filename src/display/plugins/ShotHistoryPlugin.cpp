#include "ShotHistoryPlugin.h"

#include <SD_MMC.h>
#include <SPIFFS.h>
#include <cmath>
#include <display/core/Controller.h>
#include <display/core/ProfileManager.h>
#include <display/core/process/BrewProcess.h>
#include <display/core/utils.h>
#include <display/models/shot_log_format.h>

namespace {
constexpr float TEMP_SCALE = 10.0f;
constexpr float PRESSURE_SCALE = 10.0f;
constexpr float FLOW_SCALE = 100.0f;
constexpr float WEIGHT_SCALE = 10.0f;
constexpr float RESISTANCE_SCALE = 100.0f;

constexpr uint16_t TEMP_MAX_VALUE = 2000;    // 200.0 °C
constexpr uint16_t PRESSURE_MAX_VALUE = 200; // 20.0 bar
constexpr uint16_t WEIGHT_MAX_VALUE = 10000; // 1000.0 g
constexpr uint16_t RESISTANCE_MAX_VALUE = 0xFFFF;
constexpr int16_t FLOW_MIN_VALUE = -2000; // -20.00 ml/s
constexpr int16_t FLOW_MAX_VALUE = 2000;  //  20.00 ml/s

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

String padId(String id, int length = 6) {
    while (id.length() < length) {
        id = "0" + id;
    }
    return id;
}
} // namespace

ShotHistoryPlugin ShotHistory;

void ShotHistoryPlugin::setup(Controller *c, PluginManager *pm) {
    controller = c;
    pluginManager = pm;
    if (controller->isSDCard()) {
        fs = &SD_MMC;
        ESP_LOGI("ShotHistoryPlugin", "Logging shot history to SD card");
    }
    pm->on("controller:brew:start", [this](Event const &) { startRecording(); });
    pm->on("controller:brew:end", [this](Event const &) { endRecording(); });
    pm->on("controller:brew:clear", [this](Event const &) { endExtendedRecording(); });
    pm->on("controller:volumetric-measurement:estimation:change",
           [this](Event const &event) { currentEstimatedWeight = event.getFloat("value"); });
    pm->on("controller:volumetric-measurement:bluetooth:change",
           [this](Event const &event) { currentBluetoothWeight = event.getFloat("value"); });
    pm->on("boiler:currentTemperature:change", [this](Event const &event) { currentTemperature = event.getFloat("value"); });
    pm->on("pump:puck-resistance:change", [this](Event const &event) { currentPuckResistance = event.getFloat("value"); });
    // Initialize rebuild state
    rebuildInProgress = false;
    xTaskCreatePinnedToCore(loopTask, "ShotHistoryPlugin::loop", configMINIMAL_STACK_SIZE * 6, this, 1, &taskHandle, 0);
}

void ShotHistoryPlugin::record() {
    bool shouldRecord = recording || extendedRecording;

    if (shouldRecord && (controller->getMode() == MODE_BREW || extendedRecording)) {
        if (!isFileOpen) {
            if (!fs->exists("/h")) {
                fs->mkdir("/h");
            }
            currentFile = fs->open("/h/" + currentId + ".slog", FILE_WRITE);
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
                header.phaseTransitionCount = 0; // Initialize phase transition count
                // Write header placeholder
                currentFile.write(reinterpret_cast<const uint8_t *>(&header), sizeof(header));
            }
        }
        float btDiff = currentBluetoothWeight - lastBluetoothWeight;
        float btFlow = btDiff / 0.25f;
        currentBluetoothFlow = currentBluetoothFlow * 0.75f + btFlow * 0.25f;
        lastBluetoothWeight = currentBluetoothWeight;

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
        sample.vf = encodeSigned(currentBluetoothFlow, FLOW_SCALE, FLOW_MIN_VALUE, FLOW_MAX_VALUE);
        sample.v = encodeUnsigned(currentBluetoothWeight, WEIGHT_SCALE, WEIGHT_MAX_VALUE);
        sample.ev = encodeUnsigned(currentEstimatedWeight, WEIGHT_SCALE, WEIGHT_MAX_VALUE);
        sample.pr = encodeUnsigned(currentPuckResistance, RESISTANCE_SCALE, RESISTANCE_MAX_VALUE);
        sample.si = getSystemInfo(); // Pack system state information

        // Track phase transitions
        if (controller->getMode() == MODE_BREW) {
            Process *process = controller->getProcess();
            if (process != nullptr && process->getType() == MODE_BREW) {
                auto *brewProcess = static_cast<BrewProcess *>(process);
                uint8_t currentPhase = static_cast<uint8_t>(brewProcess->phaseIndex);

                // Check for phase transition
                if (currentPhase != lastRecordedPhase) {
                    recordPhaseTransition(currentPhase, sampleCount);
                    lastRecordedPhase = currentPhase;
                }
            }
        }

        if (isFileOpen) {
            if (ioBufferPos + sizeof(sample) > sizeof(ioBuffer)) {
                flushBuffer();
            }
            memcpy(ioBuffer + ioBufferPos, &sample, sizeof(sample));
            ioBufferPos += sizeof(sample);
            sampleCount++;
        }

        // Check for early index insertion (once per shot after 7.5s)
        if (!indexEntryCreated && (millis() - shotStart) > 7500) {
            indexEntryCreated = createEarlyIndexEntry();
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

            const float weightDiff = abs(currentBluetoothWeight - lastStableWeight);

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
                lastStableWeight = currentBluetoothWeight;
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
        float finalWeight = currentBluetoothWeight;
        header.finalWeight = finalWeight > 0.0f ? encodeUnsigned(finalWeight, WEIGHT_SCALE, WEIGHT_MAX_VALUE) : 0;
        currentFile.seek(0, SeekSet);
        currentFile.write(reinterpret_cast<const uint8_t *>(&header), sizeof(header));
        currentFile.close();
        isFileOpen = false;
        unsigned long duration = header.durationMs;
        if (duration <= 7500) { // Exclude failed shots and flushes
            fs->remove("/h/" + currentId + ".slog");

            // If we created an early index entry, mark it as deleted
            if (indexEntryCreated) {
                markIndexDeleted(currentId.toInt());
            }
        } else {
            controller->getSettings().setHistoryIndex(controller->getSettings().getHistoryIndex() + 1);
            cleanupHistory();

            // Always create a complete index entry via upsert.
            // If an early entry exists, it gets overwritten with final data.
            // If no early entry exists, a new one is appended.
            ShotIndexEntry indexEntry{};
            indexEntry.id = currentId.toInt();
            indexEntry.timestamp = header.startEpoch;
            indexEntry.duration = header.durationMs;
            indexEntry.volume = header.finalWeight;
            indexEntry.rating = 0;
            indexEntry.flags = SHOT_FLAG_COMPLETED;
            strncpy(indexEntry.profileId, header.profileId, sizeof(indexEntry.profileId) - 1);
            indexEntry.profileId[sizeof(indexEntry.profileId) - 1] = '\0';
            strncpy(indexEntry.profileName, header.profileName, sizeof(indexEntry.profileName) - 1);
            indexEntry.profileName[sizeof(indexEntry.profileName) - 1] = '\0';

            if (!appendToIndex(indexEntry)) {
                ESP_LOGE("ShotHistoryPlugin", "CRITICAL: Failed to add completed shot %u to index", indexEntry.id);
            }
        }
    }
}

void ShotHistoryPlugin::startRecording() {
    Process *process = controller->getProcess();
    if (process != nullptr && process->getType() == MODE_BREW) {
        BrewProcess *brewProcess = static_cast<BrewProcess *>(process);
        if (brewProcess->isUtility()) {
            return;
        }
    }
    currentId = padId(String(controller->getSettings().getHistoryIndex()));
    shotStart = millis();
    lastWeightChangeTime = 0;
    extendedRecordingStart = 0;
    currentBluetoothWeight = 0.0f;
    lastStableWeight = 0.0f;
    currentEstimatedWeight = 0.0f;
    currentBluetoothFlow = 0.0f;
    currentProfileName = controller->getProfileManager()->getSelectedProfile().label;
    recording = true;
    extendedRecording = false;
    indexEntryCreated = false; // Reset flag for new shot
    sampleCount = 0;
    ioBufferPos = 0;

    // Reset phase tracking for new shot
    lastRecordedPhase = 0xFF; // Invalid value to detect first phase

    // Capture initial volumetric mode state (brew by weight vs brew by time)
    shotStartedVolumetric = controller->getSettings().isVolumetricTarget();
}

unsigned long ShotHistoryPlugin::getTime() {
    time_t now;
    time(&now);
    return now;
}

void ShotHistoryPlugin::endRecording() {
    if (recording && controller && controller->isVolumetricAvailable() && currentBluetoothWeight > 0) {
        // Start extended recording for any shot with active weight data
        extendedRecording = true;
        extendedRecordingStart = millis();
        lastStableWeight = currentBluetoothWeight;
        lastWeightChangeTime = 0;
    }

    recording = false;
}

void ShotHistoryPlugin::endExtendedRecording() {
    if (extendedRecording) {
        extendedRecording = false;
    }
}

void ShotHistoryPlugin::recordPhaseTransition(uint8_t phaseNumber, uint16_t sampleIndex) {
    // Only record if we have space and a valid header
    if (header.phaseTransitionCount >= 12 || !isFileOpen) {
        return;
    }

    // Get current profile to extract phase name
    Profile profile = controller->getProfileManager()->getSelectedProfile();
    PhaseTransition &transition = header.phaseTransitions[header.phaseTransitionCount];

    transition.sampleIndex = sampleIndex;
    transition.phaseNumber = phaseNumber;
    transition.reserved = 0;

    // Get phase name from profile
    if (phaseNumber < profile.phases.size()) {
        strncpy(transition.phaseName, profile.phases[phaseNumber].name.c_str(), sizeof(transition.phaseName) - 1);
        transition.phaseName[sizeof(transition.phaseName) - 1] = '\0';
    } else {
        // Fallback to generic name
        snprintf(transition.phaseName, sizeof(transition.phaseName), "Phase %d", phaseNumber + 1);
    }

    header.phaseTransitionCount++;

    ESP_LOGD("ShotHistoryPlugin", "Recorded phase transition to phase %d (%s) at sample %d", phaseNumber, transition.phaseName,
             sampleIndex);
}

uint16_t ShotHistoryPlugin::getSystemInfo() {
    uint16_t systemInfo = 0;

    // Bit 0: Shot started in volumetric mode
    if (shotStartedVolumetric) {
        systemInfo |= SYSTEM_INFO_SHOT_STARTED_VOLUMETRIC;
    }

    // Bit 1: Currently in volumetric mode (check current process if active)
    if (controller != nullptr) {
        Process *process = controller->getProcess();
        if (process != nullptr && process->getType() == MODE_BREW) {
            auto *brewProcess = static_cast<BrewProcess *>(process);
            bool currentlyVolumetric = brewProcess->target == ProcessTarget::VOLUMETRIC &&
                                       brewProcess->currentPhase.hasVolumetricTarget() && controller->isVolumetricAvailable();
            if (currentlyVolumetric) {
                systemInfo |= SYSTEM_INFO_CURRENTLY_VOLUMETRIC;
            }
        }
    }

    // Bit 2: Bluetooth scale connected
    if (controller != nullptr && controller->isBluetoothScaleHealthy()) {
        systemInfo |= SYSTEM_INFO_BLUETOOTH_SCALE_CONNECTED;
    }

    // Bit 3: Volumetric available
    if (controller != nullptr && controller->isVolumetricAvailable()) {
        systemInfo |= SYSTEM_INFO_VOLUMETRIC_AVAILABLE;
    }

    // Bit 4: Extended recording active
    if (extendedRecording) {
        systemInfo |= SYSTEM_INFO_EXTENDED_RECORDING;
    }

    return systemInfo;
}

void ShotHistoryPlugin::cleanupHistory() {
    size_t freeSpace = getFreeSpace();
    if (freeSpace > MIN_FREE_SPACE_BYTES) {
        return; // Enough space, nothing to do
    }

    // Collect and sort .slog files to find the oldest
    File directory = fs->open("/h");
    std::vector<String> slogFiles;
    String filename = directory.getNextFileName();
    while (filename != "") {
        if (filename.endsWith(".slog")) {
            slogFiles.push_back(filename);
        }
        filename = directory.getNextFileName();
    }
    directory.close();

    if (slogFiles.empty()) {
        return;
    }

    sort(slogFiles.begin(), slogFiles.end(), [](const String &a, const String &b) { return a < b; });

    // Remove oldest files one at a time until we have enough free space
    size_t removed = 0;
    for (size_t i = 0; i < slogFiles.size() && getFreeSpace() <= MIN_FREE_SPACE_BYTES; i++) {
        String fname = slogFiles[i];
        int start = fname.lastIndexOf('/') + 1;
        int end = fname.lastIndexOf('.');
        if (end > start) {
            uint32_t shotId = fname.substring(start, end).toInt();
            markIndexDeleted(shotId);
        }

        // Remove .slog and associated .json notes file
        fs->remove(fname);
        String notesPath = fname.substring(0, fname.lastIndexOf('.')) + ".json";
        fs->remove(notesPath);
        removed++;
    }

    if (removed > 0) {
        ESP_LOGI("ShotHistoryPlugin", "Cleaned up %u old shots (free space: %u bytes)", removed, getFreeSpace());
    }
}

size_t ShotHistoryPlugin::getFreeSpace() {
    if (controller->isSDCard()) {
        uint64_t total = SD_MMC.totalBytes();
        uint64_t used = SD_MMC.usedBytes();
        uint64_t free = total > used ? (total - used) : 0;
        // Cap to size_t max for consistency
        return free > SIZE_MAX ? SIZE_MAX : static_cast<size_t>(free);
    }
    size_t total = SPIFFS.totalBytes();
    size_t used = SPIFFS.usedBytes();
    return total > used ? (total - used) : 0;
}

void ShotHistoryPlugin::handleRequest(JsonDocument &request, JsonDocument &response) {
    String type = request["tp"].as<String>();
    response["tp"] = String("res:") + type.substring(4);
    response["rid"] = request["rid"].as<String>();

    if (type == "req:history:list") {
        JsonArray arr = response["history"].to<JsonArray>();
        File root = fs->open("/h");
        if (root && root.isDirectory()) {
            File file = root.openNextFile();
            while (file) {
                String fname = String(file.name());
                if (fname.endsWith(".slog")) {
                    // Read header only
                    ShotLogHeader hdr{};
                    if (file.read(reinterpret_cast<uint8_t *>(&hdr), sizeof(hdr)) == sizeof(hdr) && hdr.magic == SHOT_LOG_MAGIC) {
                        float finalWeight = hdr.finalWeight > 0 ? static_cast<float>(hdr.finalWeight) / WEIGHT_SCALE : 0.0f;

                        bool headerIncomplete = hdr.sampleCount == 0;

                        auto o = arr.add<JsonObject>();
                        int start = fname.lastIndexOf('/') + 1;
                        int end = fname.lastIndexOf('.');
                        String id = fname.substring(start, end);
                        o["id"] = id;
                        o["version"] = hdr.version;
                        o["timestamp"] = hdr.startEpoch;
                        o["profile"] = hdr.profileName;
                        o["profileId"] = hdr.profileId;
                        o["samples"] = hdr.sampleCount;
                        o["duration"] = hdr.durationMs;
                        if (finalWeight > 0.0f) {
                            o["volume"] = finalWeight;
                        }
                        if (headerIncomplete) {
                            o["incomplete"] = true; // flag partial shot
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
        String paddedId = id;
        while (paddedId.length() < 6) {
            paddedId = "0" + paddedId;
        }
        fs->remove("/h/" + paddedId + ".slog");
        fs->remove("/h/" + paddedId + ".json");

        // Mark as deleted in index
        markIndexDeleted(id.toInt());

        response["msg"] = "Ok";
    } else if (type == "req:history:notes:get") {
        auto id = request["id"].as<String>();
        JsonDocument notes;
        loadNotes(id, notes);
        response["notes"] = notes;
    } else if (type == "req:history:notes:save") {
        auto id = request["id"].as<String>();
        auto notes = request["notes"];
        saveNotes(id, notes);

        // Update rating and volume in index
        uint8_t rating = notes["rating"].as<uint8_t>();

        // Check if user provided a doseOut value to override volume
        uint16_t volume = 0;
        if (notes["doseOut"].is<String>() && !notes["doseOut"].as<String>().isEmpty()) {
            float doseOut = notes["doseOut"].as<String>().toFloat();
            if (doseOut > 0.0f) {
                volume = encodeUnsigned(doseOut, WEIGHT_SCALE, WEIGHT_MAX_VALUE);
            }
        }

        // Always use updateIndexMetadata - it handles both rating and optional volume
        updateIndexMetadata(id.toInt(), rating, volume);

        response["msg"] = "Ok";
    } else if (type == "req:history:rebuild") {
        // Rebuild is now handled asynchronously by WebUIPlugin
        // This path shouldn't be reached, but handle it just in case
        response["msg"] = "Use async rebuild";
    }
}

void ShotHistoryPlugin::saveNotes(const String &id, const JsonDocument &notes) {
    File file = fs->open("/h/" + id + ".json", FILE_WRITE);
    if (file) {
        String notesStr;
        serializeJson(notes, notesStr);
        file.print(notesStr);
        file.close();
    }
}

void ShotHistoryPlugin::loadNotes(const String &id, JsonDocument &notes) {
    File file = fs->open("/h/" + id + ".json", "r");
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

// Index management methods
bool ShotHistoryPlugin::ensureIndexExists() {
    if (fs->exists("/h/index.bin")) {
        // Validate existing index header
        File indexFile = fs->open("/h/index.bin", "r");
        if (indexFile) {
            ShotIndexHeader hdr{};
            bool valid = (indexFile.read(reinterpret_cast<uint8_t *>(&hdr), sizeof(hdr)) == sizeof(hdr) &&
                          hdr.magic == SHOT_INDEX_MAGIC);
            indexFile.close();
            if (valid) {
                return true;
            }
            ESP_LOGW("ShotHistoryPlugin", "Corrupt index file detected (bad magic), recreating");
            fs->remove("/h/index.bin");
        }
    }

    // Create new empty index
    File indexFile = fs->open("/h/index.bin", FILE_WRITE);
    if (!indexFile) {
        ESP_LOGE("ShotHistoryPlugin", "Failed to create index file");
        return false;
    }

    ShotIndexHeader header{};
    header.magic = SHOT_INDEX_MAGIC;
    header.version = SHOT_INDEX_VERSION;
    header.entrySize = SHOT_INDEX_ENTRY_SIZE;
    header.entryCount = 0;
    header.nextId = controller->getSettings().getHistoryIndex();

    indexFile.write(reinterpret_cast<const uint8_t *>(&header), sizeof(header));
    indexFile.close();

    ESP_LOGI("ShotHistoryPlugin", "Created new index file");
    return true;
}

bool ShotHistoryPlugin::appendToIndex(const ShotIndexEntry &entry) {
    if (!ensureIndexExists()) {
        return false;
    }

    File indexFile = fs->open("/h/index.bin", "r+");
    if (!indexFile) {
        ESP_LOGE("ShotHistoryPlugin", "Failed to open index file for append");
        return false;
    }

    ShotIndexHeader header{};
    if (!readIndexHeader(indexFile, header)) {
        indexFile.close();
        return false;
    }

    // Check for existing entry with same ID - update in place (upsert)
    int existingPos = findEntryPosition(indexFile, header, entry.id);
    if (existingPos >= 0) {
        if (writeEntryAtPosition(indexFile, existingPos, entry)) {
            ESP_LOGD("ShotHistoryPlugin", "Updated existing index entry for shot %u", entry.id);
            indexFile.close();
            return true;
        }
        ESP_LOGE("ShotHistoryPlugin", "Failed to update existing index entry for shot %u", entry.id);
        indexFile.close();
        return false;
    }

    // Append entry
    indexFile.seek(0, SeekEnd);
    size_t written = indexFile.write(reinterpret_cast<const uint8_t *>(&entry), sizeof(entry));
    if (written != sizeof(entry)) {
        ESP_LOGE("ShotHistoryPlugin", "Failed to write index entry for shot %u", entry.id);
        indexFile.close();
        return false;
    }

    // Update header
    header.entryCount++;
    header.nextId = entry.id + 1;
    indexFile.seek(0, SeekSet);
    indexFile.write(reinterpret_cast<const uint8_t *>(&header), sizeof(header));

    indexFile.close();
    ESP_LOGD("ShotHistoryPlugin", "Appended shot %u to index", entry.id);
    return true;
}

void ShotHistoryPlugin::updateIndexMetadata(uint32_t shotId, uint8_t rating, uint16_t volume) {
    File indexFile = fs->open("/h/index.bin", "r+");
    if (!indexFile) {
        ESP_LOGE("ShotHistoryPlugin", "Failed to open index file for metadata update");
        return;
    }

    ShotIndexHeader header{};
    if (!readIndexHeader(indexFile, header)) {
        indexFile.close();
        return;
    }

    int entryPos = findEntryPosition(indexFile, header, shotId);
    if (entryPos >= 0) {
        ShotIndexEntry entry{};
        if (readEntryAtPosition(indexFile, entryPos, entry)) {
            entry.rating = rating;
            if (volume > 0) {
                entry.volume = volume;
            }
            if (rating > 0) {
                entry.flags |= SHOT_FLAG_HAS_NOTES;
            }

            if (writeEntryAtPosition(indexFile, entryPos, entry)) {
                ESP_LOGD("ShotHistoryPlugin", "Updated metadata for shot %u: rating=%u, volume=%u", shotId, rating, volume);
            }
        }
    } else {
        ESP_LOGW("ShotHistoryPlugin", "Shot %u not found in index for metadata update", shotId);
    }

    indexFile.close();
}

void ShotHistoryPlugin::markIndexDeleted(uint32_t shotId) {
    File indexFile = fs->open("/h/index.bin", "r+");
    if (!indexFile) {
        ESP_LOGE("ShotHistoryPlugin", "Failed to open index file for deletion marking");
        return;
    }

    ShotIndexHeader header{};
    if (!readIndexHeader(indexFile, header)) {
        indexFile.close();
        return;
    }

    // Find ALL entries with this shot ID and mark them as deleted
    uint32_t duplicatesFound = 0;

    for (uint32_t i = 0; i < header.entryCount; i++) {
        size_t entryPos = sizeof(ShotIndexHeader) + i * sizeof(ShotIndexEntry);
        ShotIndexEntry entry{};
        if (readEntryAtPosition(indexFile, entryPos, entry)) {
            if (entry.id == shotId) {
                duplicatesFound++;

                // Mark this entry as deleted
                entry.flags |= SHOT_FLAG_DELETED;

                if (writeEntryAtPosition(indexFile, entryPos, entry)) {
                    ESP_LOGD("ShotHistoryPlugin", "Marked shot %u as deleted in index (duplicate #%u)", shotId, duplicatesFound);
                }
            }
        }
    }

    if (duplicatesFound == 0) {
        ESP_LOGW("ShotHistoryPlugin", "Shot %u not found in index for deletion marking", shotId);
    } else if (duplicatesFound > 1) {
        ESP_LOGW("ShotHistoryPlugin", "Found and marked %u duplicate entries for shot %u as deleted", duplicatesFound, shotId);
    }

    indexFile.close();
}

void ShotHistoryPlugin::startAsyncRebuild() {
    if (!rebuildInProgress) {
        rebuildInProgress = true; // Set immediately to prevent multiple rebuilds
        ESP_LOGI("ShotHistoryPlugin", "Starting immediate async rebuild task");
        
        // Create a dedicated task for rebuild instead of using the existing loop
        xTaskCreatePinnedToCore(
            [](void* param) {
                auto* plugin = static_cast<ShotHistoryPlugin*>(param);
                ESP_LOGI("ShotHistoryPlugin", "Rebuild task started");
                plugin->rebuildIndex();
                plugin->rebuildInProgress = false;
                ESP_LOGI("ShotHistoryPlugin", "Rebuild task completed");
                vTaskDelete(NULL); // Delete this task when done
            },
            "ShotHistoryRebuild",
            configMINIMAL_STACK_SIZE * 8, // Larger stack for file operations
            this,
            2, // Higher priority than normal
            NULL,
            0
        );
    } else {
        ESP_LOGW("ShotHistoryPlugin", "Rebuild already in progress, ignoring request");
    }
}

void ShotHistoryPlugin::rebuildIndex() {
    ESP_LOGI("ShotHistoryPlugin", "Starting index rebuild...");

    // Send scanning event
    if (pluginManager) {
        Event startEvent;
        startEvent.id = "evt:history-rebuild-progress";
        startEvent.setInt("total", 0);
        startEvent.setInt("current", 0);
        startEvent.setString("status", "scanning");
        pluginManager->trigger(startEvent);
    }

    // Delete existing index
    fs->remove("/h/index.bin");

    // Create new empty index
    if (!ensureIndexExists()) {
        ESP_LOGE("ShotHistoryPlugin", "Failed to create index during rebuild");
        // Emit error event
        if (pluginManager) {
            Event errorEvent;
            errorEvent.id = "evt:history-rebuild-progress";
            errorEvent.setInt("total", 0);
            errorEvent.setInt("current", 0);
            errorEvent.setString("status", "error");
            pluginManager->trigger(errorEvent);
        }
        return;
    }

    File directory = fs->open("/h");
    if (!directory || !directory.isDirectory()) {
        ESP_LOGW("ShotHistoryPlugin", "No history directory found");
        // Emit completion event even if no directory exists
        if (pluginManager) {
            Event completedEvent;
            completedEvent.id = "evt:history-rebuild-progress";
            completedEvent.setInt("total", 0);
            completedEvent.setInt("current", 0);
            completedEvent.setString("status", "completed");
            pluginManager->trigger(completedEvent);
        }
        return;
    }

    // Collect all .slog files
    std::vector<String> slogFiles;
    File file = directory.openNextFile();
    while (file) {
        String fname = String(file.name());
        if (fname.endsWith(".slog")) {
            slogFiles.push_back(fname);
        }
        file = directory.openNextFile();
    }
    directory.close();

    // Sort files to maintain order
    std::sort(slogFiles.begin(), slogFiles.end());

    ESP_LOGI("ShotHistoryPlugin", "Rebuilding index from %d shot files", slogFiles.size());

    // Emit start event with total file count
    if (pluginManager) {
        Event startEvent;
        startEvent.id = "evt:history-rebuild-progress";
        startEvent.setInt("total", (int)slogFiles.size());
        startEvent.setInt("current", 0);
        startEvent.setString("status", "started");
        pluginManager->trigger(startEvent);
    }

    int currentIndex = 0;
    for (const String &fileName : slogFiles) {
        currentIndex++;
        File shotFile = fs->open("/h/" + fileName, "r");
        if (!shotFile) {
            continue;
        }

        // Read shot header
        ShotLogHeader shotHeader{};
        if (shotFile.read(reinterpret_cast<uint8_t *>(&shotHeader), sizeof(shotHeader)) != sizeof(shotHeader) ||
            shotHeader.magic != SHOT_LOG_MAGIC) {
            shotFile.close();
            continue;
        }

        // Extract shot ID from filename
        int start = fileName.lastIndexOf('/') + 1;
        int end = fileName.lastIndexOf('.');
        uint32_t shotId = fileName.substring(start, end).toInt();

        // Create index entry
        ShotIndexEntry entry{};
        entry.id = shotId;
        entry.timestamp = shotHeader.startEpoch;
        entry.duration = shotHeader.durationMs;
        entry.volume = shotHeader.finalWeight;
        entry.rating = 0; // Will be updated if notes exist
        entry.flags = SHOT_FLAG_COMPLETED;
        strncpy(entry.profileId, shotHeader.profileId, sizeof(entry.profileId) - 1);
        entry.profileId[sizeof(entry.profileId) - 1] = '\0';
        strncpy(entry.profileName, shotHeader.profileName, sizeof(entry.profileName) - 1);
        entry.profileName[sizeof(entry.profileName) - 1] = '\0';

        // Check for incomplete shots
        if (shotHeader.sampleCount == 0) {
            entry.flags &= ~SHOT_FLAG_COMPLETED;
        }

        // Check for notes and extract rating and volume override
        String notesPath = "/h/" + String(shotId, 10) + ".json";
        if (fs->exists(notesPath)) {
            entry.flags |= SHOT_FLAG_HAS_NOTES;

            File notesFile = fs->open(notesPath, "r");
            if (notesFile) {
                String notesStr = notesFile.readString();
                notesFile.close();

                JsonDocument notesDoc;
                if (deserializeJson(notesDoc, notesStr) == DeserializationError::Ok) {
                    entry.rating = notesDoc["rating"].as<uint8_t>();

                    // Check if user provided a doseOut value to override volume
                    if (notesDoc["doseOut"].is<String>() && !notesDoc["doseOut"].as<String>().isEmpty()) {
                        float doseOut = notesDoc["doseOut"].as<String>().toFloat();
                        if (doseOut > 0.0f) {
                            entry.volume = encodeUnsigned(doseOut, WEIGHT_SCALE, WEIGHT_MAX_VALUE);
                        }
                    }
                }
            }
        }

        shotFile.close();

        // Append to index
        appendToIndex(entry);

        // Emit progress update with adaptive frequency
        // Update every file for small rebuilds, every few files for larger ones
        int updateFrequency = slogFiles.size() <= 20 ? 1 : (slogFiles.size() <= 100 ? 3 : 5);
        if (pluginManager && (currentIndex % updateFrequency == 0 || currentIndex == slogFiles.size())) {
            Event progressEvent;
            progressEvent.id = "evt:history-rebuild-progress";
            progressEvent.setInt("total", (int)slogFiles.size());
            progressEvent.setInt("current", currentIndex);
            progressEvent.setString("status", "processing");
            pluginManager->trigger(progressEvent);
            ESP_LOGI("ShotHistoryPlugin", "Rebuild progress: %d/%d", currentIndex, (int)slogFiles.size());
            
            // Small delay to allow UI updates and prevent overwhelming the system
            vTaskDelay(pdMS_TO_TICKS(10));
        }
    }

    // Emit completion event
    if (pluginManager) {
        Event completionEvent;
        completionEvent.id = "evt:history-rebuild-progress";
        completionEvent.setInt("total", (int)slogFiles.size());
        completionEvent.setInt("current", (int)slogFiles.size());
        completionEvent.setString("status", "completed");
        pluginManager->trigger(completionEvent);
    }

    ESP_LOGI("ShotHistoryPlugin", "Index rebuild completed");
}

// Index helper functions
bool ShotHistoryPlugin::readIndexHeader(File &indexFile, ShotIndexHeader &header) {
    if (indexFile.read(reinterpret_cast<uint8_t *>(&header), sizeof(header)) != sizeof(header)) {
        ESP_LOGE("ShotHistoryPlugin", "Failed to read index header");
        return false;
    }
    if (header.magic != SHOT_INDEX_MAGIC) {
        ESP_LOGE("ShotHistoryPlugin", "Invalid index magic: 0x%08X", header.magic);
        return false;
    }
    return true;
}

int ShotHistoryPlugin::findEntryPosition(File &indexFile, const ShotIndexHeader &header, uint32_t shotId) {
    for (uint32_t i = 0; i < header.entryCount; i++) {
        size_t entryPos = sizeof(ShotIndexHeader) + i * sizeof(ShotIndexEntry);
        indexFile.seek(entryPos, SeekSet);

        ShotIndexEntry entry{};
        if (!readEntryAtPosition(indexFile, entryPos, entry)) {
            ESP_LOGW("ShotHistoryPlugin", "Failed to read entry at position %u", i);
            break;
        }

        if (entry.id == shotId) {
            return entryPos;
        }
    }
    return -1;
}

bool ShotHistoryPlugin::readEntryAtPosition(File &indexFile, size_t position, ShotIndexEntry &entry) {
    indexFile.seek(position, SeekSet);
    if (indexFile.read(reinterpret_cast<uint8_t *>(&entry), sizeof(entry)) != sizeof(entry)) {
        ESP_LOGE("ShotHistoryPlugin", "Failed to read entry at position %zu", position);
        return false;
    }
    return true;
}

bool ShotHistoryPlugin::writeEntryAtPosition(File &indexFile, size_t position, const ShotIndexEntry &entry) {
    indexFile.seek(position, SeekSet);
    if (indexFile.write(reinterpret_cast<const uint8_t *>(&entry), sizeof(entry)) != sizeof(entry)) {
        ESP_LOGE("ShotHistoryPlugin", "Failed to write entry at position %zu", position);
        return false;
    }
    return true;
}

bool ShotHistoryPlugin::createEarlyIndexEntry() {
    Profile profile = controller->getProfileManager()->getSelectedProfile();

    ShotIndexEntry indexEntry{};
    indexEntry.id = currentId.toInt();
    indexEntry.timestamp = header.startEpoch;
    indexEntry.duration = 0; // Will be overwritten on completion
    indexEntry.volume = 0;   // Will be overwritten on completion
    indexEntry.rating = 0;
    indexEntry.flags = 0; // No SHOT_FLAG_COMPLETED - indicates in-progress shot
    strncpy(indexEntry.profileId, profile.id.c_str(), sizeof(indexEntry.profileId) - 1);
    indexEntry.profileId[sizeof(indexEntry.profileId) - 1] = '\0';
    strncpy(indexEntry.profileName, profile.label.c_str(), sizeof(indexEntry.profileName) - 1);
    indexEntry.profileName[sizeof(indexEntry.profileName) - 1] = '\0';

    bool success = appendToIndex(indexEntry);
    if (success) {
        ESP_LOGD("ShotHistoryPlugin", "Created early index entry for shot %u", indexEntry.id);
    } else {
        ESP_LOGE("ShotHistoryPlugin", "Failed to create early index entry for shot %u", indexEntry.id);
    }
    return success;
}
