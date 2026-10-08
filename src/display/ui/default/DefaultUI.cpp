#include "DefaultUI.h"

#include <WiFi.h>
#include <display/core/Controller.h>
#include <display/core/ProfileImage.h>
#include <display/core/process/BrewProcess.h>
#include <display/core/process/Process.h>
#include <display/core/zones.h>
#ifndef GAGGIMATE_SIM // hardware panel drivers are device-only
#include <display/drivers/AmoledDisplayDriver.h>
#include <display/drivers/LilyGoDriver.h>
#include <display/drivers/WaveshareDriver.h>
#include <display/drivers/common/LV_Helper.h>
#endif
#include <display/main.h>
#include <display/ui/utils/effects.h>
#include <utility>

#include "esp_sntp.h"

#include <display/ui/default/eez/ui.h>
#include <display/ui/default/eez/images.h>
#include <array>
#include <cstring>

static EffectManager effect_mgr;

static constexpr uint32_t STARTUP_FADE_MS = 1000; // standby fade-in duration on power-up

static constexpr int32_t GAUGE_TICK_LONG = 25;      // meter tick length on most screens
static constexpr int32_t GAUGE_TICK_SHORT = 10;     // shortened tick length on profile / new-menu screens
static constexpr uint32_t GAUGE_TICK_ANIM_MS = 300; // tick length transition duration
static constexpr int16_t GAUGE_SETPOINT_INSIDE_PIVOT_X = -196;
static constexpr int16_t GAUGE_SETPOINT_OUTSIDE_PIVOT_X = -233;

static std::array<uint8_t, 8 * 14 * LV_IMG_PX_SIZE_ALPHA_BYTE> insideIndicatorPixels;
static lv_img_dsc_t insideIndicator;
static bool insideIndicatorInitialized = false;

static void initializeInsideIndicator() {
    if (insideIndicatorInitialized)
        return;
    constexpr size_t width = 8;
    constexpr size_t height = 14;
    constexpr size_t bytesPerPixel = LV_IMG_PX_SIZE_ALPHA_BYTE;
    const uint8_t *outsidePixels = img_indicator_small.data;
    for (size_t row = 0; row < height; row++) {
        for (size_t column = 0; column < width; column++) {
            const size_t source = (row * width + (width - 1 - column)) * bytesPerPixel;
            const size_t destination = (row * width + column) * bytesPerPixel;
            memcpy(insideIndicatorPixels.data() + destination, outsidePixels + source, bytesPerPixel);
        }
    }
    insideIndicator.data = insideIndicatorPixels.data();
    insideIndicator.header = img_indicator_small.header;
    insideIndicator.data_size = img_indicator_small.data_size;
    insideIndicatorInitialized = true;
}

// Profile, menu and info screens, plus the status screen in chart mode, show shortened meter ticks.
static bool isShortTickScreen(ScreensEnum s, bool chartMode) {
    return s == SCREEN_ID_MENU_SCREEN_NEW || s == SCREEN_ID_INFO_SCREEN || s == SCREEN_ID_NEW_PROFILE_SCREEN ||
           (chartMode && s == SCREEN_ID_STATUS_SCREEN);
}

// Format a millisecond duration as "m:ss" for the brew/profile time labels.
static void formatDuration(unsigned long ms, char *buf, size_t len) {
    const double seconds = ms / 1000.0;
    const int minutes = static_cast<int>(seconds / 60.0);
    const int secs = static_cast<int>(seconds) % 60;
    snprintf(buf, len, "%d:%02d", minutes, secs);
}

static float clampPercentage(float pct) { return pct < 0.0f ? 0.0f : (pct > 100.0f ? 100.0f : pct); }

// Shot chart styling, after the community concept UI: thin lines, endpoint dot, no grid or fill.
// Theme color slots (Pressure, Progress, Temperature, Warning) so the chart matches the rest of the UI.
static constexpr int SHOT_THEME_COLORS[SHOT_SERIES_COUNT] = {7, 7, 2, 2, 6, 8};
static constexpr int SHOT_GUIDE_COLOR = 3; // theme SemiDark, for the baseline and phase markers
static constexpr lv_coord_t SHOT_DOT_RADIUS = 3;
static constexpr bool SHOT_IS_TARGET[SHOT_SERIES_COUNT] = {false, true, false, true, false, false};
static constexpr lv_coord_t SHOT_CHART_SCALE = 1000;    // every series is normalised to 0..1000 of its own range
static constexpr float SHOT_FLOW_RANGE_DEFAULT = 12.0f; // bar / ml/s
static constexpr float SHOT_WEIGHT_RANGE_DEFAULT = 50.0f;
static constexpr float SHOT_TEMP_RANGE = 10.0f; // profile temperature centred, ±10 °C

static constexpr int PROFILE_THEME_COLORS[2] = {7, 2};  // pressure, flow; same slots as the shot chart
static constexpr float PROFILE_CHART_STEP = 0.1f;       // s, matches the web UI profile chart
static constexpr float PROFILE_CHART_MIN_RANGE = 10.0f; // bar / ml/s

static float applyEasing(float t, TransitionType type) {
    if (t <= 0.0f)
        return 0.0f;
    if (t >= 1.0f)
        return 1.0f;
    switch (type) {
    case TransitionType::LINEAR:
        return t;
    case TransitionType::EASE_IN:
        return t * t;
    case TransitionType::EASE_OUT:
        return 1.0f - (1.0f - t) * (1.0f - t);
    case TransitionType::EASE_IN_OUT:
        return t < 0.5f ? 2.0f * t * t : 1.0f - 2.0f * (1.0f - t) * (1.0f - t);
    default:
        return 1.0f;
    }
}

static lv_coord_t scaleShotValue(float value, float min, float max) {
    const int32_t scaled = lroundf((value - min) / (max - min) * SHOT_CHART_SCALE);
    return static_cast<lv_coord_t>(LV_CLAMP(0, scaled, SHOT_CHART_SCALE));
}

// Grow a range in whole steps until it fits value.
static float growShotRange(float range, float value, float step) {
    while (value > range)
        range += step;
    return range;
}

// Shared look of the live shot chart and the profile preview chart: thin lines, no grid, baseline and phase markers.
static void styleTrendChart(lv_obj_t *chart, uint16_t points) {
    lv_chart_set_type(chart, LV_CHART_TYPE_LINE);
    lv_chart_set_point_count(chart, points);
    lv_chart_set_range(chart, LV_CHART_AXIS_PRIMARY_Y, 0, SHOT_CHART_SCALE);
    lv_chart_set_div_line_count(chart, 0, 0);
    lv_obj_set_style_border_opa(chart, LV_OPA_TRANSP, LV_PART_MAIN);
    lv_obj_set_style_line_width(chart, 0, LV_PART_MAIN);
    // Inset the plot by the dot radius so endpoint dots at the edges aren't clipped by the chart bounds.
    lv_obj_set_style_pad_all(chart, SHOT_DOT_RADIUS, LV_PART_MAIN);
    lv_obj_set_style_pad_left(chart, 0, LV_PART_MAIN);
    lv_obj_set_style_line_width(chart, 2, LV_PART_ITEMS);
    lv_obj_set_style_size(chart, 0, LV_PART_INDICATOR);
}

// The chart shares one line descriptor across all series, so set every field each segment.
static void styleTrendLine(lv_draw_line_dsc_t *line, bool secondary) {
    line->dash_width = secondary ? 3 : 0;
    line->dash_gap = secondary ? 3 : 0;
    line->opa = secondary ? LV_OPA_60 : LV_OPA_COVER;
    line->width = secondary ? 1 : 2;
}

// Drawn before the series so the guides sit behind the lines.
static void drawTrendGuides(lv_event_t *e, int theme, const bool *phaseMarks, int markCount, int pointCount) {
    lv_obj_t *chart = lv_event_get_target(e);
    lv_draw_ctx_t *drawCtx = lv_event_get_draw_ctx(e);
    lv_area_t content;
    lv_obj_get_content_coords(chart, &content);
    const lv_coord_t width = lv_obj_get_content_width(chart);
    const lv_coord_t bottom = content.y1 + lv_obj_get_content_height(chart);

    lv_draw_line_dsc_t line;
    lv_draw_line_dsc_init(&line);
    line.color = lv_color_hex(theme_colors[theme][SHOT_GUIDE_COLOR]);
    line.width = 1;
    line.opa = LV_OPA_40;
    const lv_point_t baseStart = {content.x1, bottom};
    const lv_point_t baseEnd = {content.x2, bottom};
    lv_draw_line(drawCtx, &line, &baseStart, &baseEnd);

    line.opa = LV_OPA_30;
    line.dash_width = 2;
    line.dash_gap = 3;
    for (int i = 0; i < markCount; i++) {
        if (!phaseMarks[i])
            continue;
        const lv_coord_t x = static_cast<lv_coord_t>(content.x1 + width * i / (pointCount - 1));
        const lv_point_t top = {x, content.y1};
        const lv_point_t base = {x, bottom};
        lv_draw_line(drawCtx, &line, &top, &base);
    }
}

