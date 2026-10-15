#ifndef MUSEAVATARPLUGIN_H
#define MUSEAVATARPLUGIN_H

#include "MuseLines.h"
#include <Arduino.h>
#include <atomic>
#include <display/core/Plugin.h>
#ifndef GAGGIMATE_HEADLESS // the headless build has no LVGL at all
#include <lvgl.h>
#endif
#include <mutex>

// Phase 1 of the Muse display project (see REQUIREMENTS.md §4 in
// workspace/gaggimate-muse-display): a state-driven animated Muse character
// on an LVGL top-layer overlay, with speech bubbles from a local line table.
//
// Threading: loop() runs on the plugin task and only *computes* machine state
// into the atomics below (same read pattern as LedControlPlugin). All LVGL
// objects are created via lv_async_call and afterwards only touched from the
// LVGL timer callback, i.e. inside lv_task_handler() on the UI task. The
// plugin is read-only: it never sends commands to the controller.
class MuseAvatarPlugin : public Plugin {
  public:
    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override;

  private:
    // --- state computation (plugin task) ---
    void updateState();
    MuseAvatarState computeState();
    void setSnapshot(MuseAvatarState state, const String &warningText);

#ifndef GAGGIMATE_HEADLESS
    // --- overlay view (UI task, via lv_async_call + lv_timer) ---
    static void overlayInitAsyncCb(void *userData);
    static void overlayTimerCb(lv_timer_t *timer);
    void createOverlay();
    void renderOverlay(uint32_t tick);
#endif

    Controller *controller = nullptr;
    bool initialized = false;      // controller:ready seen
    bool overlayRequested = false; // lv_async_call queued

    unsigned long lastUpdate = 0;
    unsigned long lastLineChange = 0;
    std::atomic<uint32_t> lineRotation{0};

    // Last-process bookkeeping for the DONE celebration window.
    void *seenDoneProcess = nullptr;
    unsigned long doneAt = 0;
    int doneShotSeconds = 0;
    int doneShotVolumeMl = 0;

    // Snapshot shared with the LVGL timer callback.
    std::atomic<uint8_t> snapState{static_cast<uint8_t>(MuseAvatarState::HIDDEN)};
    std::atomic<bool> snapBubbles{true};
    std::atomic<int> snapShotSeconds{0};
    std::atomic<int> snapShotVolumeMl{0};
    std::mutex warningMutex;
    char warningText[48] = "";

#ifndef GAGGIMATE_HEADLESS
    bool overlayCreated = false; // set from the async callback (UI task)

    // LVGL objects (UI task only).
    lv_obj_t *root = nullptr; // top-layer container
    lv_obj_t *img = nullptr;  // the Muse sprite (lv_img); pose follows state
    lv_obj_t *bubble = nullptr; // speech bubble container
    lv_obj_t *bubbleLabel = nullptr;
    const lv_img_dsc_t *renderedPose = nullptr; // sprite currently shown
    MuseAvatarState renderedState = MuseAvatarState::HIDDEN;
    char renderedBubble[64] = "";
    bool compactLayout = false; // status screen: smaller, lower-left, clear of the shot readouts
    bool layoutApplied = false;
#endif
};

#endif // MUSEAVATARPLUGIN_H
