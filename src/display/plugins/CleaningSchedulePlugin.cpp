#include "CleaningSchedulePlugin.h"
#include <display/core/Controller.h>
#include <display/core/Event.h>
#include <display/core/ProfileManager.h>
#include <display/core/constants.h>
#include <display/core/utils.h>
#include <time.h>

// Static profile ID constants
const String CleaningSchedulePlugin::BACKFLUSH_PROFILE_ID = "flush";
const String CleaningSchedulePlugin::DESCALING_PROFILE_ID = "descaling_cleaning";

void CleaningSchedulePlugin::setup(Controller *controller, PluginManager *pluginManager) {
    this->controller = controller;
    this->pluginManager = pluginManager;
    
    ESP_LOGI("CleaningSchedulePlugin", "Setting up cleaning schedule plugin");
    
    // Ensure cleaning profiles exist
    ensureCleaningProfilesExist();
    
    // Set up event listeners for when cleaning is triggered
    pluginManager->on("cleaning:backflush:start", [this](Event const &) {
        startBackflush();
    });
    
    pluginManager->on("cleaning:descaling:start", [this](Event const &) {
        startDescaling();
    });
    
    pluginManager->on("cleaning:backflush:reset", [this](Event const &) {
        resetBackflushTimer();
    });
    
    pluginManager->on("cleaning:descaling:reset", [this](Event const &) {
        resetDescalingTimer();
    });
    
    // Listen for process completion to auto-reset cleaning timers
    pluginManager->on("controller:process:end", [this](Event const &) {
        checkAndResetCleaningTimers();
    });
    
    // Initialize check time
    lastCheckTime = millis();
}

void CleaningSchedulePlugin::loop() {
    unsigned long currentTime = millis();
    
    // Check cleaning status periodically
    if (currentTime - lastCheckTime >= CHECK_INTERVAL) {
        lastCheckTime = currentTime;
        triggerNotificationEvents();
    }
}

void CleaningSchedulePlugin::startBackflush() {
    ESP_LOGI("CleaningSchedulePlugin", "Starting backflush procedure");
    
    // Load the backflush profile and switch to brew mode
    loadCleaningProfile(BACKFLUSH_PROFILE_ID);
}

void CleaningSchedulePlugin::startDescaling() {
    ESP_LOGI("CleaningSchedulePlugin", "Starting descaling procedure");
    
    // Load the descaling profile and switch to brew mode
    loadCleaningProfile(DESCALING_PROFILE_ID);
}

void CleaningSchedulePlugin::resetBackflushTimer() {
    Settings &settings = controller->getSettings();
    settings.setLastBackflushTime(getCurrentTimeSeconds());
    ESP_LOGI("CleaningSchedulePlugin", "Backflush timer reset");
    
    // Trigger event to update UI
    pluginManager->trigger("cleaning:backflush:timer:reset");
}

void CleaningSchedulePlugin::resetDescalingTimer() {
    Settings &settings = controller->getSettings();
    settings.setLastDescalingTime(getCurrentTimeSeconds());
    ESP_LOGI("CleaningSchedulePlugin", "Descaling timer reset");
    
    // Trigger event to update UI
    pluginManager->trigger("cleaning:descaling:timer:reset");
}

bool CleaningSchedulePlugin::isBackflushDue() const {
    const Settings &settings = controller->getSettings();
    int intervalDays = settings.getBackflushIntervalDays();
    unsigned long lastBackflushTime = settings.getLastBackflushTime();
    
    if (lastBackflushTime == 0) {
        return false; // Never performed, not due yet
    }
    
    unsigned long currentTime = getCurrentTimeSeconds();
    unsigned long daysSince = (currentTime - lastBackflushTime) / (24 * 60 * 60);
    
    return daysSince >= intervalDays;
}