// EEZ string setters allocate a fresh StringRef on the LVGL heap each call; skip unchanged text to cut churn.
static bool stringChanged(const char *current, const char *next) {
    return current == nullptr || next == nullptr || strcmp(current, next) != 0;
}

int16_t calculate_angle(int set_temp, int range, int offset) {
    const double percentage = static_cast<double>(set_temp) / static_cast<double>(MAX_TEMP);
    return (percentage * ((double)range)) - range / 2 - offset;
}

void DefaultUI::reloadProfiles() { profileLoaded = 0; }

DefaultUI::DefaultUI(Controller *controller, Driver *driver, PluginManager *pluginManager)
    : controller(controller), panelDriver(driver), pluginManager(pluginManager) {
    setupPanel();
    xTaskCreatePinnedToCore(loopTask, "DefaultUI::loop", configMINIMAL_STACK_SIZE * 6, this, 1, &taskHandle, 1);
}

void DefaultUI::init() {
    profileManager = controller->getProfileManager();
    auto triggerRender = [this](Event const &) { rerender = true; };
    pluginManager->on("boiler:currentTemperature:change", [=](Event const &event) {
        int newTemp = static_cast<int>(event.getFloat("value"));
        if (newTemp != currentTemp) {
            currentTemp = newTemp;
            rerender = true;
        }
    });
    pluginManager->on("boiler:pressure:change", [=](Event const &event) {
        float newPressure = event.getFloat("value");
        if (round(newPressure * 10.0f) != round(pressure * 10.0f)) {
            pressure = newPressure;
            rerender = true;
        }
    });
    pluginManager->on("boiler:targetTemperature:change", [=](Event const &event) {
        int newTemp = static_cast<int>(event.getFloat("value"));
        if (newTemp != targetTemp) {
            targetTemp = newTemp;
            rerender = true;
        }
    });
    pluginManager->on("controller:targetVolume:change", [=](Event const &event) { rerender = true; });
    pluginManager->on("controller:targetDuration:change", [=](Event const &event) { rerender = true; });
    pluginManager->on("controller:grindDuration:change", [=](Event const &event) { rerender = true; });
    pluginManager->on("controller:grindVolume:change", [=](Event const &event) { rerender = true; });
    pluginManager->on("controller:grind:end", triggerRender);
    pluginManager->on("controller:grind:start", triggerRender);
    pluginManager->on("controller:process:end", triggerRender);
    pluginManager->on("controller:process:start", triggerRender);
    pluginManager->on("controller:mode:change", [this](Event const &event) {
        mode = event.getInt("value");
        switch (mode) {
        case MODE_STANDBY:
            changeScreen(SCREEN_ID_STANDBY_SCREEN);
            break;
        case MODE_BREW:
            changeScreen(SCREEN_ID_BREW_SCREEN);
            break;
        case MODE_GRIND:
            changeScreen(SCREEN_ID_GRIND_SCREEN);
            break;
        case MODE_STEAM:
            changeScreen(SCREEN_ID_STEAM_SCREEN);
            break;
        case MODE_WATER:
            changeScreen(SCREEN_ID_WATER_SCREEN);
            break;
        default:
            break;
        };
    });
    pluginManager->on("controller:brew:start", [this](Event const &event) { changeScreen(SCREEN_ID_STATUS_SCREEN); });
    pluginManager->on("controller:brew:clear", [this](Event const &event) {
        if (eez_flow_get_current_screen() == SCREEN_ID_STATUS_SCREEN) {
            changeScreen(SCREEN_ID_BREW_SCREEN);
        }
    });
    pluginManager->on("controller:bluetooth:waiting", [this](Event const &) {
        waitingForController = true;
        rerender = true;
    });
    pluginManager->on("controller:brew:confirm", [this](Event const &) {
        if (eez_flow_get_current_screen() != SCREEN_ID_BREW_SCREEN)
            changeScreen(SCREEN_ID_BREW_SCREEN);
        setBrewConfirmVisible(true);
    });
    // Answered elsewhere (web UI, other client): drop the overlay.
    pluginManager->on("controller:brew:confirm:cancel", [this](Event const &) { setBrewConfirmVisible(false); });
    pluginManager->on("controller:brew:start", [this](Event const &) { setBrewConfirmVisible(false); });
    pluginManager->on("controller:bluetooth:connect", [this](Event const &) {
        waitingForController = false;
        if (eez_flow_get_current_screen() == SCREEN_ID_STANDBY_SCREEN && !controller->getSystemInfo().protocolMismatch &&
            !initialized) {
            ::Settings &settings = controller->getSettings();
            if (settings.getStartupMode() == MODE_BREW) {
                changeScreen(SCREEN_ID_BREW_SCREEN);
            } else {
                standbyEnterTime = ::millis();
            }
        }
        initialized = true;
        pressureAvailable = controller->getSystemInfo().capabilities.pressure;
        rerender = true;
    });
    pluginManager->on("controller:bluetooth:disconnect", [this](Event const &) {
        waitingForController = true;
        rerender = true;
    });
    pluginManager->on("controller:wifi:connect", [this](Event const &event) {
        rerender = true;
        apActive = event.getInt("AP");
    });
    pluginManager->on("ota:update:start", [this](Event const &) {
        rerender = true;
        changeScreen(SCREEN_ID_STANDBY_SCREEN);
    });
    pluginManager->on("ota:update:end", [this](Event const &) {
        rerender = true;
        changeScreen(SCREEN_ID_STANDBY_SCREEN);
    });
    pluginManager->on("ota:update:status", [this](Event const &event) {
        rerender = true;
        updateAvailable = event.getInt("value");
    });
    pluginManager->on("controller:error", [this](Event const &) {
        rerender = true;
        changeScreen(SCREEN_ID_STANDBY_SCREEN);
    });
    pluginManager->on("controller:protocol:mismatch", [this](Event const &) {
        // Incompatible firmware on the other end: control is inhibited (OTA only),
        // so surface it on the standby screen like a runaway error.
        rerender = true;
        changeScreen(SCREEN_ID_STANDBY_SCREEN);
    });
    pluginManager->on("controller:autotune:start", [this](Event const &) { changeScreen(SCREEN_ID_STANDBY_SCREEN); });
    pluginManager->on("controller:autotune:result", [this](Event const &) { changeScreen(SCREEN_ID_STANDBY_SCREEN); });

    pluginManager->on("profiles:profile:select", [this](Event const &event) {
        reloadProfiles();
        rerender = true;
    });
    pluginManager->on("profiles:profile:favorite", [this](Event const &event) { reloadProfiles(); });
    pluginManager->on("profiles:profile:unfavorite", [this](Event const &event) { reloadProfiles(); });
    pluginManager->on("profiles:profile:save", [this](Event const &event) { reloadProfiles(); });
    pluginManager->on("profiles:image:change", [this](Event const &) {
        imageGeneration++;
        reloadProfiles();
        rerender = true;
    });
    pluginManager->on("controller:volumetric-measurement:active:change", [=](Event const &event) {
        double newWeight = event.getFloat("value");
        if (round(newWeight * 10.0) != round(activeWeight * 10.0)) {
            activeWeight = newWeight;
            rerender = true;
        }
    });
    // Task names cap at 15 chars; "DefaultUI::loopProfiles" read as "DefaultUI::loop" in panics. SD + JSON need the headroom.
    xTaskCreatePinnedToCore(profileLoopTask, "UI::profiles", configMINIMAL_STACK_SIZE * 6, this, 1, &profileTaskHandle, 0);
}

// True while any pointer input device (the touch panel) is pressed.
static bool pointerPressed() {
    for (lv_indev_t *indev = lv_indev_get_next(nullptr); indev != nullptr; indev = lv_indev_get_next(indev)) {
        if (lv_indev_get_type(indev) == LV_INDEV_TYPE_POINTER && indev->proc.state == LV_INDEV_STATE_PRESSED)
            return true;
    }
    return false;
}

