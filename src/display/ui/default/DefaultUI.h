#ifndef DEFAULTUI_H
#define DEFAULTUI_H

#include <display/core/PluginManager.h>
#include <display/core/ProfileManager.h>
#include <display/core/constants.h>
#include <display/drivers/Driver.h>
#include <display/models/profile.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>

#include "./lvgl/ui.h"

class Controller;

constexpr int RERENDER_INTERVAL_IDLE = 2500;
constexpr int RERENDER_INTERVAL_ACTIVE = 100;

constexpr int TEMP_HISTORY_INTERVAL = 250;
constexpr int TEMP_HISTORY_LENGTH = 20 * 1000 / TEMP_HISTORY_INTERVAL;

constexpr int UI_COMMAND_QUEUE_SIZE = 16;

int16_t calculate_angle(int set_temp, int range, int offset);

// UI Command types for thread-safe communication
enum class UICommandType {
    CHANGE_SCREEN,
    SET_VARIABLE_INT,
    SET_VARIABLE_FLOAT,
    SET_VARIABLE_DOUBLE,
    SET_VARIABLE_BOOL,
    SET_VARIABLE_STRING,
    TRIGGER_RERENDER
};

struct UICommand {
    UICommandType type;
    union {
        struct {
            lv_obj_t **screen;
            void (*init_func)(void);
        } changeScreen;
        struct {
            void *target;
            int value;
        } setInt;
        struct {
            void *target;
            float value;
        } setFloat;
        struct {
            void *target;
            double value;
        } setDouble;
        struct {
            void *target;
            bool value;
        } setBool;
        struct {
            void *target;
            char value[64]; // Max string length
        } setString;
    } data;
};

class DefaultUI {
  public:
    DefaultUI(Controller *controller, PluginManager *pluginManager);

    // Default work methods
    void init();
    void loop();
    void loopProfiles();

    // Thread-safe interface methods
    void enqueueChangeScreen(lv_obj_t **screen, void (*target_init)(void));
    void enqueueSetInt(void *target, int value);
    void enqueueSetFloat(void *target, float value);
    void enqueueSetDouble(void *target, double value);
    void enqueueSetBool(void *target, bool value);
    void enqueueSetString(void *target, const String &value);
    void enqueueTriggerRerender();

    // Legacy interface (deprecated, use enqueue methods)
    void changeScreen(lv_obj_t **screen, void (*target_init)(void));

    void onProfileSwitch();
    void onNextProfile();
    void onPreviousProfile();
    void onProfileSelect();
    void setBrightness(int brightness) {
        if (panelDriver) {
            panelDriver->setBrightness(brightness);
        }
    };

    void markDirty() { enqueueTriggerRerender(); }

    void applyTheme();

  private:
    void setupPanel();
    void setupState();
    void setupReactive();

    // Command processing
    void processUICommands();
    bool enqueueCommand(const UICommand &cmd);

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
    bool isTemperatureStable = false;
    unsigned long lastTempLog = 0;

    void updateTempHistory();
    void updateTempStableFlag();
    void adjustHeatingIndicator(lv_obj_t *contentPanel);

    Driver *panelDriver = nullptr;
    Controller *controller;
    PluginManager *pluginManager;
    ProfileManager *profileManager;

    // UI Command Queue
    QueueHandle_t uiCommandQueue;

    // Screen state
    String selectedProfileId = "";
    Profile selectedProfile{};
    bool updateAvailable = false;
    bool updateActive = false;
    bool apActive = false;
    bool error = false;
    bool autotuning = false;
    bool volumetricAvailable = false;
    bool volumetricMode = false;
    bool grindActive = false;
    bool active = false;

    bool rerender = false;
    unsigned long lastRender = 0;

    int mode = MODE_STANDBY;
    int currentTemp = 0;
    int targetTemp = 0;
    int targetDuration = 0;
    int targetVolume = 0;
    int grindDuration = 0;
    float grindVolume = 0.0f;
    bool pressureAvailable = false;
    float pressure = 0.0f;
    int pressureScaling = DEFAULT_PRESSURE_SCALING;
    bool heatingFlash = false;

    int currentProfileIdx;
    String currentProfileId = "";
    bool profileLoaded = false;
    Profile currentProfileChoice{};
    std::vector<String> favoritedProfiles;
    int currentThemeMode = -1; // Force applyTheme on first loop

    // Screen change
    lv_obj_t **targetScreen = &ui_InitScreen;
    lv_obj_t *currentScreen = ui_InitScreen;
    void (*targetScreenInit)(void) = &ui_InitScreen_screen_init;

    // Standby brightness control
    unsigned long standbyEnterTime = 0;

    xTaskHandle taskHandle;
    static void loopTask(void *arg);
    xTaskHandle profileTaskHandle;
    static void profileLoopTask(void *arg);
};

#endif // DEFAULTUI_H