bool CleaningSchedulePlugin::isDescalingDue() const {
    const Settings &settings = controller->getSettings();
    int intervalWeeks = settings.getDescalingIntervalWeeks();
    unsigned long lastDescalingTime = settings.getLastDescalingTime();
    
    if (lastDescalingTime == 0) {
        return false; // Never performed, not due yet
    }
    
    unsigned long currentTime = getCurrentTimeSeconds();
    unsigned long weeksSince = (currentTime - lastDescalingTime) / (7 * 24 * 60 * 60);
    
    return weeksSince >= intervalWeeks;
}

int CleaningSchedulePlugin::getDaysSinceLastBackflush() const {
    const Settings &settings = controller->getSettings();
    unsigned long lastBackflushTime = settings.getLastBackflushTime();
    
    if (lastBackflushTime == 0) {
        return -1; // Never performed
    }
    
    unsigned long currentTime = getCurrentTimeSeconds();
    return (currentTime - lastBackflushTime) / (24 * 60 * 60);
}

int CleaningSchedulePlugin::getWeeksSinceLastDescaling() const {
    const Settings &settings = controller->getSettings();
    unsigned long lastDescalingTime = settings.getLastDescalingTime();
    
    if (lastDescalingTime == 0) {
        return -1; // Never performed
    }
    
    unsigned long currentTime = getCurrentTimeSeconds();
    return (currentTime - lastDescalingTime) / (7 * 24 * 60 * 60);
}

Profile CleaningSchedulePlugin::createBackflushProfile() const {
    Profile profile{};
    profile.id = BACKFLUSH_PROFILE_ID;
    profile.label = "[Utility] Backflush";
    profile.utility = true;
    profile.description = "";
    profile.temperature = 93;
    profile.type = "standard";
    
    // Phase 1: Pressurize (10 seconds)
    Phase phase1{};
    phase1.name = "Pressurize";
    phase1.phase = PhaseType::PHASE_TYPE_BREW;
    phase1.valve = 1;
    phase1.duration = 10.0f;
    phase1.pumpIsSimple = true;
    phase1.pumpSimple = 100;
    profile.phases.push_back(phase1);
    
    // Phase 2: Depressurize (10 seconds)
    Phase phase2{};
    phase2.name = "Depressurize";
    phase2.phase = PhaseType::PHASE_TYPE_BREW;
    phase2.valve = 0;
    phase2.duration = 10.0f;
    phase2.pumpIsSimple = true;
    phase2.pumpSimple = 0;
    profile.phases.push_back(phase2);
    
    // Phase 3: Pressurize (10 seconds)
    Phase phase3{};
    phase3.name = "Pressurize";
    phase3.phase = PhaseType::PHASE_TYPE_BREW;
    phase3.valve = 1;
    phase3.duration = 10.0f;
    phase3.pumpIsSimple = true;
    phase3.pumpSimple = 100;
    profile.phases.push_back(phase3);
    
    // Phase 4: Depressurize (10 seconds)
    Phase phase4{};
    phase4.name = "Depressurize";
    phase4.phase = PhaseType::PHASE_TYPE_BREW;
    phase4.valve = 0;
    phase4.duration = 10.0f;
    phase4.pumpIsSimple = true;
    phase4.pumpSimple = 0;
    profile.phases.push_back(phase4);
    
    // Phase 5: Pressurize (10 seconds)
    Phase phase5{};
    phase5.name = "Pressurize";
    phase5.phase = PhaseType::PHASE_TYPE_BREW;
    phase5.valve = 1;
    phase5.duration = 10.0f;
    phase5.pumpIsSimple = true;
    phase5.pumpSimple = 100;
    profile.phases.push_back(phase5);
    
    // Phase 6: Depressurize (10 seconds)
    Phase phase6{};
    phase6.name = "Depressurize";
    phase6.phase = PhaseType::PHASE_TYPE_BREW;
    phase6.valve = 0;
    phase6.duration = 10.0f;
    phase6.pumpIsSimple = true;
    phase6.pumpSimple = 0;
    profile.phases.push_back(phase6);
    
    // Phase 7: Pressurize (10 seconds)
    Phase phase7{};
    phase7.name = "Pressurize";
    phase7.phase = PhaseType::PHASE_TYPE_BREW;
    phase7.valve = 1;
    phase7.duration = 10.0f;
    phase7.pumpIsSimple = true;
    phase7.pumpSimple = 100;
    profile.phases.push_back(phase7);
    
    // Phase 8: Depressurize (10 seconds)
    Phase phase8{};
    phase8.name = "Depressurize";
    phase8.phase = PhaseType::PHASE_TYPE_BREW;
    phase8.valve = 0;
    phase8.duration = 10.0f;
    phase8.pumpIsSimple = true;
    phase8.pumpSimple = 0;
    profile.phases.push_back(phase8);
    
    // Phase 9: Pressurize (10 seconds)
    Phase phase9{};
    phase9.name = "Pressurize";
    phase9.phase = PhaseType::PHASE_TYPE_BREW;
    phase9.valve = 1;
    phase9.duration = 10.0f;
    phase9.pumpIsSimple = true;
    phase9.pumpSimple = 100;
    profile.phases.push_back(phase9);
    
    return profile;
}

