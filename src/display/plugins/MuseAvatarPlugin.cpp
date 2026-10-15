#include "MuseAvatarPlugin.h"
#include <cstring>
#include <display/core/Controller.h>
#include <display/core/WarningManager.h>
#include <display/core/constants.h>
#include <display/core/process/BrewProcess.h>

namespace {
constexpr unsigned long STATE_POLL_MS = 150;
constexpr unsigned long LINE_ROTATE_MS = 6000;
constexpr unsigned long DONE_WINDOW_MS = 10000;
constexpr float READY_TEMP_TOLERANCE = 3.0f;
} // namespace

#ifndef GAGGIMATE_HEADLESS
#include "MuseSprites.h"
#include <display/ui/default/eez/eez-flow.h>
#include <display/ui/default/eez/screens.h>

// Layout (480x480 round panel): the avatar sits in the lower-center area,
// inside the inscribed safe circle, and leaves the gauge dials and the
// temperature/pressure readouts at the top untouched. The sprite is fitted
// into a box (per layout) with lv_img zoom; all poses share one scale in the
// source assets, so the character size is consistent across states.
namespace {
// Large layout fit box / root placement (align-center offsets). Sized to
// match the Phase 1 placeholder footprint (132px circle at y+128), so the
// sprite clears the profile name on the brew screen and the steam bar.
constexpr int BOX_W = 168;
constexpr int BOX_H = 158;
constexpr int ROOT_Y = 128;
// Compact layout (status screen): smaller, lower-left, clear of readouts.
constexpr int BOX_W_C = 108;
constexpr int BOX_H_C = 108;
constexpr int ROOT_X_C = -108;
constexpr int ROOT_Y_C = 124;

void setHidden(lv_obj_t *obj, bool hidden) {
    if (hidden)
        lv_obj_add_flag(obj, LV_OBJ_FLAG_HIDDEN);
    else
        lv_obj_clear_flag(obj, LV_OBJ_FLAG_HIDDEN);
}

lv_obj_t *makeLabel(lv_obj_t *parent, const lv_font_t *font, lv_color_t color) {
    lv_obj_t *label = lv_label_create(parent);
    lv_obj_set_style_text_font(label, font, LV_PART_MAIN);
    lv_obj_set_style_text_color(label, color, LV_PART_MAIN);
    lv_obj_clear_flag(label, LV_OBJ_FLAG_CLICKABLE);
    return label;
}

// State -> sprite pose. BREWING_LATE uses the celebrating pose: past 25 s
// the shot deserves a small party, and DONE already uses the espresso-cup
// pose for the finish summary.
const lv_img_dsc_t *poseForState(MuseAvatarState state) {
    switch (state) {
    case MuseAvatarState::SLEEP:
        return &muse_pose_sleep;
    case MuseAvatarState::HEATING:
        return &muse_pose_heating;
    case MuseAvatarState::READY:
        return &muse_pose_ready;
    case MuseAvatarState::BREWING:
        return &muse_pose_brewing;
    case MuseAvatarState::BREWING_LATE:
        return &muse_pose_celebrate;
    case MuseAvatarState::STEAMING:
        return &muse_pose_steaming;
    case MuseAvatarState::DONE:
        return &muse_pose_done;
    case MuseAvatarState::WARNING:
        return &muse_pose_warning;
    default:
        return &muse_pose_ready;
    }
}

// Zoom (256 = 100%) that fits the whole sprite inside the box.
int fitZoom(const lv_img_dsc_t *dsc, int boxW, int boxH) {
    const int zx = 256 * boxW / dsc->header.w;
    const int zy = 256 * boxH / dsc->header.h;
    const int z = zx < zy ? zx : zy;
    return z > 0 ? z : 1;
}
} // namespace
#endif // GAGGIMATE_HEADLESS

void MuseAvatarPlugin::setup(Controller *controller, PluginManager *pluginManager) {
    this->controller = controller;
    pluginManager->on("controller:ready", [this](Event const) { initialized = true; });
}

void MuseAvatarPlugin::loop() {
    if (!initialized || controller == nullptr) {
        return;
    }
#ifndef GAGGIMATE_HEADLESS
    if (!overlayRequested) {
        overlayRequested = true;
        if (lv_async_call(overlayInitAsyncCb, this) != LV_RES_OK) {
            overlayRequested = false; // LVGL not up yet; retry next loop
        }
    }
#endif
    const unsigned long now = millis();
    if (now - lastUpdate >= STATE_POLL_MS) {
        lastUpdate = now;
        updateState();
    }
}