void DefaultUI::loop() {
    const unsigned long now = ::millis();
    const unsigned long diff = now - lastRender;

    if (touchFlushHeld) {
        if (!controller->isActive()) {
            touchFlushHeld = false;
        } else if (!pointerPressed()) {
            touchFlushHeld = false;
            controller->onFlushRelease();
        }
    }

    if (now - lastTempLog > TEMP_HISTORY_INTERVAL) {
        lastTempLog = now;
        if (++heatingFlashTick % 4 == 0) {
            heatingFlash = !heatingFlash;
            rerender = true;
        }
    }

    if ((controller->isActive() && diff > RERENDER_INTERVAL_ACTIVE) || diff > RERENDER_INTERVAL_IDLE) {
        rerender = true;
    }

    if (rerender) {
        rerender = false;
        lastRender = now;
        applyTheme();
        if (controller->isErrorState()) {
            changeScreen(SCREEN_ID_STANDBY_SCREEN);
        }
        updateState();
        // Fill the EEZ data models before handleScreenChange() creates/ticks a screen (undefined fields abort the flow).
        updateSystemStatus();
        updateWarnings();
        updateProfileInfo();
        updateBoiler();
        updateBrewProcess();
        updateShotChart();
        currentWeight = FloatValue(activeWeight);
        eez::flow::setGlobalVariable(FLOW_GLOBAL_VARIABLE_SCALE_WEIGHT_CURRENT, currentWeight);

        char timeBuf[12];
        formatDuration(controller->getSettings().getTargetGrindDuration(), timeBuf, sizeof(timeBuf));
        if (stringChanged(grindTimeTarget.getString(), timeBuf)) {
            grindTimeTarget = StringValue(timeBuf);
            eez::flow::setGlobalVariable(FLOW_GLOBAL_VARIABLE_GRIND_TIME_TARGET, grindTimeTarget);
        }
        grindWeightTarget = FloatValue(controller->getSettings().getTargetGrindVolume());
        eez::flow::setGlobalVariable(FLOW_GLOBAL_VARIABLE_GRIND_WEIGHT_TARGET, grindWeightTarget);

        handleScreenChange();
        currentScreen = static_cast<ScreensEnum>(eez_flow_get_current_screen());
        updateProfilePreview();
        effect_mgr.evaluate_all();

        if (currentScreen == SCREEN_ID_STANDBY_SCREEN) {
            if (standbyEnterTime > 0) {
                const Settings &settings = controller->getSettings();
                const unsigned long now = millis();
                if (now - standbyEnterTime >= settings.getStandbyBrightnessTimeout()) {
                    setBrightness(settings.getStandbyBrightness());
                }
            }
        }
    }

    ui_tick();
    lv_task_handler();
}

void DefaultUI::loopProfiles() {
    if (!profileLoaded) {
        // Build into locals and swap under the lock — the UI task reads these concurrently (GM-147).
        const auto favoritedIds = profileManager->getFavoritedProfiles();
        std::vector<String> ids;
        ids.reserve(favoritedIds.size() + 1);
        ids.emplace_back(controller->getSettings().getSelectedProfile());
        for (const auto &id : favoritedIds) {
            if (std::find(ids.begin(), ids.end(), id) == ids.end())
                ids.emplace_back(id);
        }
        std::vector<Profile> profiles;
        std::vector<bool> hasImage;
        profiles.reserve(ids.size());
        hasImage.reserve(ids.size());
        const std::vector<String> imageIds = controller->isSDCard() ? profileManager->listProfileImages() : std::vector<String>{};
        for (const auto &profileId : ids) {
            Profile profile{};
            profileManager->loadProfile(profileId, profile);
            profiles.emplace_back(std::move(profile));
            hasImage.push_back(std::find(imageIds.begin(), imageIds.end(), profileId) != imageIds.end());
        }
        {
            std::lock_guard<std::mutex> guard(profilesMutex);
            favoritedProfileIds = std::move(ids);
            favoritedProfiles = std::move(profiles);
            favoritedHasImage = std::move(hasImage);
            profilesGeneration++;
        }
        profileLoaded = 1;
    }
    loadRequestedImage();
}

// SD reads stay on this task: a slow or failing card must not block rendering or overflow the UI task's stack.
void DefaultUI::loadRequestedImage() {
    String wanted;
    int request;
    {
        std::lock_guard<std::mutex> guard(imageMutex);
        wanted = imageWantedId;
        request = imageRequest;
    }
    const int generation = imageGeneration;
    if (wanted.isEmpty() || (request == imageLoadedRequest && generation == imageLoadedGeneration))
        return;
    uint8_t *pixels = profileManager->loadProfileImage(wanted);
    imageLoadedRequest = request;
    imageLoadedGeneration = generation;
    if (pixels == nullptr)
        return;
    {
        std::lock_guard<std::mutex> guard(imageMutex);
        free(imagePending);
        imagePending = pixels;
        imagePendingId = wanted;
    }
    rerender = true;
}

void DefaultUI::changeScreen(ScreensEnum screen) {
    targetScreen = screen;
    brewScreenState = BrewScreenState::Brew;
    rerender = true;
    // Reset some submenus
}

void DefaultUI::changeBrewScreenMode(BrewScreenState state) {
    brewScreenState = state;
    rerender = true;
}

void DefaultUI::onProfileSwitch() {
    currentProfileIdx = 0;
    profileDetailsVisible = false;
    changeScreen(SCREEN_ID_NEW_PROFILE_SCREEN);
}

void DefaultUI::onNextProfile() {
    std::lock_guard<std::mutex> guard(profilesMutex);
    if (currentProfileIdx + 1 < static_cast<int>(favoritedProfileIds.size())) {
        currentProfileIdx++;
        profileDetailsVisible = false;
    }
    rerender = true;
}

void DefaultUI::onPreviousProfile() {
    if (currentProfileIdx > 0) {
        currentProfileIdx--;
        profileDetailsVisible = false;
    }
    rerender = true;
}

void DefaultUI::onProfileDetailToggle() {
    profileDetailsVisible = !profileDetailsVisible;
    rerender = true;
}

void DefaultUI::onProfileSelect() {
    String id;
    {
        std::lock_guard<std::mutex> guard(profilesMutex);
        if (currentProfileIdx >= 0 && currentProfileIdx < static_cast<int>(favoritedProfileIds.size())) {
            id = favoritedProfileIds[currentProfileIdx];
        }
    }
    if (!id.isEmpty()) {
        profileManager->selectProfile(id);
    }
    profileDirty = false;
    changeScreen(SCREEN_ID_BREW_SCREEN);
}

void DefaultUI::onVolumetricDelete() {
    controller->onVolumetricDelete();
    profileDirty = true;
}

void DefaultUI::setupPanel() {
    ui_init();
    gaugeSetpointsInside = controller->getSettings().isGaugeSetpointsInside();
    applyGaugeSetpointStyle(gaugeSetpointsInside);
    setupState();
    applyTheme();
    ui_tick();

    lv_obj_t *standby = lv_scr_act();
    lv_obj_t *black = lv_obj_create(nullptr);
    lv_obj_set_style_bg_color(black, lv_color_black(), LV_PART_MAIN);
    lv_obj_set_style_bg_opa(black, LV_OPA_COVER, LV_PART_MAIN);
    lv_scr_load(black);
    lv_scr_load_anim(standby, LV_SCR_LOAD_ANIM_FADE_ON, STARTUP_FADE_MS, 0, true);

    lv_task_handler();

    delay(100);
    // Set initial brightness based on settings
    const ::Settings &settings = controller->getSettings();
    setBrightness(settings.getMainBrightness());
}

