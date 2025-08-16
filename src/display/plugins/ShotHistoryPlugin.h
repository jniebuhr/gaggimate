#ifndef SHOTHISTORYPLUGIN_H
#define SHOTHISTORYPLUGIN_H

#include <ArduinoJson.h>
#include <SPIFFS.h>
#include <display/core/Plugin.h>
#include <display/core/utils.h>

constexpr size_t SHOT_HISTORY_INTERVAL = 100;
constexpr size_t MAX_HISTORY_ENTRIES = 3;

class ShotHistoryPlugin : public Plugin {
  public:
    ShotHistoryPlugin() = default;

    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override {};

    void record();

    void handleRequest(JsonDocument &request, JsonDocument &response);

  private:
    struct ShotSample {
        unsigned long t;
        float tt;
        float ct;
        float tp;
        float cp;
        float fl;
        float tf;
        float pf;
        float vf;
        float v;
        float ev;

        std::string serialize() {
            return string_format("%d,%.3f,%.3f,%.3f,%.3f,%.3f,%.3f,%.3f,%.3f,%.3f,%.3f", t, tt, ct, tp, cp, fl, tf, pf, vf, v,
                                 ev);
        }
    };

    void startRecording();

    unsigned long getTime();

    void endRecording();
    void cleanupHistory();

    Controller *controller = nullptr;
    PluginManager *pluginManager = nullptr;
    String currentId = "";
    bool isFileOpen = false;

    bool recording = false;
    bool headerWritten = false;
    unsigned long shotStart = 0;
    unsigned long lastVolumeSample = 0;
    float currentTemperature = 0.0f;
    float currentBluetoothWeight = 0.0f;
    float currentBluetoothFlow = 0.0f;
    float currentEstimatedWeight = 0.0f;
    String currentProfileName;

    xTaskHandle taskHandle;
    static void loopTask(void *arg);
};

extern ShotHistoryPlugin ShotHistory;

#endif // SHOTHISTORYPLUGIN_H
