#ifndef BUTTONHANDLER_H
#define BUTTONHANDLER_H

#include <cstdint>
#include <functional>
#include <mutex>
#include <vector>

// Turns raw press/release edges from the controller board into button actions
class ButtonHandler {
  public:
    static constexpr uint8_t BUTTON_COUNT = 3;
    static constexpr uint8_t COMBO_BUTTON = 2; // index reported for brew + steam together
    static constexpr unsigned long LONG_PRESS_MS = 400;
    static constexpr unsigned long COMBO_WINDOW_MS = 200;

    enum class Event {
        PRESS,          // latching switch flipped on
        RELEASE,        // latching switch flipped off
        CLICK,          // momentary: normal action (on release, or on press when clickOnPress is set)
        LONG_PRESS,     // momentary: held for LONG_PRESS_MS
        CLICK_END,      // momentary: released after a click that fired on press
        LONG_PRESS_END, // momentary: released after a long press
    };

    struct Config {
        bool momentary = false;               // push buttons instead of latching switches
        bool combo = false;                   // detect brew + steam as COMBO_BUTTON
        bool longPress[BUTTON_COUNT] = {};    // a long-press action is configured for this button
        bool clickOnPress[BUTTON_COUNT] = {}; // fire CLICK on press instead of release
    };

    using Callback = std::function<void(uint8_t index, Event event)>;

    void setCallback(Callback cb) { callback = std::move(cb); }
    void setConfig(const Config &cfg);
    // Raw edge from the controller (index 0 = brew, 1 = steam). Safe to call from any task.
    void onRawState(uint8_t index, bool pressed, unsigned long now);
    // Emits deferred presses and long presses; call frequently (every ~50 ms).
    void loop(unsigned long now);

  private:
    struct Pending {
        uint8_t index;
        Event event;
    };
    struct State {
        bool logical = false;  // press delivered and not yet released
        bool pending = false;  // raw press held back for the combo window
        bool consumed = false; // raw release belongs to a combo, do not deliver
        bool longFired = false;
        bool clickFired = false;
        unsigned long pressedAt = 0;
    };

    void press(uint8_t index, unsigned long now, std::vector<Pending> &out);
    void release(uint8_t index, std::vector<Pending> &out);
    void emit(const std::vector<Pending> &events);

    std::mutex mutex;
    Config config;
    Callback callback;
    State state[BUTTON_COUNT];
    bool comboActive = false;
};

#endif // BUTTONHANDLER_H