Profile CleaningSchedulePlugin::createDescalingProfile() const {
    Profile profile{};
    profile.id = DESCALING_PROFILE_ID;
    profile.label = "[Utility] Descale";
    profile.utility = true;
    profile.description = "";
    profile.temperature = 0;
    profile.type = "pro";
    
    // Phase 1: 300ml Steam Flush
    Phase phase1{};
    phase1.name = "300ml Steam Flush";
    phase1.phase = PhaseType::PHASE_TYPE_BREW;
    phase1.valve = 0;
    phase1.duration = 40.0f;
    phase1.temperature = 0.0f;
    phase1.transition.type = TransitionType::INSTANT;
    phase1.transition.duration = 0.0f;
    phase1.transition.adaptive = false;
    phase1.pumpIsSimple = true;
    phase1.pumpSimple = 100;
    
    Target target1{};
    target1.type = TargetType::TARGET_TYPE_PUMPED;
    target1.operator_ = TargetOperator::GTE;
    target1.value = 300.0f;
    phase1.targets.push_back(target1);
    profile.phases.push_back(phase1);
    
    // Phase 2: Wait
    Phase phase2{};
    phase2.name = "Wait";
    phase2.phase = PhaseType::PHASE_TYPE_PREINFUSION;
    phase2.valve = 0;
    phase2.duration = 600.0f;
    phase2.temperature = 0.0f;
    phase2.transition.type = TransitionType::INSTANT;
    phase2.transition.duration = 0.0f;
    phase2.transition.adaptive = false;
    phase2.pumpIsSimple = true;
    phase2.pumpSimple = 0;
    profile.phases.push_back(phase2);
    
    // Phase 3: 300ml Steam Flush
    Phase phase3{};
    phase3.name = "300ml Steam Flush";
    phase3.phase = PhaseType::PHASE_TYPE_BREW;
    phase3.valve = 0;
    phase3.duration = 40.0f;
    phase3.temperature = 0.0f;
    phase3.transition.type = TransitionType::INSTANT;
    phase3.transition.duration = 0.0f;
    phase3.transition.adaptive = false;
    phase3.pumpIsSimple = true;
    phase3.pumpSimple = 100;
    
    Target target3{};
    target3.type = TargetType::TARGET_TYPE_PUMPED;
    target3.operator_ = TargetOperator::GTE;
    target3.value = 300.0f;
    phase3.targets.push_back(target3);
    profile.phases.push_back(phase3);
    
    // Phase 4: Rinse and Refill
    Phase phase4{};
    phase4.name = "Rinse and Refill";
    phase4.phase = PhaseType::PHASE_TYPE_PREINFUSION;
    phase4.valve = 0;
    phase4.duration = 120.0f;
    phase4.temperature = 0.0f;
    phase4.transition.type = TransitionType::INSTANT;
    phase4.transition.duration = 0.0f;
    phase4.transition.adaptive = false;
    phase4.pumpIsSimple = true;
    phase4.pumpSimple = 0;
    profile.phases.push_back(phase4);
    
    // Phase 5: 1lt Flush
    Phase phase5{};
    phase5.name = "1lt Flush";
    phase5.phase = PhaseType::PHASE_TYPE_BREW;
    phase5.valve = 0;
    phase5.duration = 120.0f;
    phase5.temperature = 0.0f;
    phase5.transition.type = TransitionType::INSTANT;
    phase5.transition.duration = 0.0f;
    phase5.transition.adaptive = false;
    phase5.pumpIsSimple = true;
    phase5.pumpSimple = 100;
    
    Target target5{};
    target5.type = TargetType::TARGET_TYPE_PUMPED;
    target5.operator_ = TargetOperator::GTE;
    target5.value = 1000.0f;
    phase5.targets.push_back(target5);
    profile.phases.push_back(phase5);
    
    return profile;
}

