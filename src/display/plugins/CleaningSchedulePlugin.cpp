#include "CleaningSchedulePlugin.h"
#include <display/core/Controller.h>
#include <display/core/Event.h>
#include <display/core/ProfileManager.h>
#include <display/core/constants.h>
#include <display/core/utils.h>
#include <time.h>

// Static profile ID constants
const String CleaningSchedulePlugin::BACKFLUSH_PROFILE_ID = "backflush_cleaning";
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
    profile.label = "Backflush";
    profile.description = "Automated backflushing cleaning cycle";
    profile.temperature = 93; // Standard brew temperature
    profile.type = "standard";
    
    // Phase 1: Initial flush (5 seconds)
    Phase phase1{};
    phase1.name = "Initial Flush";
    phase1.phase = PhaseType::PHASE_TYPE_BREW;
    phase1.valve = 1; // Open valve
    phase1.duration = 5.0f;
    phase1.pumpIsSimple = true;
    phase1.pumpSimple = 100; // Full pump power
    profile.phases.push_back(phase1);
    
    // Phase 2: Pause (3 seconds)
    Phase phase2{};
    phase2.name = "Pause";
    phase2.phase = PhaseType::PHASE_TYPE_BREW;
    phase2.valve = 1;
    phase2.duration = 3.0f;
    phase2.pumpIsSimple = true;
    phase2.pumpSimple = 0; // No pump
    profile.phases.push_back(phase2);
    
    // Phase 3: Second flush (5 seconds)
    Phase phase3{};
    phase3.name = "Second Flush";
    phase3.phase = PhaseType::PHASE_TYPE_BREW;
    phase3.valve = 1;
    phase3.duration = 5.0f;
    phase3.pumpIsSimple = true;
    phase3.pumpSimple = 100;
    profile.phases.push_back(phase3);
    
    // Phase 4: Final pause (3 seconds)
    Phase phase4{};
    phase4.name = "Final Pause";
    phase4.phase = PhaseType::PHASE_TYPE_BREW;
    phase4.valve = 1;
    phase4.duration = 3.0f;
    phase4.pumpIsSimple = true;
    phase4.pumpSimple = 0;
    profile.phases.push_back(phase4);
    
    // Phase 5: Final flush (10 seconds)
    Phase phase5{};
    phase5.name = "Final Flush";
    phase5.phase = PhaseType::PHASE_TYPE_BREW;
    phase5.valve = 1;
    phase5.duration = 10.0f;
    phase5.pumpIsSimple = true;
    phase5.pumpSimple = 100;
    profile.phases.push_back(phase5);
    
    return profile;
}

Profile CleaningSchedulePlugin::createDescalingProfile() const {
    Profile profile{};
    profile.id = DESCALING_PROFILE_ID;
    profile.label = "Descaling";
    profile.description = "Automated descaling cleaning cycle";
    profile.temperature = 93; // Standard brew temperature
    profile.type = "standard";
    
    // Phase 1: Long initial flush (20 seconds)
    Phase phase1{};
    phase1.name = "Long Flush";
    phase1.phase = PhaseType::PHASE_TYPE_BREW;
    phase1.valve = 1;
    phase1.duration = 20.0f;
    phase1.pumpIsSimple = true;
    phase1.pumpSimple = 100;
    profile.phases.push_back(phase1);
    
    // Phase 2: Extended pause for descaling agent (30 seconds)
    Phase phase2{};
    phase2.name = "Descaling Agent Contact";
    phase2.phase = PhaseType::PHASE_TYPE_BREW;
    phase2.valve = 1;
    phase2.duration = 30.0f;
    phase2.pumpIsSimple = true;
    phase2.pumpSimple = 0;
    profile.phases.push_back(phase2);
    
    // Phase 3: Medium flush (15 seconds)
    Phase phase3{};
    phase3.name = "Medium Flush";
    phase3.phase = PhaseType::PHASE_TYPE_BREW;
    phase3.valve = 1;
    phase3.duration = 15.0f;
    phase3.pumpIsSimple = true;
    phase3.pumpSimple = 100;
    profile.phases.push_back(phase3);
    
    // Phase 4: Another pause (15 seconds)
    Phase phase4{};
    phase4.name = "Second Contact";
    phase4.phase = PhaseType::PHASE_TYPE_BREW;
    phase4.valve = 1;
    phase4.duration = 15.0f;
    phase4.pumpIsSimple = true;
    phase4.pumpSimple = 0;
    profile.phases.push_back(phase4);
    
    // Phase 5: Final long flush (25 seconds)
    Phase phase5{};
    phase5.name = "Final Rinse";
    phase5.phase = PhaseType::PHASE_TYPE_BREW;
    phase5.valve = 1;
    phase5.duration = 25.0f;
    phase5.pumpIsSimple = true;
    phase5.pumpSimple = 100;
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