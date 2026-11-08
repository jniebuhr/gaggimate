// Unit tests: ButtonHandler combo / long-press / click-on-release semantics (GM-200).
// Host-side, no ESP32/Arduino runtime — pio test -e native -f test_button_handler.

#include <unity.h>

#include <vector>

#include "display/core/ButtonHandler.cpp"

using Event = ButtonHandler::Event;

struct Rig {
    ButtonHandler handler;
    std::vector<std::pair<uint8_t, Event>> events;
    unsigned long now = 1000;

    explicit Rig(const ButtonHandler::Config &cfg) {
        handler.setConfig(cfg);
        handler.setCallback([this](uint8_t index, Event event) { events.emplace_back(index, event); });
    }
    void raw(uint8_t index, bool pressed) { handler.onRawState(index, pressed, now); }
    // Advance time in 50 ms ticks like the main loop does.
    void advance(unsigned long ms) {
        const unsigned long until = now + ms;
        while (now < until) {
            now += 50;
            handler.loop(now);
        }
    }
    void expect(std::initializer_list<std::pair<uint8_t, Event>> expected) {
        TEST_ASSERT_EQUAL_MESSAGE(expected.size(), events.size(), "event count");
        size_t i = 0;
        for (const auto &e : expected) {
            TEST_ASSERT_EQUAL_MESSAGE(e.first, events[i].first, "button index");
            TEST_ASSERT_EQUAL_MESSAGE(static_cast<int>(e.second), static_cast<int>(events[i].second), "event kind");
            i++;
        }
        events.clear();
    }
};

static ButtonHandler::Config latching(bool combo = false) {
    ButtonHandler::Config cfg;
    cfg.combo = combo;
    return cfg;
}

static ButtonHandler::Config momentary(bool combo = false) {
    ButtonHandler::Config cfg;
    cfg.momentary = true;
    cfg.combo = combo;
    return cfg;
}

void setUp() {}
void tearDown() {}

// --- latching switches ------------------------------------------------------

void test_latching_passes_edges_through_immediately() {
    Rig rig(latching());
    rig.raw(0, true);
    rig.expect({{0, Event::PRESS}});
    rig.advance(1000);
    rig.raw(0, false);
    rig.expect({{0, Event::RELEASE}});
}

void test_latching_combo_window_defers_press() {
    Rig rig(latching(true));
    rig.raw(0, true);
    rig.expect({});
    rig.advance(ButtonHandler::COMBO_WINDOW_MS);
    rig.expect({{0, Event::PRESS}});
    rig.raw(0, false);
    rig.expect({{0, Event::RELEASE}});
}

void test_latching_both_switches_within_window_is_third_button() {
    Rig rig(latching(true));
    rig.raw(0, true);
    rig.advance(100);
    rig.raw(1, true);
    rig.expect({{2, Event::PRESS}});
    rig.advance(2000);
    rig.expect({});
    rig.raw(1, false);
    rig.expect({{2, Event::RELEASE}});
    rig.raw(0, false); // second release is swallowed
    rig.expect({});
}

void test_second_switch_after_window_is_a_plain_press() {
    Rig rig(latching(true));
    rig.raw(0, true);
    rig.advance(500);
    rig.expect({{0, Event::PRESS}});
    rig.raw(1, true);
    rig.advance(ButtonHandler::COMBO_WINDOW_MS);
    rig.expect({{1, Event::PRESS}});
    rig.raw(0, false);
    rig.raw(1, false);
    rig.expect({{0, Event::RELEASE}, {1, Event::RELEASE}});
}

void test_tap_inside_window_delivers_both_edges() {
    Rig rig(latching(true));
    rig.raw(0, true);
    rig.advance(50);
    rig.raw(0, false);
    rig.expect({{0, Event::PRESS}, {0, Event::RELEASE}});
}

// --- momentary buttons ------------------------------------------------------