// ---------------------------------------------------------------------------
// State computation (plugin task; read-only, mirrors LedControlPlugin access)
// ---------------------------------------------------------------------------

void MuseAvatarPlugin::setSnapshot(MuseAvatarState state, const String &warning) {
    snapState.store(static_cast<uint8_t>(state));
    if (warning.length() > 0) {
        std::lock_guard<std::mutex> guard(warningMutex);
        strncpy(warningText, warning.c_str(), sizeof(warningText) - 1);
        warningText[sizeof(warningText) - 1] = '\0';
    }
}

MuseAvatarState MuseAvatarPlugin::computeState() {
    // Warnings override everything (§4.1 priority).
    const WarningManager &wm = controller->getWarnings();
    if (controller->isErrorState()) {
        setSnapshot(MuseAvatarState::WARNING, controller->getSystemStateMessage());
        return MuseAvatarState::WARNING;
    }
    if (wm.hasError() || wm.hasWarning()) {
        String labels = wm.getLabels();
        const int nl = labels.indexOf('\n');
        setSnapshot(MuseAvatarState::WARNING, nl >= 0 ? labels.substring(0, nl) : labels);
        return MuseAvatarState::WARNING;
    }

    const int mode = controller->getMode();
    bool brewRunning = false;
    unsigned long brewElapsedMs = 0;
    {
        // Deref under the process lock — other tasks delete processes (GM-147).
        std::lock_guard<std::recursive_mutex> guard(controller->getProcessLock());
        Process *current = controller->getProcess();
        if (current != nullptr && current->getType() == MODE_BREW && current->isActive()) {
            brewRunning = true;
            brewElapsedMs = millis() - static_cast<BrewProcess *>(current)->processStarted;
        }
        Process *last = controller->getLastProcess();
        if (last != nullptr && last->getType() == MODE_BREW && last->isComplete() && last != seenDoneProcess) {
            auto *brew = static_cast<BrewProcess *>(last);
            if (brew->finished > brew->processStarted) {
                seenDoneProcess = last;
                doneAt = millis();
                doneShotSeconds = static_cast<int>((brew->finished - brew->processStarted) / 1000);
                doneShotVolumeMl = static_cast<int>(brew->currentVolume);
            }
        }
    }
    if (brewRunning) {
        return brewElapsedMs > 25000 ? MuseAvatarState::BREWING_LATE : MuseAvatarState::BREWING;
    }
    if (controller->isActive() && mode == MODE_STEAM) {
        return MuseAvatarState::STEAMING;
    }
    if (doneAt > 0 && millis() - doneAt < DONE_WINDOW_MS) {
        snapShotSeconds.store(doneShotSeconds);
        snapShotVolumeMl.store(doneShotVolumeMl);
        return MuseAvatarState::DONE;
    }
    if (mode == MODE_STANDBY) {
        return MuseAvatarState::SLEEP;
    }
    if (mode == MODE_STEAM) {
        return MuseAvatarState::STEAMING;
    }
    // Awake (brew/water/grind modes): heating until the boiler is at target.
    const float target = controller->getTargetTemp();
    if (target > 0 && controller->getCurrentTemp() < target - READY_TEMP_TOLERANCE) {
        return MuseAvatarState::HEATING;
    }
    return MuseAvatarState::READY;
}

void MuseAvatarPlugin::updateState() {
    const Settings &settings = controller->getSettings();
    if (!settings.isMuseEnabled()) {
        snapState.store(static_cast<uint8_t>(MuseAvatarState::HIDDEN));
        return;
    }
    snapBubbles.store(settings.isMuseBubbles());
    const MuseAvatarState state = computeState();
    if (state != MuseAvatarState::WARNING) {
        setSnapshot(state, "");
    }
    if (millis() - lastLineChange >= LINE_ROTATE_MS) {
        lastLineChange = millis();
        lineRotation.fetch_add(1);
    }
}

#ifndef GAGGIMATE_HEADLESS
// ---------------------------------------------------------------------------
// Overlay view (UI task only)
// ---------------------------------------------------------------------------

