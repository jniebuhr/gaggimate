#ifndef SHOTHISTORYPLUGIN_H
#define SHOTHISTORYPLUGIN_H

#include <ArduinoJson.h>
#include <SPIFFS.h>
#include <display/core/Plugin.h>
#include <display/core/utils.h>
#include <display/models/shot_log_format.h>

constexpr size_t SHOT_HISTORY_INTERVAL = 100;
constexpr size_t MAX_HISTORY_ENTRIES = 100;                 // Increased from 10
constexpr unsigned long EXTENDED_RECORDING_DURATION = 3000; // 3 seconds
constexpr unsigned long WEIGHT_STABILIZATION_TIME = 1000;   // 1 second
constexpr float WEIGHT_STABILIZATION_THRESHOLD = 0.1f;      // 0.1g threshold

class ShotHistoryPlugin : public Plugin {
  public:
    ShotHistoryPlugin() = default;

    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override {};

    void record();

    void handleRequest(JsonDocument &request, JsonDocument &response);

    // Index management methods
    void appendToIndex(const ShotIndexEntry &entry);
    void updateIndexMetadata(uint32_t shotId, uint8_t rating, uint16_t volume);
    void markIndexDeleted(uint32_t shotId);
    void rebuildIndex();
    bool ensureIndexExists();

  private:
    // Index helper functions
    bool readIndexHeader(File &indexFile, ShotIndexHeader &header);
    int findEntryPosition(File &indexFile, const ShotIndexHeader &header, uint32_t shotId);
    bool readEntryAtPosition(File &indexFile, size_t position, ShotIndexEntry &entry);
    bool writeEntryAtPosition(File &indexFile, size_t position, const ShotIndexEntry &entry);
    void createEarlyIndexEntry();
    void updateIndexCompletion(uint32_t shotId, const ShotLogHeader &finalHeader);
    void saveNotes(const String &id, const JsonDocument &notes);
    void loadNotes(const String &id, JsonDocument &notes);
    void startRecording();

    unsigned long getTime();

    void endRecording();
    void finalizeRecording();
    void cleanupHistory();

    Controller *controller = nullptr;
    PluginManager *pluginManager = nullptr;
    String currentId = "";
    bool isFileOpen = false;
    File currentFile;
    ShotLogHeader header{};
    uint32_t sampleCount = 0;
    uint8_t ioBuffer[4096];
    size_t ioBufferPos = 0; // bytes used

    bool recording = false;
    bool extendedRecording = false;
    bool indexEntryCreated = false; // Track if early index entry was created
    unsigned long shotStart = 0;
    unsigned long extendedRecordingStart = 0;
    unsigned long lastWeightChangeTime = 0;
    float currentTemperature = 0.0f;
    float currentBluetoothWeight = 0.0f;
    float lastStableWeight = 0.0f;
    float lastBluetoothWeight = 0.0f;
    float currentBluetoothFlow = 0.0f;
    float currentEstimatedWeight = 0.0f;
    float currentPuckResistance = 0.0f;
    String currentProfileName;

    xTaskHandle taskHandle;
    void flushBuffer();
    static void loopTask(void *arg);
};

extern ShotHistoryPlugin ShotHistory;

#endif // SHOTHISTORYPLUGIN_H
