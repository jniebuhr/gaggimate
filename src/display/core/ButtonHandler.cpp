#include "ButtonHandler.h"

void ButtonHandler::setConfig(const Config &cfg) {
    std::lock_guard<std::mutex> guard(mutex);
    config = cfg;
}

void ButtonHandler::onRawState(uint8_t index, bool pressed, unsigned long now) {
    if (index >= BUTTON_COUNT)
        return;
    std::vector<Pending> events;
    {
        std::lock_guard<std::mutex> guard(mutex);
        State &s = state[index];
        const bool comboCandidate = config.combo && index < COMBO_BUTTON;
        if (pressed) {
            if (comboCandidate) {
                State &other = state[1 - index];
                if (other.pending) { // both edges inside the window: one virtual third button
                    other.pending = false;
                    s.consumed = other.consumed = true;
                    comboActive = true;
                    press(COMBO_BUTTON, now, events);
                } else {
                    s.pending = true; // hold back until the window passes (see loop)
                    s.pressedAt = now;
                }
            } else {
                press(index, now, events);
            }
        } else if (s.pending) { // tap shorter than the window: deliver both edges now
            s.pending = false;
            press(index, now, events);
            release(index, events);
        } else if (s.consumed) { // first release ends the combo, the other one is swallowed
            s.consumed = false;
            if (comboActive) {
                comboActive = false;
                release(COMBO_BUTTON, events);
            }
        } else {
            release(index, events);
        }
    }
    emit(events);
}

void ButtonHandler::loop(unsigned long now) {
    std::vector<Pending> events;
    {
        std::lock_guard<std::mutex> guard(mutex);
        for (uint8_t i = 0; i < BUTTON_COUNT; i++) {
            State &s = state[i];
            if (s.pending && now - s.pressedAt >= COMBO_WINDOW_MS) {
                s.pending = false;
                press(i, s.pressedAt, events);
            }
            if (s.logical && config.momentary && config.longPress[i] && !s.longFired && !s.clickFired &&
                now - s.pressedAt >= LONG_PRESS_MS) {
                s.longFired = true;
                events.push_back({i, Event::LONG_PRESS});
            }
        }
    }
    emit(events);
}

void ButtonHandler::press(uint8_t index, unsigned long now, std::vector<Pending> &out) {
    State &s = state[index];
    s.logical = true;
    s.pressedAt = now;
    s.longFired = false;
    s.clickFired = false;
    if (!config.momentary) {
        out.push_back({index, Event::PRESS});
    } else if (config.clickOnPress[index] || !config.longPress[index]) {
        s.clickFired = true;
        out.push_back({index, Event::CLICK});
    }
}

void ButtonHandler::release(uint8_t index, std::vector<Pending> &out) {
    State &s = state[index];
    if (!s.logical)
        return;
    s.logical = false;
    if (!config.momentary) {
        out.push_back({index, Event::RELEASE});
    } else if (s.longFired) {
        out.push_back({index, Event::LONG_PRESS_END});
    } else if (s.clickFired) {
        out.push_back({index, Event::CLICK_END});
    } else {
        out.push_back({index, Event::CLICK});
    }
}

void ButtonHandler::emit(const std::vector<Pending> &events) {
    if (!callback)
        return;
    for (const auto &e : events)
        callback(e.index, e.event);
}
