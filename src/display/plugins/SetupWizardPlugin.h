#ifndef SETUPWIZARDPLUGIN_H
#define SETUPWIZARDPLUGIN_H

#include <algorithm>
#include <atomic>
#include <display/core/Plugin.h>
#include <memory>

class Controller;
class PluginManager;
class WebSocketHandler;

// First-run setup wizard backend: heater and valve-closed pressure tests, and Wi-Fi scans while in AP mode.
class SetupWizardPlugin : public Plugin {
  public:
    enum class Test { NONE, HEATER, PRESSURE };
    enum class Phase { IDLE, HEATING, SETTLING, BUILDING, RELEASING, DONE };
    enum class Scan { IDLE, REQUESTED, RUNNING };

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
    float heaterTarget() const;
    void startScan();
    void publishScan(bool success);

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

    std::atomic<Scan> scan{Scan::IDLE};
    std::atomic<bool> scanDone{false}; // set from the Wi-Fi event task
    unsigned long scanStarted = 0;
};

#endif // SETUPWIZARDPLUGIN_H