void DefaultUI::setupState() {
    eez::flow::setGlobalVariable(FLOW_GLOBAL_VARIABLE_SCALE_WEIGHT_CURRENT, currentWeight);
    eez::flow::setGlobalVariable(FLOW_GLOBAL_VARIABLE_GRIND_WEIGHT_TARGET, grindWeightTarget);
    eez::flow::setGlobalVariable(FLOW_GLOBAL_VARIABLE_GRIND_TIME_TARGET, grindTimeTarget);

    eez::flow::setGlobalVariable(FLOW_GLOBAL_VARIABLE_SYSTEM, systemStatus);
    eez::flow::setGlobalVariable(FLOW_GLOBAL_VARIABLE_WARNINGS, warnings);
    eez::flow::setGlobalVariable(FLOW_GLOBAL_VARIABLE_PREVIEW_PROFILE, previewProfileInfo);
    eez::flow::setGlobalVariable(FLOW_GLOBAL_VARIABLE_SELECTED_PROFILE, selectedProfileInfo);
    eez::flow::setGlobalVariable(FLOW_GLOBAL_VARIABLE_BOILER, boiler);
    eez::flow::setGlobalVariable(FLOW_GLOBAL_VARIABLE_UI_FLAGS, uiFlags);
    eez::flow::setGlobalVariable(FLOW_GLOBAL_VARIABLE_BREW_PROCESS_INFO, brewProcess);

    updateState();
    updateSystemStatus();
    updateProfileInfo();
    updateBoiler();
    updateBrewProcess();

    effect_mgr.use_effect([this]() { return currentScreen == SCREEN_ID_INFO_SCREEN; },
                          [=]() {
                              String content = "";
                              if (apActive) {
                                  // WIFI: QR syntax — escape \ ; , : " in the password per the spec.
                                  const String pw = controller->getSettings().getWifiApPassword();
                                  String escaped;
                                  escaped.reserve(pw.length() + 4);
                                  for (size_t i = 0; i < pw.length(); i++) {
                                      const char c = pw.charAt(i);
                                      if (c == '\\' || c == ';' || c == ',' || c == ':' || c == '"') {
                                          escaped += '\\';
                                      }
                                      escaped += c;
                                  }
                                  if (escaped.isEmpty()) {
                                      content = "WIFI:S:GaggiMate;;;;";
                                  } else {
                                      content = "WIFI:S:GaggiMate;T:WPA;P:" + escaped + ";;";
                                  }
                              } else if (wifiConnected) {
                                  content = "http://" + WiFi.localIP().toString() + "/";
                              }
                              if (content == "") {
                                  return;
                              }
                              const char *data = content.c_str();
                              lv_qrcode_update(objects.qrcode, data, strlen(data));
                          },
                          &wifiConnected, &apActive);
    effect_mgr.use_effect([this]() { return currentScreen == SCREEN_ID_MENU_SCREEN_NEW; },
                          [this]() {
                              int radius = 135;
                              int count = grindAvailable ? 4 : 3;
                              int step = 360 / (grindAvailable ? 4 : 3);
                              int iconOffset = grindAvailable ? 1 : 0;
                              int rotationOffset = count == 4 ? 45 : 0;
                              positionMenuIcon(objects.btn_brew_1, step * 0 - rotationOffset, radius);
                              positionMenuIcon(objects.btn_steam_1, step * 1 - rotationOffset, radius);
                              positionMenuIcon(objects.btn_water_1, step * 2 - rotationOffset, radius);
                              positionMenuIcon(objects.btn_grind_1, step * 3 - rotationOffset, radius);
                              // positionMenuIcon(objects.btn_settings_1, step * (3 + iconOffset) - rotationOffset, radius);
                          },
                          &grindAvailable);
}

void DefaultUI::handleScreenChange() {
    if (currentScreen != targetScreen) {
        if (currentScreen == SCREEN_ID_BREW_SCREEN)
            brewConfirmVisible = false; // leaving the brew screen dismisses the confirm overlay
        if (targetScreen == SCREEN_ID_STANDBY_SCREEN) {
            standbyEnterTime = ::millis();
        } else if (currentScreen == SCREEN_ID_STANDBY_SCREEN) {
            const ::Settings &settings = controller->getSettings();
            setBrightness(settings.getMainBrightness());
        }
        eez_flow_set_screen(targetScreen, LV_SCR_LOAD_ANIM_NONE, 0, 0);
        animateGaugeTicks(isShortTickScreen(currentScreen, tickChartMode), isShortTickScreen(targetScreen, tickChartMode));
        rerender = true;
    }
}

// Collect every lv_meter under obj (the dial gauges) so their tick length can be animated together.
void DefaultUI::collectMeters(lv_obj_t *obj) {
    const uint32_t n = lv_obj_get_child_cnt(obj);
    for (uint32_t i = 0; i < n; i++) {
        lv_obj_t *child = lv_obj_get_child(obj, i);
        if (gaugeCount < 4 && lv_obj_check_type(child, &lv_meter_class)) {
            gaugeMeters[gaugeCount++] = child;
        }
        collectMeters(child);
    }
}

void DefaultUI::setGaugeTickLength(int32_t len) {
    for (uint8_t i = 0; i < gaugeCount; i++) {
        auto *meter = reinterpret_cast<lv_meter_t *>(gaugeMeters[i]);
        auto *scale = static_cast<lv_meter_scale_t *>(_lv_ll_get_head(&meter->scale_ll));
        if (scale != nullptr) {
            scale->tick_length = static_cast<uint16_t>(len);
        }
        lv_obj_invalidate(gaugeMeters[i]);
    }
}

void DefaultUI::applyGaugeSetpointStyle(bool inside) {
    initializeInsideIndicator();
    lv_obj_t *meters[] = {objects.brew_dials__temp_gauge,       objects.brew_dials__temp_gauge_full,
                          objects.brew_dials__pressure_gauge,   objects.status_dials__temp_gauge,
                          objects.status_dials__temp_gauge_full, objects.status_dials__pressure_gauge,
                          objects.new_menu_dials__temp_gauge,   objects.new_menu_dials__temp_gauge_full,
                          objects.new_menu_dials__pressure_gauge, objects.steam_dials__temp_gauge,
                          objects.steam_dials__temp_gauge_full, objects.steam_dials__pressure_gauge,
                          objects.water_dials__temp_gauge,      objects.water_dials__temp_gauge_full,
                          objects.water_dials__pressure_gauge,  objects.profile_dials_1__temp_gauge,
                          objects.profile_dials_1__temp_gauge_full, objects.profile_dials_1__pressure_gauge,
                          objects.grind_dials__temp_gauge,      objects.grind_dials__temp_gauge_full,
                          objects.grind_dials__pressure_gauge,  objects.obj2__temp_gauge,
                          objects.obj2__temp_gauge_full,        objects.obj2__pressure_gauge};
    for (lv_obj_t *meterObject : meters) {
        if (meterObject == nullptr)
            continue;
        auto *meter = reinterpret_cast<lv_meter_t *>(meterObject);
        for (auto *indicator = static_cast<lv_meter_indicator_t *>(_lv_ll_get_head(&meter->indicator_ll)); indicator != nullptr;
             indicator = static_cast<lv_meter_indicator_t *>(_lv_ll_get_next(&meter->indicator_ll, indicator))) {
            if (indicator->type == LV_METER_INDICATOR_TYPE_NEEDLE_IMG) {
                indicator->type_data.needle_img.src = inside ? &insideIndicator : &img_indicator_small;
                indicator->type_data.needle_img.pivot.x =
                    inside ? GAUGE_SETPOINT_INSIDE_PIVOT_X : GAUGE_SETPOINT_OUTSIDE_PIVOT_X;
                lv_obj_invalidate(meterObject);
            }
        }
    }
}

void DefaultUI::gaugeTickAnimCb(void *var, int32_t v) { static_cast<DefaultUI *>(var)->setGaugeTickLength(v); }

void DefaultUI::animateGaugeTicks(bool fromShort, bool toShort) {
    const int32_t fromLen = fromShort ? GAUGE_TICK_SHORT : GAUGE_TICK_LONG;
    const int32_t toLen = toShort ? GAUGE_TICK_SHORT : GAUGE_TICK_LONG;

    lv_anim_del(this, gaugeTickAnimCb); // cancel any in-flight tick animation
    gaugeCount = 0;
    collectMeters(lv_scr_act());
    if (gaugeCount == 0) {
        return;
    }
    // Start at the previous screen's length so the ticks morph continuously in both directions.
    setGaugeTickLength(fromLen);
    if (fromLen == toLen) {
        return;
    }
    lv_anim_t a;
    lv_anim_init(&a);
    lv_anim_set_var(&a, this);
    lv_anim_set_exec_cb(&a, gaugeTickAnimCb);
    lv_anim_set_values(&a, fromLen, toLen);
    lv_anim_set_time(&a, GAUGE_TICK_ANIM_MS);
    lv_anim_set_path_cb(&a, lv_anim_path_ease_out);
    lv_anim_start(&a);
}

void DefaultUI::positionMenuIcon(lv_obj_t *obj, int angle, int radius) {
    int x = sin(angle * M_PI / 180) * radius;
    int y = -1 * cos(angle * M_PI / 180) * radius;
    lv_obj_set_pos(obj, x, y);
}

