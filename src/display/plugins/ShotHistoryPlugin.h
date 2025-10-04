#ifndef SHOTHISTORYPLUGIN_H
#define SHOTHISTORYPLUGIN_H

#include <ArduinoJson.h>
#include <SPIFFS.h>
#include <display/core/Plugin.h>
#include <display/core/utils.h>
#include <display/models/shot_log_format.h>


constexpr size_t MAX_HISTORY_ENTRIES = 10;
constexpr unsigned long EXTENDED_RECORDING_DURATION = 3000; // 3 seconds
constexpr unsigned long WEIGHT_STABILIZATION_TIME = 1000; // 1 second
constexpr float WEIGHT_STABILIZATION_THRESHOLD = 0.1f; // 0.1g threshold

class ShotHistoryPlugin : public Plugin {
  public:
    ShotHistoryPlugin() = default;

    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override {};

    void record();

    void handleRequest(JsonDocument &request, JsonDocument &response);

  private:
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
    unsigned long shotStart = 0;
    unsigned long extendedRecordingStart = 0;
    unsigned long lastWeightChangeTime = 0;
    float currentTemperature = 0.0f;
    float currentActiveWeight = 0.0f;
    float lastStableWeight = 0.0f;
    float lastActiveWeight = 0.0f;
    float currentActiveFlow = 0.0f;
    float currentEstimatedWeight = 0.0f;
    float currentPuckResistance = 0.0f;
    String currentProfileName;

    xTaskHandle taskHandle;
    void flushBuffer();
    static void loopTask(void *arg);
};

extern ShotHistoryPlugin ShotHistory;

#endif // SHOTHISTORYPLUGIN_H
