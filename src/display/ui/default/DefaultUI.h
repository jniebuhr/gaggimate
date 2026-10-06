#ifndef DEFAULTUI_H
#define DEFAULTUI_H

#include <atomic>
#include <display/core/PluginManager.h>
#include <display/core/ProfileManager.h>
#include <display/core/constants.h>
#include <display/drivers/Driver.h>
#include <display/models/profile.h>
#include <display/ui/default/eez/screens.h>
#include <display/ui/default/eez/structs.h>
#include <mutex>

class Controller;

constexpr int RERENDER_INTERVAL_IDLE = 2500;
constexpr int RERENDER_INTERVAL_ACTIVE = 100;

constexpr int TEMP_HISTORY_INTERVAL = 250;

constexpr int SHOT_CHART_POINTS = 120;                    // 30 s window; older samples slide out to the left
constexpr unsigned long SHOT_CHART_SAMPLE_INTERVAL = 250; // ms per point
constexpr int PROFILE_CHART_POINTS = 100;                 // pro profile preview chart resolution

enum ShotChartSeries {
    SHOT_PRESSURE,
    SHOT_TARGET_PRESSURE,
    SHOT_FLOW,
    SHOT_TARGET_FLOW,
    SHOT_TEMPERATURE,
    SHOT_WEIGHT,
    SHOT_SERIES_COUNT
};

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
    void changeScreen(ScreensEnum screen);

    void changeBrewScreenMode(BrewScreenState state);
    void onProfileSwitch();
    void onNextProfile();
    void onPreviousProfile();
    void onProfileSelect();
    void onProfileDetailToggle();
    void setBrightness(int brightness) {
        if (panelDriver) {
            panelDriver->setBrightness(brightness);
        }
    };

    void onVolumetricDelete();
    // Flush started from the touch start button; loop() releases it once the pointer lifts (GM-201).
    void onTouchFlushStart() { touchFlushHeld = true; }

    // Brew confirmation overlay, shown when the controller asks to confirm a brew start.
    void setBrewConfirmVisible(bool visible) {
        brewConfirmVisible = visible;
        rerender = true;
    }

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

    void handleScreenChange();

    // Animate the dial meters' tick length (short on profile/menu/info and chart-mode status, long elsewhere).
    void animateGaugeTicks(bool fromShort, bool toShort);
    void collectMeters(lv_obj_t *obj);
    void setGaugeTickLength(int32_t len);
    static void gaugeTickAnimCb(void *var, int32_t v);
    lv_obj_t *gaugeMeters[4] = {nullptr};
    bool tickChartMode = false; // chart mode the ring ticks currently reflect
    uint8_t gaugeCount = 0;
    void positionMenuIcon(lv_obj_t *obj, int angle, int radius);

    void updateState();
    bool isProShot();
    void updateSystemStatus();
    void updateWarnings();
    void updateProfileInfo();
    void updateBoiler();
    void updateBrewProcess();
    void updateMenuScreen();

    // Live shot chart on the status screen (GM-254)
    void setupShotChart();
    void applyShotChartTheme();
    void resetShotChart(float targetTemperature, float targetWeight);
    void updateShotChart();
    void addShotChartSample(float weight);
    static void rescaleShotSeries(lv_coord_t *points, float oldRange, float newRange);
    static void shotChartDrawCb(lv_event_t *e);
    static void shotChartBackgroundCb(lv_event_t *e);
    lv_obj_t *shotChart = nullptr;
    lv_chart_series_t *shotSeries[SHOT_SERIES_COUNT] = {};
    lv_coord_t shotPoints[SHOT_SERIES_COUNT][SHOT_CHART_POINTS] = {};
    uint16_t shotPointCount = 0;
    bool shotPhaseMarks[SHOT_CHART_POINTS] = {}; // true where a new phase starts
    size_t shotPhaseIndex = 0;
    bool shotPhasePending = false;
    float shotFlowRange = 0.0f; // shared by pressure (bar) and flow (ml/s)
    float shotWeightRange = 0.0f;
    float shotTempMin = 0.0f;
    float shotTempMax = 0.0f;
    unsigned long lastShotSample = 0;
    unsigned long shotChartStarted = 0;

    // Profile preview: SD card image and pro profile chart on the new profile screen
    void updateProfilePreview();
    void setupProfileChart(lv_obj_t *chart);
    void renderProfileChart(const Profile &profile);
    static void profileChartDrawCb(lv_event_t *e);
    static void profileChartBackgroundCb(lv_event_t *e);
    lv_obj_t *profileChart = nullptr;
    lv_chart_series_t *profileSeries[2] = {};
    lv_coord_t profilePoints[2][PROFILE_CHART_POINTS] = {};
    bool profilePointIsTarget[2][PROFILE_CHART_POINTS] = {};
    bool profilePhaseMarks[PROFILE_CHART_POINTS] = {}; // true where a new phase starts
    String profileChartId;
    int profileChartGeneration = -1;
    bool profileDetailsVisible = false;

    // Profile image: the UI task asks for an id, the profile task loads it from SD into PSRAM and hands it over.
    void loadRequestedImage();
    std::mutex imageMutex;
    String imageWantedId;            // UI → loader
    int imageRequest = 0;            // bumped whenever imageWantedId changes
    uint8_t *imagePending = nullptr; // loader → UI
    String imagePendingId;
    std::atomic<int> imageGeneration{0}; // bumped when an image is uploaded or removed
    int imageLoadedRequest = -1;         // loader-only
    int imageLoadedGeneration = -1;
    lv_img_dsc_t imageDsc[2] = {};
    uint8_t imageDscIndex = 0;
    uint8_t *imageShown = nullptr; // UI-only
    String imageShownId;
    String getErrorMessage();

    void adjustDials(lv_obj_t *dials);
    void adjustTarget(lv_obj_t *obj, double percentage, double start, double range) const;

    unsigned long lastTempLog = 0;
    int heatingFlashTick = 0;
    void reloadProfiles();

    Driver *panelDriver = nullptr;
    Controller *controller;
    PluginManager *pluginManager;
    ProfileManager *profileManager;

    // Screen state
    int updateAvailable = false;
    int apActive = false;
    int wifiConnected = false;
    int waitingForController = false;
    int dualBoiler = false;
    int initialized = false;
    int grindAvailable = false;

    // Seasonal flags
    int christmasMode = false;

    bool rerender = false;
    bool touchFlushHeld = false;
    unsigned long lastRender = 0;

    int mode = MODE_STANDBY;
    bool pressureAvailable = false;
    int heatingFlash = 0;
    float pressure = 0.0f;
    float currentTemp = 0.0f;
    float currentSteamTemp = 0.0f;
    float targetTemp = 0.0f;
    float targetSteamTemp = 0.0f;
    double activeWeight = 0.0;
    BrewScreenState brewScreenState = BrewScreenState::Brew;

    // EEZ Structs
    SystemStatusValue systemStatus;
    ProfileInfoValue selectedProfileInfo;
    ProfileInfoValue previewProfileInfo;
    BoilerValue boiler;
    UIFlagsValue uiFlags;
    BrewProcessValue brewProcess;
    WarningsValue warnings;
    bool brewConfirmVisible = false;
    Value currentWeight = FloatValue(0.0);
    Value steamReady = BooleanValue(false);
    Value grindWeightTarget = FloatValue(18.0);
    Value grindTimeTarget = StringValue("0:15");

    int profileDirty = 0;
    int currentProfileIdx = 0;
    std::atomic<int> profileLoaded{0}; // cleared from event callbacks on arbitrary tasks
    // The profile task (core 0) rebuilds these while the UI task reads them (GM-147).
    std::mutex profilesMutex;
    std::vector<String> favoritedProfileIds;
    std::vector<Profile> favoritedProfiles;
    std::vector<bool> favoritedHasImage;
    int profilesGeneration = 0; // bumped on every reload so previews re-render
    int currentThemeMode = -1;  // Force applyTheme on first loop

    // Screen change
    ScreensEnum targetScreen = ScreensEnum::SCREEN_ID_STANDBY_SCREEN;
    ScreensEnum currentScreen = ScreensEnum::SCREEN_ID_STANDBY_SCREEN;

    // Standby brightness control
    unsigned long standbyEnterTime = 0;

    xTaskHandle taskHandle;
    static void loopTask(void *arg);
    xTaskHandle profileTaskHandle;
    static void profileLoopTask(void *arg);
};

#endif // DEFAULTUI_H
