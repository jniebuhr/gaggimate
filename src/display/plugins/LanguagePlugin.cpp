#include "LanguagePlugin.h"
#include <display/core/Translation.h>

LanguagePlugin::LanguagePlugin(Controller *controller) : Plugin(controller) {
    controller->getPluginManager()->registerPlugin(this);
}

void LanguagePlugin::init() {
    controller->getPluginManager()->on("language:change", [this](Event const &event) {
        int language = event.getInt("language");
        setLanguage(language);
    });
}

void LanguagePlugin::setLanguage(int language) {
    Translation::setLanguage(static_cast<Language>(language));
    controller->getSettings().setLanguage(language);
    controller->getPluginManager()->emit("ui:refresh", {});
}

const char* LanguagePlugin::getName() const {
    return "Language";
}

const char* LanguagePlugin::getDescription() const {
    return "Language settings for the display";
}

bool LanguagePlugin::isEnabled() const {
    return true;
}

void LanguagePlugin::setEnabled(bool enabled) {
}

String LanguagePlugin::getConfig() const {
    return "{\"language\":" + String(controller->getSettings().getLanguage()) + "}";
}

void LanguagePlugin::setConfig(const String &config) {
    if (config.indexOf("\"language\":") != -1) {
        int start = config.indexOf("\"language\":") + 11;
        int end = config.indexOf(",", start);
        if (end == -1) end = config.indexOf("}", start);
        if (end != -1) {
            String langStr = config.substring(start, end);
            int language = langStr.toInt();
            setLanguage(language);
        }
    }
}