void test_momentary_without_long_press_clicks_on_press() {
    Rig rig(momentary());
    rig.raw(0, true);
    rig.expect({{0, Event::CLICK}});
    rig.advance(1000);
    rig.raw(0, false);
    rig.expect({{0, Event::CLICK_END}});
}

void test_momentary_with_long_press_clicks_on_release() {
    auto cfg = momentary();
    cfg.longPress[0] = true;
    Rig rig(cfg);
    rig.raw(0, true);
    rig.advance(150);
    rig.expect({});
    rig.raw(0, false);
    rig.expect({{0, Event::CLICK}});
}

void test_momentary_long_press_fires_after_timeout_and_suppresses_click() {
    auto cfg = momentary();
    cfg.longPress[0] = true;
    Rig rig(cfg);
    rig.raw(0, true);
    rig.advance(ButtonHandler::LONG_PRESS_MS);
    rig.expect({{0, Event::LONG_PRESS}});
    rig.advance(2000);
    rig.raw(0, false);
    rig.expect({{0, Event::LONG_PRESS_END}});
}

void test_momentary_long_press_counts_from_physical_press_despite_combo_window() {
    auto cfg = momentary(true);
    cfg.longPress[0] = true;
    Rig rig(cfg);
    rig.raw(0, true);
    rig.advance(ButtonHandler::LONG_PRESS_MS);
    rig.expect({{0, Event::LONG_PRESS}});
}

void test_momentary_click_on_press_blocks_long_press() {
    auto cfg = momentary();
    cfg.longPress[0] = true;
    cfg.clickOnPress[0] = true; // hold-to-flush claims the whole hold
    Rig rig(cfg);
    rig.raw(0, true);
    rig.expect({{0, Event::CLICK}});
    rig.advance(1000);
    rig.expect({});
    rig.raw(0, false);
    rig.expect({{0, Event::CLICK_END}});
}

void test_momentary_combo_clicks_third_button_on_release() {
    Rig rig(momentary(true));
    rig.raw(1, true);
    rig.advance(50);
    rig.raw(0, true);
    rig.expect({{2, Event::CLICK}});
    rig.raw(0, false);
    rig.expect({{2, Event::CLICK_END}});
    rig.raw(1, false);
    rig.expect({});
}

void test_momentary_combo_long_press() {
    auto cfg = momentary(true);
    cfg.longPress[2] = true;
    Rig rig(cfg);
    rig.raw(0, true);
    rig.raw(1, true);
    rig.expect({});
    rig.advance(ButtonHandler::LONG_PRESS_MS);
    rig.expect({{2, Event::LONG_PRESS}});
    rig.raw(1, false);
    rig.expect({{2, Event::LONG_PRESS_END}});
}

void test_release_without_press_is_ignored() {
    Rig rig(momentary());
    rig.raw(1, false);
    rig.expect({});
}

int main(int, char **) {
    UNITY_BEGIN();
    RUN_TEST(test_latching_passes_edges_through_immediately);
    RUN_TEST(test_latching_combo_window_defers_press);
    RUN_TEST(test_latching_both_switches_within_window_is_third_button);
    RUN_TEST(test_second_switch_after_window_is_a_plain_press);
    RUN_TEST(test_tap_inside_window_delivers_both_edges);
    RUN_TEST(test_momentary_without_long_press_clicks_on_press);
    RUN_TEST(test_momentary_with_long_press_clicks_on_release);
    RUN_TEST(test_momentary_long_press_fires_after_timeout_and_suppresses_click);
    RUN_TEST(test_momentary_long_press_counts_from_physical_press_despite_combo_window);
    RUN_TEST(test_momentary_click_on_press_blocks_long_press);
    RUN_TEST(test_momentary_combo_clicks_third_button_on_release);
    RUN_TEST(test_momentary_combo_long_press);
    RUN_TEST(test_release_without_press_is_ignored);
    return UNITY_END();
}
