#ifndef SHOTUPLOADPLUGIN_H
#define SHOTUPLOADPLUGIN_H

#include <Arduino.h>
#include <FS.h>
#include <LittleFS.h>
#include <display/core/Plugin.h>
#include <display/models/shot_log_format.h>

#include <mutex>
#include <queue>

// Push completed shots to a remote server as Decent-style v2 shot JSON.
//
// Subscribes to evt:history-shot-saved (fired by ShotHistoryPlugin once the
// .slog is finalized and the index entry is persisted), converts the binary
// .slog into the JSON format consumed by Decent shot visualization/printing
// servers (see shot_log_format.h for the source mapping), and POSTs it via
// plain HTTP with a 3-attempt retry. Shots that fail all attempts are dropped
// (no offline queueing), so nothing is re-uploaded on the next boot.
//
// Settings: su_en (enabled), su_s (server URL, e.g. 192.168.1.5:8000),
// su_e (endpoint, default "upload"), su_m (machine id shown in query params),
// su_r (retries after the initial upload attempt, default 3). Fires
// evt:shot-upload:failed (payload "msg") when a shot is dropped.
class ShotUploadPlugin : public Plugin {
  public:
    ShotUploadPlugin() = default;

    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override;

    // Manually enqueue a shot for upload (e.g. "print this past shot" from the
    // WebUI). No-op-safe: the shot is processed by the same queue as auto-saved
    // shots, on the next processOnce() tick.
    void requestUpload(uint32_t shotId);

  private:
    // Delay between retry attempts (attempt count comes from setting su_r).
    static constexpr int RETRY_DELAY_MS = 2000;

    void processOnce(); // state machine, run from task (device) or loop (sim)
    void enqueueShot(uint32_t shotId);

    // Parse /h/<id>.slog into Decent v2 JSON; returns false if the file is
    // missing or its header is corrupt.
    bool buildShotJson(uint32_t shotId, String &outJson);
    // POST json to the configured server; true on any 2xx.
    bool upload(const String &json, uint32_t shotId, String &error);
    // Clean machine id: alphanumeric only, max 20 chars, "UNKNOWN" fallback
    // (same rules as the Decent print_the_shot plugin).
    String cleanMachineId(const String &raw) const;

    Controller *controller = nullptr;
    PluginManager *pluginManager = nullptr;
    FS *fs = &LittleFS;
    xTaskHandle taskHandle = nullptr;

    std::queue<uint32_t> uploadQueue; // shot ids awaiting upload
    std::mutex queueMutex;

    [[noreturn]] static void taskLoop(void *arg);
};

extern ShotUploadPlugin ShotUpload;

#endif // SHOTUPLOADPLUGIN_H
