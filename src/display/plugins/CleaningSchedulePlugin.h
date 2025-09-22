#ifndef CLEANINGSCHEDULEPLUGIN_H
#define CLEANINGSCHEDULEPLUGIN_H

#include <display/core/Plugin.h>
#include <display/models/profile.h>

struct Event;
class Controller;
class PluginManager;

class CleaningSchedulePlugin : public Plugin {
public:
    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override;

    // Public methods for triggering cleaning actions
    void startBackflush();
    void startDescaling();
    void resetBackflushTimer();
    void resetDescalingTimer();

    // Status checks
    bool isBackflushDue() const;
    bool isDescalingDue() const;
    int getDaysSinceLastBackflush() const;
    int getWeeksSinceLastDescaling() const;

private:
    Controller *controller = nullptr;
    PluginManager *pluginManager = nullptr;
    
    unsigned long lastCheckTime = 0;
    static const unsigned long CHECK_INTERVAL = 60000; // Check every minute
    
    // Create hardcoded profiles
    Profile createBackflushProfile() const;
    Profile createDescalingProfile() const;
    
    // Profile management
    void ensureCleaningProfilesExist();
    void loadCleaningProfile(const String &profileId);
    
    // Helper methods
    unsigned long getCurrentTimeSeconds() const;
    void triggerNotificationEvents();
    void checkAndResetCleaningTimers();
    
    // Profile IDs
    static const String BACKFLUSH_PROFILE_ID;
    static const String DESCALING_PROFILE_ID;
};

#endif // CLEANINGSCHEDULEPLUGIN_H