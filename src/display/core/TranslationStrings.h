#ifndef TRANSLATION_STRINGS_H
#define TRANSLATION_STRINGS_H
#include <cstddef>

namespace TranslationStrings {
    static constexpr std::size_t NUM_KEYS = 18;
    
    extern const char* const ENGLISH[NUM_KEYS];
    extern const char* const GERMAN[NUM_KEYS];
    extern const char* const FRENCH[NUM_KEYS];
    extern const char* const SPANISH[NUM_KEYS];
}

#endif // TRANSLATION_STRINGS_H
