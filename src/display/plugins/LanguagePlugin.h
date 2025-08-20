#ifndef LANGUAGE_PLUGIN_H
#define LANGUAGE_PLUGIN_H

class Controller;
class PluginManager;

class LanguagePlugin : public Plugin {
public:
    explicit LanguagePlugin(Controller *controller);
    
    void setup(Controller* controller, PluginManager* pluginManager) override;
    void loop() override;
    
private:
    void setLanguage(int language);
};

#endif // LANGUAGE_PLUGIN_H
