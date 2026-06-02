#ifndef DEFAULTUI_H
#define DEFAULTUI_H

#include <display/core/PluginManager.h>
#include <display/core/ProfileManager.h>
#include <display/core/constants.h>
#include <display/drivers/Driver.h>
#include <display/models/profile.h>

#include "./lvgl/ui.h"

class Controller;

constexpr int RERENDER_INTERVAL_IDLE = 2500;
constexpr int RERENDER_INTERVAL_ACTIVE = 100;

constexpr int TEMP_HISTORY_INTERVAL = 250;
constexpr int TEMP_HISTORY_LENGTH = 20 * 1000 / TEMP_HISTORY_INTERVAL;

int16_t calculate_angle(int set_temp, int range, int offset);

enum class BrewScreenState { Brew, Settings };

class DefaultUI {
  public:
    DefaultUI(Controller *controller, Driver *driver, PluginManager *pluginManager);

    // Default work methods
    void init();
    void loop();
    void loopProfiles();

    // Interface methods
    void changeScreen(lv_obj_t **screen, void (*target_init)(void));

    void changeBrewScreenMode(BrewScreenState state);
    void onProfileSwitch();
    void onNextProfile();
    void onPreviousProfile();
    void onProfileSelect();
    void setBrightness(int brightness) {
        if (panelDriver) {
            panelDriver->setBrightness(brightness);
        }
    };

    void onVolumetricDelete();

    void markDirty() { rerender = true; }
    void markProfileDirty() { profileDirty = true; }
    void markProfileClean() { profileDirty = false; }

    void applyTheme();

    bool isTaskHealthy() const {
        return is_task_healthy(eTaskGetState(taskHandle)) && is_task_healthy(eTaskGetState(profileTaskHandle));
    }

  private:
    void setupPanel();
    void setupState();
    void setupReactive();

    void handleScreenChange();

    void updateStandbyScreen();
    void updateStatusScreen() const;

    void adjustDials(lv_obj_t *dials);
    void adjustTempTarget(lv_obj_t *dials);
    void adjustTarget(lv_obj_t *obj, double percentage, double start, double range) const;

    int tempHistory[TEMP_HISTORY_LENGTH] = {0};
    int tempHistoryIndex = 0;
    int prevTargetTemp = 0;
    bool isTempHistoryInitialized = false;
    int isTemperatureStable = false;
    unsigned long lastTempLog = 0;

    void updateTempHistory();
    void updateTempStableFlag();
    void adjustHeatingIndicator(lv_obj_t *contentPanel);
    void reloadProfiles();

    Driver *panelDriver = nullptr;
    Controller *controller;
    PluginManager *pluginManager;
    ProfileManager *profileManager;

    // Screen state
    String selectedProfileId = "";
    Profile selectedProfile{};
    int updateAvailable = false;
    int updateActive = false;
    int apActive = false;
    int error = false;
    int protocolMismatch = false;
    int autotuning = false;
    int waitingForController = false;
    int volumetricAvailable = false;
    int bluetoothScales = false;
    int volumetricMode = false;
    int brewVolumetric = false;
    int profileVolumetric = false;
    int grindActive = false;
    int active = false;
    int smartGrindActive = false;
    int grindAvailable = false;
    int initialized = false;

    // Seasonal flags
    int christmasMode = false;

    bool rerender = false;
    unsigned long lastRender = 0;

    int mode = MODE_STANDBY;
    int currentTemp = 0;
    int targetTemp = 0;
    float targetDuration = 0;
    float targetVolume = 0;
    int grindDuration = 0;
    float grindVolume = 0.0f;
    int pressureAvailable = 0;
    float pressure = 0.0f;
    int pressureScaling = DEFAULT_PRESSURE_SCALING;
    int heatingFlash = 0;
    double bluetoothWeight = 0.0;
    BrewScreenState brewScreenState = BrewScreenState::Brew;

    int profileDirty = 0;
    int currentProfileIdx;
    int profileLoaded = 0;
    std::vector<String> favoritedProfileIds;
    std::vector<Profile> favoritedProfiles;

    // Incremental cache mutations. Used by the four `profiles:profile:*`
    // event handlers to avoid re-reading every favorited profile from
    // SPIFFS on each profile change. Previously every select/favorite/
    // unfavorite/save called reloadProfiles() which set profileLoaded=0
    // and the profileLoopTask then re-read ALL favorited profiles — O(N)
    // SPIFFS opens per change. With many favorites (e.g. 50+ after a
    // bulk import) that is 1.5-4 seconds of contention per change.
    // These methods touch only the affected entry.
    void onProfileSelected(const String &id);
    void onProfileFavorited(const String &id);
    void onProfileUnfavorited(const String &id);
    void onProfileSaved(const String &id);

    // Lazy-load helpers. `favoritedProfiles` is a parallel vector to
    // `favoritedProfileIds`, but only entries within a small window around
    // `currentProfileIdx` are populated — others stay default-constructed
    // (no String/vector heap allocations). Caps internal-heap usage at
    // ~3 × sizeof(Profile-with-phases) regardless of favorite count.
    // The 50+-profile import that previously starved the WiFi/BLE coex
    // allocator at boot now fits comfortably.
    static constexpr int PROFILE_CACHE_RADIUS = 1;
    void ensureProfileLoaded(int idx);
    void evictProfilesOutsideWindow(int center, int radius);
    int currentThemeMode = -1; // Force applyTheme on first loop

    // Screen change
    lv_obj_t **targetScreen = &ui_StandbyScreen;
    lv_obj_t *currentScreen = ui_StandbyScreen;
    void (*targetScreenInit)(void) = &ui_StandbyScreen_screen_init;

    // Standby brightness control
    unsigned long standbyEnterTime = 0;

    xTaskHandle taskHandle;
    static void loopTask(void *arg);
    xTaskHandle profileTaskHandle;
    static void profileLoopTask(void *arg);
};

#endif // DEFAULTUI_H
