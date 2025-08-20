#ifndef TRANSLATION_STRINGS_H
#define TRANSLATION_STRINGS_H

enum class TranslationKey;

namespace TranslationStrings {
    // Calculate array size
    static constexpr size_t NUM_KEYS = sizeof(ENGLISH) / sizeof(ENGLISH[0]);
    
    // Ensure all arrays have the same size
    static_assert(sizeof(GERMAN) / sizeof(GERMAN[0]) == NUM_KEYS, "GERMAN array size mismatch");
    static_assert(sizeof(FRENCH) / sizeof(FRENCH[0]) == NUM_KEYS, "FRENCH array size mismatch");
    static_assert(sizeof(SPANISH) / sizeof(SPANISH[0]) == NUM_KEYS, "SPANISH array size mismatch");
    
    // Ensure enum count matches array size. Make sure to update this when adding new keys.
    static_assert(NUM_KEYS == 18, "TranslationKey enum count doesn't match array size");
    
    // English
    static const char* const ENGLISH[] = {
        "Brew",                    // BREW
        "Steam",                   // STEAM
        "Water",                   // WATER
        "Grind",                   // GRIND
        "Select profile",          // SELECT_PROFILE
        "Starting...",             // STARTING
        "Updating...",             // UPDATING
        "Temperature error, please restart", // TEMPERATURE_ERROR
        "Autotuning...",           // AUTOTUNING
        "Finished",                // FINISHED
        "INFUSION",                // INFUSION
        "BREW",                    // BREW_PHASE
        "Steps",                   // STEPS
        "Phases",                  // PHASES
        "step",                    // STEP
        "phase",                   // PHASE
        "Selected profile",        // SELECTED_PROFILE
        "Restart required"         // RESTART_REQUIRED
    };

    // German
    static const char* const GERMAN[] = {
        "Kaffee",                  // BREW
        "Dampf",                   // STEAM
        "Wasser",                  // WATER
        "Mahlen",                  // GRIND
        "Profil auswählen",        // SELECT_PROFILE
        "Starten...",              // STARTING
        "Aktualisieren...",        // UPDATING
        "Temperaturfehler, bitte neu starten", // TEMPERATURE_ERROR
        "Autotune...",             // AUTOTUNING
        "Fertig",                  // FINISHED
        "INFUSION",                // INFUSION
        "BEZUG",                   // BREW_PHASE
        "Schritte",                // STEPS
        "Phasen",                  // PHASES
        "Schritt",                 // STEP
        "Phase",                   // PHASE
        "Gewähltes Profil",        // SELECTED_PROFILE
        "Neustart benötigt"        // RESTART_REQUIRED
    };

    // French
    static const char* const FRENCH[] = {
        "Brew",                    // BREW
        "Steam",                   // STEAM
        "Water",                   // WATER
        "Grind",                   // GRIND
        "Select profile",          // SELECT_PROFILE
        "Starting...",             // STARTING
        "Updating...",             // UPDATING
        "Temperature error, please restart", // TEMPERATURE_ERROR
        "Autotuning...",           // AUTOTUNING
        "Finished",                // FINISHED
        "INFUSION",                // INFUSION
        "BREW",                    // BREW_PHASE
        "Steps",                   // STEPS
        "Phases",                  // PHASES
        "step",                    // STEP
        "phase",                   // PHASE
        "Selected profile",        // SELECTED_PROFILE
        "Restart required"         // RESTART_REQUIRED
    };

    // Spanish
    static const char* const SPANISH[] = {
        "Brew",                    // BREW
        "Steam",                   // STEAM
        "Water",                   // WATER
        "Grind",                   // GRIND
        "Select profile",          // SELECT_PROFILE
        "Starting...",             // STARTING
        "Updating...",             // UPDATING
        "Temperature error, please restart", // TEMPERATURE_ERROR
        "Autotuning...",           // AUTOTUNING
        "Finished",                // FINISHED
        "INFUSION",                // INFUSION
        "BREW",                    // BREW_PHASE
        "Steps",                   // STEPS
        "Phases",                  // PHASES
        "step",                    // STEP
        "phase",                   // PHASE
        "Selected profile",        // SELECTED_PROFILE
        "Restart required"         // RESTART_REQUIRED
    };
}

#endif // TRANSLATION_STRINGS_H
