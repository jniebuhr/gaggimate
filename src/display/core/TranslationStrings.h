#ifndef TRANSLATION_STRINGS_H
#define TRANSLATION_STRINGS_H

enum class TranslationKey;

namespace TranslationStrings {
    extern const char* const ENGLISH[];
    extern const char* const GERMAN[];
    extern const char* const FRENCH[];
    extern const char* const SPANISH[];
    
    static constexpr size_t NUM_KEYS = 18;
}

#endif // TRANSLATION_STRINGS_H