void MuseAvatarPlugin::overlayInitAsyncCb(void *userData) { static_cast<MuseAvatarPlugin *>(userData)->createOverlay(); }

void MuseAvatarPlugin::overlayTimerCb(lv_timer_t *timer) {
    auto *self = static_cast<MuseAvatarPlugin *>(timer->user_data);
    self->renderOverlay(lv_tick_get());
}

void MuseAvatarPlugin::createOverlay() {
    if (overlayCreated) {
        return;
    }
    overlayCreated = true;

    root = lv_obj_create(lv_layer_top());
    lv_obj_set_size(root, BOX_W, BOX_H);
    lv_obj_align(root, LV_ALIGN_CENTER, 0, ROOT_Y);
    lv_obj_set_style_bg_opa(root, LV_OPA_TRANSP, LV_PART_MAIN);
    lv_obj_set_style_border_width(root, 0, LV_PART_MAIN);
    lv_obj_set_style_pad_all(root, 0, LV_PART_MAIN);
    lv_obj_clear_flag(root, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_CLICKABLE);

    img = lv_img_create(root);
    lv_img_set_antialias(img, true);
    lv_obj_clear_flag(img, LV_OBJ_FLAG_CLICKABLE);

    bubble = lv_obj_create(lv_layer_top());
    lv_obj_set_width(bubble, 250);
    lv_obj_set_height(bubble, LV_SIZE_CONTENT);
    lv_obj_align(bubble, LV_ALIGN_CENTER, 0, 32);
    lv_obj_set_style_bg_color(bubble, lv_color_hex(0xFFFFFF), LV_PART_MAIN);
    lv_obj_set_style_bg_opa(bubble, LV_OPA_90, LV_PART_MAIN);
    lv_obj_set_style_radius(bubble, 12, LV_PART_MAIN);
    lv_obj_set_style_border_width(bubble, 0, LV_PART_MAIN);
    lv_obj_set_style_pad_all(bubble, 6, LV_PART_MAIN);
    lv_obj_clear_flag(bubble, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_CLICKABLE);

    bubbleLabel = makeLabel(bubble, &lv_font_montserrat_14, lv_color_hex(0x26221F));
    lv_label_set_text(bubbleLabel, "");
    lv_obj_set_width(bubbleLabel, 238);
    lv_label_set_long_mode(bubbleLabel, LV_LABEL_LONG_DOT);
    lv_obj_align(bubbleLabel, LV_ALIGN_CENTER, 0, 0);

    lv_timer_create(overlayTimerCb, 120, this);
    renderOverlay(0);
}

