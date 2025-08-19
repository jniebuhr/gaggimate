#ifndef LANGUAGE_PLUGIN_H
#define LANGUAGE_PLUGIN_H

#include <display/core/Plugin.h>

class LanguagePlugin : public Plugin {
public:
    explicit LanguagePlugin(Controller *controller);
    
    void init() override;
    const char* getName() const override;
    const char* getDescription() const override;
    bool isEnabled() const override;
    void setEnabled(bool enabled) override;
    String getConfig() const override;
    void setConfig(const String &config) override;
    
private:
    void setLanguage(int language);
};

#endif // LANGUAGE_PLUGIN_H
