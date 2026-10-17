#ifndef SETUPWIZARDPLUGIN_H
#define SETUPWIZARDPLUGIN_H

#include <algorithm>
#include <atomic>
#include <display/core/Plugin.h>
#include <memory>

class Controller;
class PluginManager;
class WebSocketHandler;

// Hardware checks for the first-run setup wizard: a timed heater test and a valve-closed pressure test.
class SetupWizardPlugin : public Plugin {
  public:
    enum class Test { NONE, HEATER, PRESSURE };
    enum class Phase { IDLE, HEATING, SETTLING, BUILDING, RELEASING, DONE };

    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override;

  private:
    void registerWsHandlers(WebSocketHandler *ws);
    void startHeaterTest();
    void startPressureTest();
    void loopHeater(unsigned long now);
    void loopPressure(unsigned long now);
    void finish(bool passed, const char *reason);
    void publish(const char *state, const char *reason = nullptr);
    float heaterTemp() const;

    Controller *controller = nullptr;
    PluginManager *pluginManager = nullptr;
    WebSocketHandler *ws = nullptr;

    std::atomic<Test> requested{Test::NONE}; // set on the AsyncTCP task, consumed in loop()
    std::atomic<bool> abortRequested{false};

    std::atomic<Test> test{Test::NONE}; // read by the busy check on the AsyncTCP task
    std::shared_ptr<std::atomic<Phase>> phase = std::make_shared<std::atomic<Phase>>(Phase::IDLE);
    unsigned long phaseStarted = 0;
    unsigned long lastPublish = 0;
    unsigned long lastRise = 0;
    float startTemp = 0.0f;
    float peakTemp = 0.0f;
    float maxPressure = 0.0f;
    float riseRef = 0.0f; // last pressure that counted as still rising
    float residualPressure = 0.0f;
};

#endif // SETUPWIZARDPLUGIN_H