void DefaultUI::updateState() {
    const auto &settings = controller->getSettings();
    if (gaugeSetpointsInside != settings.isGaugeSetpointsInside()) {
        gaugeSetpointsInside = settings.isGaugeSetpointsInside();
        applyGaugeSetpointStyle(gaugeSetpointsInside);
    }
    mode = controller->getMode();
    currentTemp = static_cast<int>(controller->getCurrentTemp());
    targetTemp = static_cast<int>(controller->getTargetTemp());
    pressureAvailable = controller->getSystemInfo().capabilities.pressure ? 1 : 0;
    wifiConnected = WiFi.status() == WL_CONNECTED;
    grindAvailable = settings.isSmartGrindActive() || settings.getAltRelayFunction() == ALT_RELAY_GRIND;
    dualBoiler = controller->getSystemInfo().capabilities.dualBoiler ? 1 : 0;

    uiFlags.brew_adjustments(brewScreenState == BrewScreenState::Settings);
    uiFlags.active(controller->isActive());
    uiFlags.grind_active(controller->isGrindActive());
    uiFlags.grind_volumetric(controller->isVolumetricAvailable() && settings.isVolumetricTarget());
    uiFlags.heating_flash(heatingFlash);
    uiFlags.temperature_stable(controller->getWarnings().isTemperatureStable());
    uiFlags.has_prev_profile(currentProfileIdx > 0);
    uiFlags.brew_confirm_visible(brewConfirmVisible);
    uiFlags.profile_details_visible(profileDetailsVisible);
    const bool chartMode = settings.getStatusDisplayMode() == STATUS_DISPLAY_CHART && pressureAvailable && isProShot();
    uiFlags.chart_mode(chartMode);
    if (chartMode != tickChartMode) {
        // Re-animate the ring when the mode flips while the status screen is open.
        if (currentScreen == SCREEN_ID_STATUS_SCREEN && currentScreen == targetScreen)
            animateGaugeTicks(!chartMode, chartMode);
        tickChartMode = chartMode;
    }
    {
        std::lock_guard<std::mutex> guard(profilesMutex);
        uiFlags.has_next_profile(currentProfileIdx + 1 < static_cast<int>(favoritedProfileIds.size()));
    }
}

// The chart needs pressure data, so it only applies to Pro profiles; prefer the running brew's profile.
bool DefaultUI::isProShot() {
    if (!initialized)
        return false;
    std::lock_guard<std::recursive_mutex> guard(controller->getProcessLock());
    Process *process = controller->getProcess();
    if (process == nullptr)
        process = controller->getLastProcess();
    if (process != nullptr && process->getType() == MODE_BREW)
        return static_cast<BrewProcess *>(process)->profile.type == "pro";
    return profileManager->getSelectedProfile().type == "pro";
}

void DefaultUI::updateSystemStatus() {
    const auto &settings = controller->getSettings();
    systemStatus.bluetooth(controller->getClientController()->isConnected());
    systemStatus.wifi(!apActive && WiFi.status() == WL_CONNECTED);
    const bool error = controller->getSystemState() != SYSTEM_READY;
    systemStatus.error(error);
    const String errorLabel = error ? getErrorMessage() : "";
    if (stringChanged(systemStatus.error_label(), errorLabel.c_str()))
        systemStatus.error_label(errorLabel.c_str());
    systemStatus.volumetric_available(controller->isVolumetricAvailable());
    systemStatus.bluetooth_scales(controller->isScaleSourceHealthy(controller->getEffectiveScaleSource()));
    systemStatus.controller_version(controller->getSystemInfo().version.c_str());
    systemStatus.display_version(BUILD_GIT_VERSION);
    systemStatus.update_available(updateAvailable);
    systemStatus.in_menu(currentScreen == SCREEN_ID_MENU_SCREEN_NEW);
    systemStatus.pressure_available(pressureAvailable);
    systemStatus.grind_available(grindAvailable);
    systemStatus.mode(mode);
    const String ip = apActive ? String("4.4.4.1") : WiFi.localIP().toString();
    if (stringChanged(systemStatus.ip(), ip.c_str()))
        systemStatus.ip(ip.c_str());
    const String network = apActive ? String("GaggiMate") : systemStatus.wifi() ? settings.getWifiSsid() : String("Disconnected");
    if (stringChanged(systemStatus.network(), network.c_str()))
        systemStatus.network(network.c_str());
    systemStatus.ap_active(apActive);

    char timeBuf[12] = "";
    struct tm timeinfo;
    if (getLocalTime(&timeinfo, 5)) {
        strftime(timeBuf, sizeof(timeBuf), settings.isClock24hFormat() ? "%H:%M" : "%I:%M %p", &timeinfo);
        if (!settings.isClock24hFormat() && timeBuf[0] == '0')
            timeBuf[0] = ' ';
    }
    if (stringChanged(systemStatus.time(), timeBuf))
        systemStatus.time(timeBuf);
}

void DefaultUI::updateWarnings() {
    const WarningManager &wm = controller->getWarnings();
    warnings.waterWarn(wm.isWarn(WARNING_WATER));
    warnings.waterError(wm.isError(WARNING_WATER));
    warnings.flushWarn(wm.isWarn(WARNING_FLUSH));
    warnings.flushError(wm.isError(WARNING_FLUSH));
    warnings.switchWarn(wm.isWarn(WARNING_SWITCH));
    warnings.switchError(wm.isError(WARNING_SWITCH));
    warnings.scaleConnectedWarn(wm.isWarn(WARNING_SCALE_CONNECTED));
    warnings.scaleConnectedError(wm.isError(WARNING_SCALE_CONNECTED));
    warnings.scaleBatteryWarn(wm.isWarn(WARNING_SCALE_BATTERY));
    warnings.scaleBatteryError(wm.isError(WARNING_SCALE_BATTERY));
    warnings.temperatureWarn(wm.isWarn(WARNING_TEMPERATURE));
    warnings.temperatureError(wm.isError(WARNING_TEMPERATURE));
    warnings.cleanWarn(wm.isWarn(WARNING_BACKFLUSH) || wm.isWarn(WARNING_DESCALING));
    warnings.cleanError(wm.isError(WARNING_BACKFLUSH) || wm.isError(WARNING_DESCALING));
    const String labels = wm.getLabels();
    if (stringChanged(warnings.labels(), labels.c_str()))
        warnings.labels(labels.c_str());
}

static void populateProfileInfo(ProfileInfoValue &info, const Profile &profile, bool isCurrent, bool hasImage) {
    char timeBuf[12];
    formatDuration(static_cast<unsigned long>(profile.getTotalDuration() * 1000.0f), timeBuf, sizeof(timeBuf));
    if (stringChanged(info.name(), profile.label.c_str()))
        info.name(profile.label.c_str());
    info.temperature(profile.temperature);
    if (stringChanged(info.time(), timeBuf))
        info.time(timeBuf);
    info.phases(static_cast<int>(profile.getPhaseCount()));
    info.steps(static_cast<int>(profile.phases.size()));
    info.is_volumetric(profile.isVolumetric());
    info.is_current(isCurrent);
    info.target_weight(profile.getTotalVolume());
    info.is_pro(profile.type == "pro");
    info.has_image(hasImage);
}

void DefaultUI::updateProfileInfo() {
    if (!initialized) {
        return;
    }
    const Profile &selected = profileManager->getSelectedProfile();
    bool populated = false;
    bool selectedHasImage = false;
    {
        std::lock_guard<std::mutex> guard(profilesMutex);
        // The profile task always puts the selected profile first.
        selectedHasImage = !favoritedProfileIds.empty() && favoritedProfileIds[0] == selected.id && favoritedHasImage[0];
        if (!favoritedProfiles.empty() && currentProfileIdx >= 0 &&
            currentProfileIdx < static_cast<int>(favoritedProfiles.size())) {
            populateProfileInfo(previewProfileInfo, favoritedProfiles[currentProfileIdx], currentProfileIdx == 0,
                                favoritedHasImage[currentProfileIdx]);
            populated = true;
        }
    }
    populateProfileInfo(selectedProfileInfo, selected, true, selectedHasImage);
    selectedProfileInfo.dirty(profileDirty);
    if (!populated) {
        populateProfileInfo(previewProfileInfo, selected, true, selectedHasImage);
    }
}

