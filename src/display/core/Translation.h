#ifndef TRANSLATION_H
#define TRANSLATION_H

#include <Arduino.h>

enum class Language {
    ENGLISH,
    GERMAN,
    FRENCH,
    SPANISH
};

enum class TranslationKey {
    BREW,
    STEAM,
    WATER,
    GRIND,
    SELECT_PROFILE,
    STARTING,
    UPDATING,
    TEMPERATURE_ERROR,
    AUTOTUNING,
    FINISHED,
    INFUSION,
    BREW_PHASE,
    STEPS,
    PHASES,
    STEP,
    PHASE,
    SELECTED_PROFILE,
    RESTART_REQUIRED
};

class Translation {
public:
    static void setLanguage(Language lang);
    static Language getLanguage();
    static const char* get(TranslationKey key);
    static String format(const char* format, ...);
    
    private:
        static Language currentLanguage;
};

#define TR(key) Translation::get(TranslationKey::key)

#endif // TRANSLATION_H