void MuseAvatarPlugin::renderOverlay(uint32_t tick) {
    if (root == nullptr) {
        return;
    }
    const auto state = static_cast<MuseAvatarState>(snapState.load());

    // Hide entirely on menu/info/profile screens so nothing blocks operation,
    // and when the avatar is disabled (stock UI, §4.3).
    const int16_t screen = eez_flow_get_current_screen();
    const bool onMainScreen = screen == SCREEN_ID_STANDBY_SCREEN || screen == SCREEN_ID_BREW_SCREEN ||
                              screen == SCREEN_ID_STATUS_SCREEN || screen == SCREEN_ID_STEAM_SCREEN ||
                              screen == SCREEN_ID_WATER_SCREEN || screen == SCREEN_ID_GRIND_SCREEN;
    const bool visible = state != MuseAvatarState::HIDDEN && onMainScreen;
    setHidden(root, !visible);
    if (!visible) {
        lv_obj_add_flag(bubble, LV_OBJ_FLAG_HIDDEN);
        return;
    }

    // The status screen carries the live shot timer/weight in the center, so
    // there the avatar shrinks into the empty lower-left area (§2.2: never
    // cover a readout). Everywhere else it uses the large layout. Both use
    // the same sprite asset — the compact layout is just a smaller zoom.
    const bool compact = screen == SCREEN_ID_STATUS_SCREEN;
    const int boxW = compact ? BOX_W_C : BOX_W;
    const int boxH = compact ? BOX_H_C : BOX_H;
    if (compact != compactLayout || !layoutApplied) {
        compactLayout = compact;
        layoutApplied = true;
        lv_obj_set_size(root, boxW, boxH);
        lv_obj_set_width(bubble, compact ? 216 : 250);
        lv_obj_set_width(bubbleLabel, compact ? 204 : 238);
        renderedPose = nullptr; // force pose re-apply at the new zoom
    }
    const int rootX = compact ? ROOT_X_C : 0;
    const int rootY = compact ? ROOT_Y_C : ROOT_Y;
    lv_obj_align(root, LV_ALIGN_CENTER, rootX, rootY);
    // Bubble vertical position matches the Phase 1 geometry (centre offset
    // +32 on the large layout), so it clears the profile name on the brew
    // screen and the temperature readout on the steam screen exactly as
    // before; the compact layout keeps its own proven offset.
    const int bubbleY = compact ? ROOT_Y_C - BOX_H_C / 2 - 34 : 32;
    lv_obj_align(bubble, LV_ALIGN_CENTER, rootX, bubbleY);

    // --- sprite pose + transform animation (tick-driven, ~8.3 fps) ---
    const lv_img_dsc_t *pose = poseForState(state);
    if (pose != renderedPose) {
        renderedPose = pose;
        lv_img_set_src(img, pose);
        lv_img_set_pivot(img, pose->header.w / 2, pose->header.h / 2);
    }
    const uint32_t phase = tick / 120; // ~8.3 fps animation steps
    int zoom = fitZoom(pose, boxW, boxH);
    int angle = 0; // 0.1 degree units
    int dx = 0;
    int dy = 0;
    switch (state) {
    case MuseAvatarState::SLEEP:
        zoom += (phase % 10) < 5 ? 0 : 4; // slow breathing
        break;
    case MuseAvatarState::HEATING:
        dy = (phase % 8) < 4 ? 0 : -2;
        angle = (phase % 12) < 6 ? -12 : 12;
        break;
    case MuseAvatarState::READY:
        dy = (phase % 8) < 4 ? 0 : -2; // gentle idle bob + sway
        angle = (phase % 16) < 8 ? -14 : 14;
        break;
    case MuseAvatarState::BREWING:
        angle = (phase % 10) < 5 ? -10 : 10; // focused, steady
        break;
    case MuseAvatarState::BREWING_LATE:
        dy = phase % 4 == 0 ? -8 : 0; // little hop of excitement
        angle = (phase % 8) < 4 ? -16 : 16;
        break;
    case MuseAvatarState::STEAMING:
        dy = (phase % 8) < 4 ? 0 : -2;
        angle = (phase % 12) < 6 ? -20 : 20;
        break;
    case MuseAvatarState::DONE:
        dy = phase % 4 == 0 ? -12 : 0; // celebration jump
        break;
    case MuseAvatarState::WARNING:
        dx = phase % 2 == 0 ? -2 : 2; // worried shake
        break;
    default:
        break;
    }
    lv_img_set_zoom(img, zoom);
    lv_img_set_angle(img, angle);
    lv_obj_align(img, LV_ALIGN_BOTTOM_MID, dx, dy);

    // --- speech bubble ---
    char text[64] = "";
    if (snapBubbles.load()) {
        if (state == MuseAvatarState::WARNING) {
            std::lock_guard<std::mutex> guard(warningMutex);
            strncpy(text, warningText, sizeof(text) - 1);
        } else if (state == MuseAvatarState::DONE) {
            snprintf(text, sizeof(text), "Done! %ds shot", snapShotSeconds.load());
            if (snapShotVolumeMl.load() > 0) {
                char extra[24];
                snprintf(extra, sizeof(extra), ", %d ml", snapShotVolumeMl.load());
                strncat(text, extra, sizeof(text) - strlen(text) - 1);
            }
        } else if (state != MuseAvatarState::SLEEP) {
            strncpy(text, museLocalLines.getLine(state, lineRotation.load()), sizeof(text) - 1);
        }
    }
    text[sizeof(text) - 1] = '\0';
    const bool showBubble = text[0] != '\0';
    setHidden(bubble, !showBubble);
    if (showBubble && strcmp(text, renderedBubble) != 0) {
        strncpy(renderedBubble, text, sizeof(renderedBubble) - 1);
        renderedBubble[sizeof(renderedBubble) - 1] = '\0';
        lv_label_set_text(bubbleLabel, text);
    }
    renderedState = state;
}
#endif // GAGGIMATE_HEADLESS