void DefaultUI::updateBoiler() {
    const ::Settings &settings = controller->getSettings();
    bool showSteamTemp = dualBoiler && currentScreen == SCREEN_ID_STEAM_SCREEN;
    boiler.current_temperature(showSteamTemp ? controller->getCurrentSteamTemp() : controller->getCurrentTemp());
    boiler.target_temperature(showSteamTemp ? controller->getTargetSteamTemp() : controller->getTargetTemp());
    boiler.current_pressure(pressure);
    boiler.target_pressure(controller->getTargetPressure());
    boiler.max_temperature(160.0f);
    boiler.max_pressure(settings.getPressureScaling());
}

// Mirror the live BrewProcess into brew_process_info; every field must stay valid/typed or the StatusScreen flow aborts.
void DefaultUI::updateBrewProcess() {
    if (!initialized) {
        return;
    }

    const Profile &selected = profileManager->getSelectedProfile();
    char buf[12];

    // Profile-derived defaults so the struct is valid even before a process runs.
    formatDuration(static_cast<unsigned long>(selected.getTotalDuration() * 1000.0f), buf, sizeof(buf));
    brewProcess.profile_temperature(selected.temperature);
    if (stringChanged(brewProcess.profile_time(), buf))
        brewProcess.profile_time(buf);
    brewProcess.profile_phases(static_cast<int>(selected.getPhaseCount()));
    brewProcess.profile_steps(static_cast<int>(selected.phases.size()));
    brewProcess.profile_is_volumetric(selected.isVolumetric());
    brewProcess.profile_is_current(true);
    brewProcess.profile_target_weight(selected.getTotalVolume());
    brewProcess.boiler_target_temperature(controller->getTargetTemp());
    brewProcess.current_flow(controller->getCurrentPumpFlow());

    // Hold the process lock across every deref below — the logic/AsyncTCP/BLE tasks delete
    // the process at any time (GM-147).
    std::lock_guard<std::recursive_mutex> guard(controller->getProcessLock());
    Process *process = controller->getProcess();
    if (process == nullptr) {
        process = controller->getLastProcess();
    }
    const bool validBrew = process != nullptr && process->getType() == MODE_BREW;
    if (!validBrew) {
        if (stringChanged(brewProcess.phase_type(), ""))
            brewProcess.phase_type("");
        if (stringChanged(brewProcess.phase_name(), ""))
            brewProcess.phase_name("");
        brewProcess.phase_value_current(0.0f);
        brewProcess.phase_value_target(0.0f);
        brewProcess.phase_value_is_weight(false);
        if (stringChanged(brewProcess.elapsed_time(), "0:00"))
            brewProcess.elapsed_time("0:00");
        brewProcess.elapsed_percentage(0.0f);
        brewProcess.is_complete(false);
        return;
    }

    auto *bp = static_cast<BrewProcess *>(process);
    if (bp->profile.phases.empty() || bp->phaseIndex >= bp->profile.phases.size()) {
        // Object is mid-mutation/invalid: keep the last valid values.
        return;
    }

    const Phase phase = bp->currentPhase;
    const bool active = process->isActive();

    // Live profile fields from the running process.
    formatDuration(bp->getTotalDuration(), buf, sizeof(buf));
    brewProcess.profile_temperature(bp->profile.temperature);
    if (stringChanged(brewProcess.profile_time(), buf))
        brewProcess.profile_time(buf);
    brewProcess.profile_phases(static_cast<int>(bp->profile.getPhaseCount()));
    brewProcess.profile_steps(static_cast<int>(bp->profile.phases.size()));
    brewProcess.profile_is_volumetric(bp->target == ProcessTarget::VOLUMETRIC);
    brewProcess.profile_target_weight(bp->getBrewVolume());
    brewProcess.boiler_target_temperature(bp->getTemperature());
    brewProcess.current_volume(bp->currentVolume);

    const char *phaseType = phase.phase == PhaseType::PHASE_TYPE_BREW ? "BREW" : "INFUSION";
    if (stringChanged(brewProcess.phase_type(), phaseType))
        brewProcess.phase_type(phaseType);

    String phaseName = "Finished";
    if (active) {
        phaseName = phase.name;
    } else if (controller->getSettings().isDelayAdjust() && !process->isComplete()) {
        phaseName = "Calibrating...";
    }
    if (stringChanged(brewProcess.phase_name(), phaseName.c_str()))
        brewProcess.phase_name(phaseName.c_str());

    unsigned long now = ::millis();
    if (!active && bp->finished > 0) {
        now = bp->finished;
    }
    const unsigned long elapsedMs = (bp->processStarted > 0 && now >= bp->processStarted) ? now - bp->processStarted : 0;
    formatDuration(elapsedMs, buf, sizeof(buf));
    if (stringChanged(brewProcess.elapsed_time(), buf))
        brewProcess.elapsed_time(buf);

    const bool weightTarget = bp->target == ProcessTarget::VOLUMETRIC && phase.hasVolumetricTarget();
    brewProcess.phase_value_is_weight(weightTarget);
    if (weightTarget) {
        float target = 0.0f;
        Target volumetricTarget = phase.getVolumetricTarget();
        if (volumetricTarget.type == TargetType::TARGET_TYPE_VOLUMETRIC) {
            target = volumetricTarget.value;
        } else if (volumetricTarget.type == TargetType::TARGET_TYPE_RATIO && bp->profile.dose > 0.0f) {
            target = volumetricTarget.value * bp->profile.dose;
        }
        const float current = static_cast<float>(bp->currentVolume);
        brewProcess.phase_value_current(current);
        brewProcess.phase_value_target(target);
        brewProcess.elapsed_percentage(target > 0.0f ? clampPercentage(current / target * 100.0f) : 0.0f);
    } else {
        const unsigned long phaseElapsed =
            (bp->currentPhaseStarted > 0 && now >= bp->currentPhaseStarted) ? now - bp->currentPhaseStarted : 0;
        const float current = phaseElapsed / 1000.0f;
        const float target = bp->getPhaseDuration() / 1000.0f;
        brewProcess.phase_value_current(current);
        brewProcess.phase_value_target(target);
        brewProcess.elapsed_percentage(target > 0.0f ? clampPercentage(current / target * 100.0f) : 0.0f);
    }

    brewProcess.is_complete(process->isComplete());
}

void DefaultUI::updateMenuScreen() {}

void DefaultUI::setupShotChart() {
    shotChart = objects.shot_chart;
    styleTrendChart(shotChart, SHOT_CHART_POINTS);
    for (int i = 0; i < SHOT_SERIES_COUNT; i++) {
        shotSeries[i] = lv_chart_add_series(shotChart, lv_color_hex(0), LV_CHART_AXIS_PRIMARY_Y);
        lv_chart_set_ext_y_array(shotChart, shotSeries[i], shotPoints[i]);
    }
    applyShotChartTheme();
    lv_obj_add_event_cb(shotChart, shotChartDrawCb, LV_EVENT_DRAW_PART_BEGIN, this);
    lv_obj_add_event_cb(shotChart, shotChartDrawCb, LV_EVENT_DRAW_PART_END, this);
    lv_obj_add_event_cb(shotChart, shotChartBackgroundCb, LV_EVENT_DRAW_MAIN_BEGIN, this);
    resetShotChart(controller->getTargetTemp(), 0.0f);
}

void DefaultUI::applyShotChartTheme() {
    if (shotChart == nullptr)
        return;
    const int theme = currentThemeMode >= 0 ? currentThemeMode : 0;
    for (int i = 0; i < SHOT_SERIES_COUNT; i++)
        lv_chart_set_series_color(shotChart, shotSeries[i], lv_color_hex(theme_colors[theme][SHOT_THEME_COLORS[i]]));
    lv_chart_refresh(shotChart);
}

void DefaultUI::resetShotChart(float targetTemperature, float targetWeight) {
    for (auto &series : shotPoints)
        for (auto &point : series)
            point = LV_CHART_POINT_NONE;
    for (auto &mark : shotPhaseMarks)
        mark = false;
    shotPhasePending = false;
    shotPointCount = 0;
    lastShotSample = 0;
    shotFlowRange = SHOT_FLOW_RANGE_DEFAULT;
    shotWeightRange = targetWeight > 0.0f ? growShotRange(10.0f, targetWeight * 1.1f, 10.0f) : SHOT_WEIGHT_RANGE_DEFAULT;
    shotTempMin = targetTemperature - SHOT_TEMP_RANGE;
    shotTempMax = targetTemperature + SHOT_TEMP_RANGE;
    lv_chart_refresh(shotChart);
}

