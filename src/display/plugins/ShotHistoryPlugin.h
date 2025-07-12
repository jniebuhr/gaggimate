#ifndef SHOTHISTORYPLUGIN_H
#define SHOTHISTORYPLUGIN_H

#include "../core/Plugin.h"
#include <ArduinoJson.h>
#include <vector>

constexpr size_t SHOT_HISTORY_INTERVAL = 100;

class ShotHistoryPlugin : public Plugin {
  public:
    ShotHistoryPlugin() = default;
    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override;

    void handleRequest(JsonDocument &request, JsonDocument &response);

  private:
    struct ShotSample {
        unsigned long t;
        int tt;
        int ct;
        float tp;
        float cp;
        float sw;
        float fl;
        float ew;
    };

    void startRecording();
    void endRecording();

    Controller *controller = nullptr;
    PluginManager *pluginManager = nullptr;

    bool recording = false;
    unsigned long shotStart = 0;
    unsigned long lastSample = 0;
    std::vector<ShotSample> shot;
    String currentProfileName;
};

extern ShotHistoryPlugin ShotHistory;

#endif // SHOTHISTORYPLUGIN_H
