#include "Translation.h"
#include "TranslationStrings.h"
#include <stdarg.h>

Language Translation::currentLanguage = Language::ENGLISH;

void Translation::setLanguage(Language lang) {
    currentLanguage = lang;
}

Language Translation::getLanguage() {
    return currentLanguage;
}

const char* Translation::get(TranslationKey key) {
    int index = static_cast<int>(key);
    if (index < 0 || index >= static_cast<int>(TranslationStrings::NUM_KEYS)) {
        return "Unknown";
    }
    
    const char* const* strings = nullptr;
    switch (currentLanguage) {
        case Language::GERMAN:
            strings = TranslationStrings::GERMAN;
            break;
        case Language::FRENCH:
            strings = TranslationStrings::FRENCH;
            break;
        case Language::SPANISH:
            strings = TranslationStrings::SPANISH;
            break;
        case Language::ENGLISH:
        default:
            strings = TranslationStrings::ENGLISH;
            break;
    }
    
    const char* text = strings[index];
    if (text != nullptr && text[0] != '\0') {
        return text;
    }
    
    // Fallback to English
    return TranslationStrings::ENGLISH[index];
}

String Translation::format(const char* format, ...) {
    char buffer[256];
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);
    return String(buffer);
}