void DefaultUI::updateShotChart() {
    if (objects.shot_chart == nullptr)
        return;
    if (objects.shot_chart != shotChart)
        setupShotChart();

    std::lock_guard<std::recursive_mutex> guard(controller->getProcessLock());
    Process *process = controller->getProcess();
    if (process == nullptr || process->getType() != MODE_BREW || !process->isActive())
        return;
    auto *bp = static_cast<BrewProcess *>(process);
    const bool volumetric = controller->isVolumetricAvailable();
    if (bp->processStarted != shotChartStarted) {
        shotChartStarted = bp->processStarted;
        resetShotChart(bp->getTemperature(), volumetric ? static_cast<float>(bp->getBrewVolume()) : 0.0f);
        shotPhaseIndex = bp->phaseIndex;
    }
    if (bp->phaseIndex != shotPhaseIndex) {
        shotPhaseIndex = bp->phaseIndex;
        shotPhasePending = true;
    }
    const unsigned long now = ::millis();
    if (lastShotSample != 0 && now - lastShotSample < SHOT_CHART_SAMPLE_INTERVAL)
        return;
    // Advance by the interval, not to now, so the coarse UI tick doesn't stretch the 30 s window.
    const bool behind = lastShotSample == 0 || now - lastShotSample >= 2 * SHOT_CHART_SAMPLE_INTERVAL;
    lastShotSample = behind ? now : lastShotSample + SHOT_CHART_SAMPLE_INTERVAL;
    addShotChartSample(volumetric ? static_cast<float>(bp->currentVolume) : -1.0f);
}

void DefaultUI::rescaleShotSeries(lv_coord_t *points, float oldRange, float newRange) {
    for (int i = 0; i < SHOT_CHART_POINTS; i++)
        if (points[i] != LV_CHART_POINT_NONE)
            points[i] = static_cast<lv_coord_t>(lroundf(points[i] * oldRange / newRange));
}

void DefaultUI::addShotChartSample(float weight) {
    const float pressure = controller->getCurrentPressure();
    const float flow = controller->getCurrentPumpFlow();
    const float targetPressure = controller->getTargetPressure();
    const float targetFlow = controller->getTargetFlow();

    const float flowRange =
        growShotRange(shotFlowRange, LV_MAX(LV_MAX(pressure, flow), LV_MAX(targetPressure, targetFlow)), 2.0f);
    if (flowRange != shotFlowRange) {
        for (int i : {SHOT_PRESSURE, SHOT_TARGET_PRESSURE, SHOT_FLOW, SHOT_TARGET_FLOW})
            rescaleShotSeries(shotPoints[i], shotFlowRange, flowRange);
        shotFlowRange = flowRange;
    }
    const float weightRange = growShotRange(shotWeightRange, weight, 10.0f);
    if (weightRange != shotWeightRange) {
        rescaleShotSeries(shotPoints[SHOT_WEIGHT], shotWeightRange, weightRange);
        shotWeightRange = weightRange;
    }

    lv_coord_t sample[SHOT_SERIES_COUNT];
    sample[SHOT_PRESSURE] = scaleShotValue(pressure, 0.0f, shotFlowRange);
    sample[SHOT_TARGET_PRESSURE] =
        targetPressure > 0.0f ? scaleShotValue(targetPressure, 0.0f, shotFlowRange) : LV_CHART_POINT_NONE;
    sample[SHOT_FLOW] = scaleShotValue(flow, 0.0f, shotFlowRange);
    sample[SHOT_TARGET_FLOW] = targetFlow > 0.0f ? scaleShotValue(targetFlow, 0.0f, shotFlowRange) : LV_CHART_POINT_NONE;
    sample[SHOT_TEMPERATURE] = scaleShotValue(controller->getCurrentTemp(), shotTempMin, shotTempMax);
    sample[SHOT_WEIGHT] = weight >= 0.0f ? scaleShotValue(weight, 0.0f, shotWeightRange) : LV_CHART_POINT_NONE;

    if (shotPointCount == SHOT_CHART_POINTS) {
        for (auto &series : shotPoints)
            memmove(series, series + 1, (SHOT_CHART_POINTS - 1) * sizeof(lv_coord_t));
        memmove(shotPhaseMarks, shotPhaseMarks + 1, (SHOT_CHART_POINTS - 1) * sizeof(bool));
        shotPointCount--;
    }
    for (int i = 0; i < SHOT_SERIES_COUNT; i++)
        shotPoints[i][shotPointCount] = sample[i];
    shotPhaseMarks[shotPointCount] = shotPhasePending;
    shotPhasePending = false;
    shotPointCount++;
    lv_chart_refresh(shotChart);
}

void DefaultUI::shotChartBackgroundCb(lv_event_t *e) {
    auto *ui = static_cast<DefaultUI *>(lv_event_get_user_data(e));
    const int theme = ui->currentThemeMode >= 0 ? ui->currentThemeMode : 0;
    drawTrendGuides(e, theme, ui->shotPhaseMarks, ui->shotPointCount, SHOT_CHART_POINTS);
}

void DefaultUI::shotChartDrawCb(lv_event_t *e) {
    auto *dsc = lv_event_get_draw_part_dsc(e);
    if (dsc == nullptr || dsc->part != LV_PART_ITEMS || dsc->line_dsc == nullptr || dsc->sub_part_ptr == nullptr)
        return;
    auto *ui = static_cast<DefaultUI *>(lv_event_get_user_data(e));
    int index = 0;
    while (index < SHOT_SERIES_COUNT && ui->shotSeries[index] != dsc->sub_part_ptr)
        index++;
    if (index == SHOT_SERIES_COUNT)
        return;

    if (lv_event_get_code(e) == LV_EVENT_DRAW_PART_BEGIN) {
        styleTrendLine(dsc->line_dsc, SHOT_IS_TARGET[index]);
        return;
    }

    if (SHOT_IS_TARGET[index] || dsc->p2 == nullptr || dsc->id != ui->shotPointCount - 2)
        return;
    lv_draw_rect_dsc_t dot;
    lv_draw_rect_dsc_init(&dot);
    dot.radius = LV_RADIUS_CIRCLE;
    dot.bg_color = dsc->line_dsc->color;
    dot.bg_opa = LV_OPA_COVER;
    const lv_area_t area = {
        static_cast<lv_coord_t>(dsc->p2->x - SHOT_DOT_RADIUS), static_cast<lv_coord_t>(dsc->p2->y - SHOT_DOT_RADIUS),
        static_cast<lv_coord_t>(dsc->p2->x + SHOT_DOT_RADIUS), static_cast<lv_coord_t>(dsc->p2->y + SHOT_DOT_RADIUS)};
    lv_draw_rect(dsc->draw_ctx, &dot, &area);
}

// Show the preview profile's image once the profile task has loaded it, and redraw the pro chart when the previewed profile
// changes.
void DefaultUI::updateProfilePreview() {
    if (currentScreen != SCREEN_ID_NEW_PROFILE_SCREEN || objects.profile_preview == nullptr)
        return;
    String id;
    bool hasImage = false;
    bool isPro = false;
    Profile profile;
    {
        std::lock_guard<std::mutex> guard(profilesMutex);
        if (currentProfileIdx < 0 || currentProfileIdx >= static_cast<int>(favoritedProfiles.size()))
            return;
        id = favoritedProfileIds[currentProfileIdx];
        hasImage = favoritedHasImage[currentProfileIdx];
        isPro = favoritedProfiles[currentProfileIdx].type == "pro";
        if (isPro && (id != profileChartId || profilesGeneration != profileChartGeneration)) {
            profile = favoritedProfiles[currentProfileIdx];
            profileChartId = id;
            profileChartGeneration = profilesGeneration;
        }
    }

    uint8_t *pixels = nullptr;
    {
        std::lock_guard<std::mutex> guard(imageMutex);
        const String wanted = hasImage ? id : String();
        if (wanted != imageWantedId) {
            imageWantedId = wanted;
            imageRequest++;
        }
        if (imagePending != nullptr && imagePendingId == imageWantedId) {
            pixels = imagePending;
            imagePending = nullptr;
        }
    }
    if (pixels != nullptr) {
        // Alternate descriptors so LVGL sees a new source; the old pixels are freed once replaced.
        imageDscIndex ^= 1;
        lv_img_dsc_t &dsc = imageDsc[imageDscIndex];
        dsc.header.always_zero = 0;
        dsc.header.cf = LV_IMG_CF_TRUE_COLOR;
        dsc.header.w = profile_image::SIZE;
        dsc.header.h = profile_image::SIZE;
        dsc.data_size = profile_image::FILE_BYTES - profile_image::HEADER_BYTES;
        dsc.data = pixels;
        lv_img_set_src(objects.profile_preview, &dsc);
        free(imageShown);
        imageShown = pixels;
        imageShownId = id;
    } else if (imageShown != nullptr && imageShownId != id) {
        lv_img_set_src(objects.profile_preview, nullptr); // don't flash the previous profile's image while loading
        free(imageShown);
        imageShown = nullptr;
        imageShownId = "";
    }

    lv_obj_t *chart = objects.profile_chart;
    if (!isPro || chart == nullptr)
        return;
    if (chart != profileChart) {
        setupProfileChart(chart);
        profileChartGeneration = -1; // re-render into the new chart
    }
    if (!profile.id.isEmpty())
        renderProfileChart(profile);
}