void CleaningSchedulePlugin::ensureCleaningProfilesExist() {
    ProfileManager *profileManager = controller->getProfileManager();
    
    // Create backflush profile if it doesn't exist
    if (!profileManager->profileExists(BACKFLUSH_PROFILE_ID)) {
        Profile backflushProfile = createBackflushProfile();
        profileManager->saveProfile(backflushProfile);
        ESP_LOGI("CleaningSchedulePlugin", "Created backflush profile");
    }
    
    // Create descaling profile if it doesn't exist
    if (!profileManager->profileExists(DESCALING_PROFILE_ID)) {
        Profile descalingProfile = createDescalingProfile();
        profileManager->saveProfile(descalingProfile);
        ESP_LOGI("CleaningSchedulePlugin", "Created descaling profile");
    }
}

void CleaningSchedulePlugin::loadCleaningProfile(const String &profileId) {
    ProfileManager *profileManager = controller->getProfileManager();
    
    // Select the cleaning profile
    profileManager->selectProfile(profileId);
    
    // Switch to brew mode
    controller->setMode(MODE_BREW);
    
    ESP_LOGI("CleaningSchedulePlugin", "Loaded cleaning profile: %s", profileId.c_str());
}

void CleaningSchedulePlugin::checkAndResetCleaningTimers() {
    // Get the currently selected profile to check if it's a cleaning profile
    ProfileManager *profileManager = controller->getProfileManager();
    Profile selectedProfile = profileManager->getSelectedProfile();
    
    if (selectedProfile.id == BACKFLUSH_PROFILE_ID) {
        ESP_LOGI("CleaningSchedulePlugin", "Backflush profile completed, resetting timer");
        resetBackflushTimer();
    } else if (selectedProfile.id == DESCALING_PROFILE_ID) {
        ESP_LOGI("CleaningSchedulePlugin", "Descaling profile completed, resetting timer");
        resetDescalingTimer();
    }
}

unsigned long CleaningSchedulePlugin::getCurrentTimeSeconds() const {
    time_t now;
    time(&now);
    return (unsigned long)now;
}

void CleaningSchedulePlugin::triggerNotificationEvents() {
    // Trigger events for UI notification systems
    if (isBackflushDue()) {
        pluginManager->trigger("cleaning:backflush:due");
    }
    
    if (isDescalingDue()) {
        pluginManager->trigger("cleaning:descaling:due");
    }
    
    // Always trigger status events for UI updates
    pluginManager->trigger("cleaning:status:update", "backflush_days", getDaysSinceLastBackflush());
    pluginManager->trigger("cleaning:status:update", "descaling_weeks", getWeeksSinceLastDescaling());
}