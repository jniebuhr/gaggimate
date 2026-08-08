#ifndef SHOTUPLOADPLUGIN_H
#define SHOTUPLOADPLUGIN_H

#include "../core/Plugin.h"
#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>

class Controller;

class ShotUploadPlugin : public Plugin {
  public:
    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override {};

    // Last completed shot waiting for a manual upload (empty if none / already uploaded).
    String getPendingShotId() const { return pendingShotId; }
    bool hasPendingUpload() const { return pendingShotId.length() > 0; }

    // Enqueue upload of the pending shot (no-op if none or plugin inactive).
    void uploadPending();

  private:
    void enqueueUpload(const String &shotId);
    void wakeServer();
    bool postShot(const String &shotId);
    String buildPayload(const String &shotId);
    String wakeUrlFromUploadUrl(const String &uploadUrl) const;
    static void uploadTask(void *arg);

    Controller *controller = nullptr;
    QueueHandle_t uploadQueue = nullptr;
    unsigned long lastWakeMs = 0;
    String pendingShotId;
};

extern ShotUploadPlugin ShotUpload;

#endif // SHOTUPLOADPLUGIN_H