void DefaultUI::setupProfileChart(lv_obj_t *chart) {
    profileChart = chart;
    styleTrendChart(chart, PROFILE_CHART_POINTS);
    const int theme = currentThemeMode >= 0 ? currentThemeMode : 0;
    for (int i = 0; i < 2; i++) {
        profileSeries[i] =
            lv_chart_add_series(chart, lv_color_hex(theme_colors[theme][PROFILE_THEME_COLORS[i]]), LV_CHART_AXIS_PRIMARY_Y);
        lv_chart_set_ext_y_array(chart, profileSeries[i], profilePoints[i]);
    }
    lv_obj_add_event_cb(chart, profileChartDrawCb, LV_EVENT_DRAW_PART_BEGIN, this);
    lv_obj_add_event_cb(chart, profileChartBackgroundCb, LV_EVENT_DRAW_MAIN_BEGIN, this);
}

// Same simulation as the web UI's ExtendedProfileChart: the pump target ramps per transition, the other value is a limit.
void DefaultUI::renderProfileChart(const Profile &profile) {
    const float total = profile.getTotalDuration();
    float pressure[PROFILE_CHART_POINTS] = {};
    float flow[PROFILE_CHART_POINTS] = {};
    bool pressureTarget[PROFILE_CHART_POINTS] = {};
    bool phaseMarks[PROFILE_CHART_POINTS] = {};
    bool phasePending = false;
    int out = 0;
    float maxValue = PROFILE_CHART_MIN_RANGE;

    if (!profile.phases.empty() && total > 0.0f) {
        size_t phaseIndex = 0;
        float time = 0.0f;
        float phaseTime = 0.0f;
        float currentPressure = 0.0f;
        float currentFlow = 0.0f;
        float startPressure = 0.0f;
        float startFlow = 0.0f;
        float effectivePressure = profile.phases[0].pumpAdvanced.pressure;
        float effectiveFlow = profile.phases[0].pumpAdvanced.flow;
        while (phaseIndex < profile.phases.size() && out < PROFILE_CHART_POINTS) {
            const Phase &phase = profile.phases[phaseIndex];
            const bool simple = phase.pumpIsSimple;
            const bool isPressure = !simple && phase.pumpAdvanced.target == PumpTarget::PUMP_TARGET_PRESSURE;
            const float transition = phase.transition.duration > 0.0f ? phase.transition.duration : phase.duration;
            const float alpha = transition > 0.0f ? applyEasing(phaseTime / transition, phase.transition.type) : 1.0f;
            const float limitPressure = simple ? 0.0f : phase.pumpAdvanced.pressure;
            const float limitFlow = simple ? 0.0f : phase.pumpAdvanced.flow;
            currentFlow = !simple && !isPressure ? startFlow + (effectiveFlow - startFlow) * alpha : limitFlow;
            currentPressure = isPressure ? startPressure + (effectivePressure - startPressure) * alpha : limitPressure;
            while (out < PROFILE_CHART_POINTS && time >= total * out / (PROFILE_CHART_POINTS - 1)) {
                pressure[out] = LV_MAX(currentPressure, 0.0f);
                flow[out] = LV_MAX(currentFlow, 0.0f);
                pressureTarget[out] = isPressure;
                phaseMarks[out] = phasePending;
                phasePending = false;
                maxValue = LV_MAX(maxValue, LV_MAX(pressure[out], flow[out]));
                out++;
            }
            time += PROFILE_CHART_STEP;
            phaseTime += PROFILE_CHART_STEP;
            if (phaseTime >= phase.duration) {
                phaseTime = 0.0f;
                if (++phaseIndex < profile.phases.size()) {
                    phasePending = true;
                    startFlow = currentFlow;
                    startPressure = currentPressure;
                    const PumpAdvanced &next = profile.phases[phaseIndex].pumpAdvanced;
                    effectiveFlow = next.flow == -1 ? currentFlow : next.flow;
                    effectivePressure = next.pressure == -1 ? currentPressure : next.pressure;
                }
            }
        }
    }

    const float range = growShotRange(PROFILE_CHART_MIN_RANGE, maxValue * 1.1f, 2.0f);
    for (int i = 0; i < PROFILE_CHART_POINTS; i++) {
        const bool valid = i < out;
        const bool lastValid = out > 0 && i >= out;
        const int src = lastValid ? out - 1 : i;
        profilePoints[0][i] = valid || lastValid ? scaleShotValue(pressure[src], 0.0f, range) : LV_CHART_POINT_NONE;
        profilePoints[1][i] = valid || lastValid ? scaleShotValue(flow[src], 0.0f, range) : LV_CHART_POINT_NONE;
        profilePointIsTarget[0][i] = pressureTarget[src];
        profilePointIsTarget[1][i] = !pressureTarget[src];
        profilePhaseMarks[i] = valid && phaseMarks[i];
    }
    lv_chart_refresh(profileChart);
}

// The controlled value draws solid, the limit dashed (as in the web UI).
void DefaultUI::profileChartDrawCb(lv_event_t *e) {
    auto *dsc = lv_event_get_draw_part_dsc(e);
    if (dsc == nullptr || dsc->part != LV_PART_ITEMS || dsc->line_dsc == nullptr || dsc->sub_part_ptr == nullptr)
        return;
    auto *ui = static_cast<DefaultUI *>(lv_event_get_user_data(e));
    const int series = ui->profileSeries[0] == dsc->sub_part_ptr ? 0 : ui->profileSeries[1] == dsc->sub_part_ptr ? 1 : -1;
    if (series < 0 || dsc->id >= PROFILE_CHART_POINTS)
        return;
    styleTrendLine(dsc->line_dsc, !ui->profilePointIsTarget[series][dsc->id]);
}

void DefaultUI::profileChartBackgroundCb(lv_event_t *e) {
    auto *ui = static_cast<DefaultUI *>(lv_event_get_user_data(e));
    const int theme = ui->currentThemeMode >= 0 ? ui->currentThemeMode : 0;
    drawTrendGuides(e, theme, ui->profilePhaseMarks, PROFILE_CHART_POINTS, PROFILE_CHART_POINTS);
}

String DefaultUI::getErrorMessage() { return controller->getSystemStateMessage(); }

void DefaultUI::applyTheme() {
    const ::Settings &settings = controller->getSettings();
    int newThemeMode = settings.getThemeMode();
#ifndef GAGGIMATE_SIM // Amoled-specific black theme override is device-only
    if (newThemeMode == 0 && panelDriver == AmoledDisplayDriver::getInstance()) {
        newThemeMode = THEME_ID_AMOLED_DARK;
    }
#endif

    if (newThemeMode != currentThemeMode) {
        currentThemeMode = newThemeMode;
        // Via EEZ so its selected index updates too; on-demand screens (new profile) read it when created.
        static const char *const THEME_NAMES[] = {"Dark", "Light", "AmoledDark"};
        eez_flow_set_theme(THEME_NAMES[currentThemeMode]);
        applyShotChartTheme();
        if (profileChart != nullptr) {
            for (int i = 0; i < 2; i++)
                lv_chart_set_series_color(profileChart, profileSeries[i],
                                          lv_color_hex(theme_colors[currentThemeMode][PROFILE_THEME_COLORS[i]]));
            lv_chart_refresh(profileChart);
        }
    }
}

void DefaultUI::loopTask(void *arg) {
    auto *ui = static_cast<DefaultUI *>(arg);
    while (true) {
        ui->loop();
        vTaskDelay(25 / portTICK_PERIOD_MS);
    }
}

void DefaultUI::profileLoopTask(void *arg) {
    auto *ui = static_cast<DefaultUI *>(arg);
    while (true) {
        ui->loopProfiles();
        vTaskDelay(25 / portTICK_PERIOD_MS);
    }
}
