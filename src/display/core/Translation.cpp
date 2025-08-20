#include "Translation.h"
#include <stdarg.h>

Language Translation::currentLanguage = Language::ENGLISH;

void Translation::setLanguage(Language lang) {
    currentLanguage = lang;
}

Language Translation::getLanguage() {
    return currentLanguage;
}

const char* Translation::get(TranslationKey key) {
    const char *text = nullptr;
    switch (currentLanguage) {
        case Language::GERMAN:
            text = getGerman(key);
            break;
        case Language::FRENCH:
            text = getFrench(key);
            break;
        case Language::SPANISH:
            text = getSpanish(key);
            break;
        case Language::ENGLISH:
        default:
            text = getEnglish(key);
            break;
    }
    if (text == nullptr || text[0] == '\0') {
        return getEnglish(key);
    }
    return text;
}

String Translation::format(const char* format, ...) {
    char buffer[256];
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);
    return String(buffer);
}

const char* Translation::getEnglish(TranslationKey key) {
    switch (key) {
        case TranslationKey::BREW: return "Brew";
        case TranslationKey::STEAM: return "Steam";
        case TranslationKey::WATER: return "Water";
        case TranslationKey::GRIND: return "Grind";
        case TranslationKey::SELECT_PROFILE: return "Select profile";
        case TranslationKey::STARTING: return "Starting...";
        case TranslationKey::UPDATING: return "Updating...";
        case TranslationKey::TEMPERATURE_ERROR: return "Temperature error, please restart";
        case TranslationKey::AUTOTUNING: return "Autotuning...";
        case TranslationKey::FINISHED: return "Finished";
        case TranslationKey::INFUSION: return "INFUSION";
        case TranslationKey::BREW_PHASE: return "BREW";
        case TranslationKey::STEPS: return "Steps";
        case TranslationKey::PHASES: return "Phases";
        case TranslationKey::STEP: return "step";
        case TranslationKey::PHASE: return "phase";
        case TranslationKey::SELECTED_PROFILE: return "Selected profile";
        case TranslationKey::RESTART_REQUIRED: return "Restart required";
        default: return "";
    }
}

const char* Translation::getGerman(TranslationKey key) {
    switch (key) {
        case TranslationKey::BREW: return "Kaffee";
        case TranslationKey::STEAM: return "Dampf";
        case TranslationKey::WATER: return "Wasser";
        case TranslationKey::GRIND: return "Mahlen";
        case TranslationKey::SELECT_PROFILE: return "Profil auswählen";
        case TranslationKey::STARTING: return "Starten...";
        case TranslationKey::UPDATING: return "Aktualisieren...";
        case TranslationKey::TEMPERATURE_ERROR: return "Temperaturfehler, bitte neu starten";
        case TranslationKey::AUTOTUNING: return "Autotune...";
        case TranslationKey::FINISHED: return "Fertig";
        case TranslationKey::INFUSION: return "INFUSION";
        case TranslationKey::BREW_PHASE: return "BEZUG";
        case TranslationKey::STEPS: return "Schritte";
        case TranslationKey::PHASES: return "Phasen";
        case TranslationKey::STEP: return "Schritt";
        case TranslationKey::PHASE: return "Phase";
        case TranslationKey::SELECTED_PROFILE: return "Gewähltes Profil";
        case TranslationKey::RESTART_REQUIRED: return "Neustart benötigt";
        default: return "";
    }
}

const char* Translation::getFrench(TranslationKey key) {
    switch (key) {
        case TranslationKey::BREW: return "Brew";
        case TranslationKey::STEAM: return "Steam";
        case TranslationKey::WATER: return "Water";
        case TranslationKey::GRIND: return "Grind";
        case TranslationKey::SELECT_PROFILE: return "Select profile";
        case TranslationKey::STARTING: return "Starting...";
        case TranslationKey::UPDATING: return "Updating...";
        case TranslationKey::TEMPERATURE_ERROR: return "Temperature error, please restart";
        case TranslationKey::AUTOTUNING: return "Autotuning...";
        case TranslationKey::FINISHED: return "Finished";
        case TranslationKey::INFUSION: return "INFUSION";
        case TranslationKey::BREW_PHASE: return "BREW";
        case TranslationKey::STEPS: return "Steps";
        case TranslationKey::PHASES: return "Phases";
        case TranslationKey::STEP: return "step";
        case TranslationKey::PHASE: return "phase";
        case TranslationKey::SELECTED_PROFILE: return "Selected profile";
        case TranslationKey::RESTART_REQUIRED: return "Restart required";
        default: return "";
    }
}

const char* Translation::getSpanish(TranslationKey key) {
    switch (key) {
        case TranslationKey::BREW: return "Brew";
        case TranslationKey::STEAM: return "Steam";
        case TranslationKey::WATER: return "Water";
        case TranslationKey::GRIND: return "Grind";
        case TranslationKey::SELECT_PROFILE: return "Select profile";
        case TranslationKey::STARTING: return "Starting...";
        case TranslationKey::UPDATING: return "Updating...";
        case TranslationKey::TEMPERATURE_ERROR: return "Temperature error, please restart";
        case TranslationKey::AUTOTUNING: return "Autotuning...";
        case TranslationKey::FINISHED: return "Finished";
        case TranslationKey::INFUSION: return "INFUSION";
        case TranslationKey::BREW_PHASE: return "BREW";
        case TranslationKey::STEPS: return "Steps";
        case TranslationKey::PHASES: return "Phases";
        case TranslationKey::STEP: return "step";
        case TranslationKey::PHASE: return "phase";
        case TranslationKey::SELECTED_PROFILE: return "Selected profile";
        case TranslationKey::RESTART_REQUIRED: return "Restart required";
        default: return "";
    }
}
