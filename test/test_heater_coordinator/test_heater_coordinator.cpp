// Unit tests: HeaterCoordinator dual-boiler output arbitration (GM-261).
// Host-side, no ESP32/Arduino runtime — pio test -e native -f test_heater_coordinator.

#include <unity.h>

#include <algorithm>
#include <cstdint>
#include <tuple>
#include <vector>

static uint32_t fakeNow = 0;
static uint32_t millis() { return fakeNow; }

// Fake Heater: claim the real header's include guard so HeaterCoordinator.h binds to this class instead.
#define HEATER_H
class HeaterCoordinator;
class Heater {
  public:
    void setCoordinator(HeaterCoordinator *c) { coordinator = c; }
    bool isAutotuning() const { return autotuning; }

    bool autotuning = false;
    bool pin = false;
    HeaterCoordinator *coordinator = nullptr;
    std::vector<std::pair<uint32_t, bool>> edges; // (time, new pin state)

  private:
    void writeOutput(bool on) {
        if (on != pin)
            edges.emplace_back(fakeNow, on);
        pin = on;
    }
    friend class HeaterCoordinator;
};

#include "peripherals/HeaterCoordinator.cpp"

constexpr uint32_t T0 = 100000;

struct Rig {
    Heater brew;
    Heater steam;
    HeaterCoordinator coordinator{&brew, &steam};

    Rig(bool enabled, uint32_t handoverMs) { coordinator.configure(enabled, handoverMs); }
    void req(Heater &h, bool on) { coordinator.request(&h, on); }
    void at(uint32_t t) { fakeNow = t; }
};

// Replays both heaters' edges in time order and asserts they never overlap and every ON honours the handover gap.
static void assertExclusiveWithHandover(const Heater &brew, const Heater &steam, uint32_t handoverMs) {
    std::vector<std::tuple<uint32_t, int, bool>> all;
    for (const auto &e : brew.edges)
        all.emplace_back(e.first, 0, e.second);
    for (const auto &e : steam.edges)
        all.emplace_back(e.first, 1, e.second);
    std::stable_sort(all.begin(), all.end(), [](const auto &a, const auto &b) { return std::get<0>(a) < std::get<0>(b); });
    bool on[2] = {false, false};
    bool everOff[2] = {false, false};
    uint32_t lastOff[2] = {0, 0};
    for (const auto &[t, ch, state] : all) {
        const int other = 1 - ch;
        if (state) {
            TEST_ASSERT_FALSE_MESSAGE(on[other], "both heaters on at once");
            if (everOff[other])
                TEST_ASSERT_TRUE_MESSAGE(t - lastOff[other] >= handoverMs, "handover gap violated");
        } else {
            everOff[ch] = true;
            lastOff[ch] = t;
        }
        on[ch] = state;
    }
}

void setUp() { fakeNow = T0; }
void tearDown() {}

// --- Coordination disabled ---------------------------------------------------------------------------------------

void test_disabled_by_default_runs_heaters_in_parallel() {
    Heater brew, steam;
    HeaterCoordinator coordinator(&brew, &steam);
    TEST_ASSERT_EQUAL_PTR(&coordinator, brew.coordinator);
    TEST_ASSERT_EQUAL_PTR(&coordinator, steam.coordinator);
    coordinator.request(&brew, true);
    coordinator.request(&steam, true);
    TEST_ASSERT_TRUE(brew.pin);
    TEST_ASSERT_TRUE(steam.pin);
}

void test_disabled_follows_requests_directly() {
    Rig r(false, 50);
    r.req(r.steam, true);
    r.req(r.brew, true);
    TEST_ASSERT_TRUE(r.brew.pin);
    TEST_ASSERT_TRUE(r.steam.pin);
    r.req(r.brew, false);
    TEST_ASSERT_FALSE(r.brew.pin);
    TEST_ASSERT_TRUE(r.steam.pin);
}

void test_disabled_ignores_autotune() {
    Rig r(false, 50);
    r.brew.autotuning = true;
    r.req(r.steam, true);
    TEST_ASSERT_TRUE(r.steam.pin);
}

// --- Coordination enabled: basic arbitration ---------------------------------------------------------------------

void test_brew_turns_on_immediately_from_cold() {
    Rig r(true, 50);
    r.req(r.brew, true);
    TEST_ASSERT_TRUE(r.brew.pin);
}

void test_steam_turns_on_immediately_from_cold() {
    Rig r(true, 50);
    r.req(r.steam, true);
    TEST_ASSERT_TRUE(r.steam.pin);
}

void test_cold_start_with_max_handover_is_immediate() {
    Rig r(true, HeaterCoordinator::MAX_HANDOVER_MS);
    r.req(r.steam, true);
    TEST_ASSERT_TRUE(r.steam.pin);
}

void test_off_is_immediate() {
    Rig r(true, 50);
    r.req(r.brew, true);
    r.req(r.brew, false);
    TEST_ASSERT_FALSE(r.brew.pin);
    r.at(T0 + 100);
    r.req(r.steam, true);
    r.req(r.steam, false);
    TEST_ASSERT_FALSE(r.steam.pin);
}

void test_reasserting_on_does_not_toggle() {
    Rig r(true, 50);
    r.req(r.brew, true);
    for (int i = 1; i <= 20; i++) {
        r.at(T0 + i * 10);
        r.req(r.brew, true);
    }
    TEST_ASSERT_TRUE(r.brew.pin);
    TEST_ASSERT_EQUAL(1, r.brew.edges.size());
}

void test_brew_preempts_steam_and_waits_handover() {
    Rig r(true, 50);
    r.req(r.steam, true);
    r.at(T0 + 10);
    r.req(r.brew, true);
    TEST_ASSERT_FALSE(r.steam.pin);
    TEST_ASSERT_FALSE(r.brew.pin);
    r.at(T0 + 59);
    r.req(r.brew, true);
    TEST_ASSERT_FALSE(r.brew.pin);
    r.at(T0 + 60);
    r.req(r.brew, true);
    TEST_ASSERT_TRUE(r.brew.pin);
}

void test_steam_yields_while_brew_is_on() {
    Rig r(true, 50);
    r.req(r.brew, true);
    r.at(T0 + 500);
    r.req(r.steam, true);
    TEST_ASSERT_FALSE(r.steam.pin);
    TEST_ASSERT_TRUE(r.brew.pin);
}

void test_steam_yields_while_brew_waits_for_handover() {
    Rig r(true, 50);
    r.req(r.steam, true);
    r.at(T0 + 10);
    r.req(r.brew, true); // steam off, brew pending
    r.at(T0 + 20);
    r.req(r.steam, true);
    TEST_ASSERT_FALSE(r.steam.pin);
    TEST_ASSERT_FALSE(r.brew.pin);
}

void test_steam_waits_handover_after_brew_releases() {
    Rig r(true, 50);
    r.req(r.brew, true);
    r.at(T0 + 300);
    r.req(r.brew, false);
    r.at(T0 + 349);
    r.req(r.steam, true);
    TEST_ASSERT_FALSE(r.steam.pin);
    r.at(T0 + 350);
    r.req(r.steam, true);
    TEST_ASSERT_TRUE(r.steam.pin);
}

void test_steam_resumes_once_brew_no_longer_wants_heat() {
    Rig r(true, 50);
    r.req(r.steam, true);
    r.at(T0 + 10);
    r.req(r.brew, true); // steam preempted
    r.at(T0 + 20);
    r.req(r.brew, false); // brew gives up before it got its turn
    r.at(T0 + 30);
    r.req(r.steam, true); // steam itself was only off for 20 ms; brew never turned on
    TEST_ASSERT_TRUE(r.steam.pin);
    TEST_ASSERT_FALSE(r.brew.pin);
}

// --- Handover configuration --------------------------------------------------------------------------------------

void test_handover_below_minimum_is_clamped() {
    Rig r(true, 0);
    r.req(r.steam, true);
    r.req(r.steam, false);
    r.at(T0 + HeaterCoordinator::MIN_HANDOVER_MS - 1);
    r.req(r.brew, true);
    TEST_ASSERT_FALSE(r.brew.pin);
    r.at(T0 + HeaterCoordinator::MIN_HANDOVER_MS);
    r.req(r.brew, true);
    TEST_ASSERT_TRUE(r.brew.pin);
}

void test_handover_above_maximum_is_clamped() {
    Rig r(true, 100000);
    r.req(r.steam, true);
    r.req(r.steam, false);
    r.at(T0 + HeaterCoordinator::MAX_HANDOVER_MS - 1);
    r.req(r.brew, true);
    TEST_ASSERT_FALSE(r.brew.pin);
    r.at(T0 + HeaterCoordinator::MAX_HANDOVER_MS);
    r.req(r.brew, true);
    TEST_ASSERT_TRUE(r.brew.pin);
}

void test_handover_survives_millis_wraparound() {
    fakeNow = 0xFFFFFFF0u;
    Rig r(true, 50);
    r.req(r.steam, true);
    r.req(r.brew, true); // steam off at 0xFFFFFFF0
    r.at(0x21);          // 49 ms later, after the wrap
    r.req(r.brew, true);
    TEST_ASSERT_FALSE(r.brew.pin);
    r.at(0x22); // 50 ms later
    r.req(r.brew, true);
    TEST_ASSERT_TRUE(r.brew.pin);
}

// --- Runtime reconfiguration -------------------------------------------------------------------------------------

void test_disabling_at_runtime_allows_parallel() {
    Rig r(true, 50);
    r.req(r.brew, true);
    r.req(r.steam, true);
    TEST_ASSERT_FALSE(r.steam.pin);
    r.coordinator.configure(false, 50);
    r.req(r.steam, true);
    TEST_ASSERT_TRUE(r.brew.pin);
    TEST_ASSERT_TRUE(r.steam.pin);
}

void test_enabling_at_runtime_restores_exclusivity_on_next_request() {
    Rig r(false, 50);
    r.req(r.brew, true);
    r.req(r.steam, true);
    r.coordinator.configure(true, 50);
    r.at(T0 + 10);
    r.req(r.brew, true);
    TEST_ASSERT_TRUE(r.brew.pin);
    TEST_ASSERT_FALSE(r.steam.pin);
    r.req(r.steam, true);
    TEST_ASSERT_FALSE(r.steam.pin);
}

// --- Autotune reservation ----------------------------------------------------------------------------------------

void test_brew_autotune_blocks_steam_during_off_phase() {
    Rig r(true, 50);
    r.brew.autotuning = true;
    r.req(r.brew, false);
    r.at(T0 + 1000);
    r.req(r.steam, true);
    TEST_ASSERT_FALSE(r.steam.pin);
}

void test_brew_autotune_preempts_running_steam() {
    Rig r(true, 50);
    r.req(r.steam, true);
    r.brew.autotuning = true;
    r.at(T0 + 10);
    r.req(r.brew, false);          // autotune in its off phase still claims the supply
    TEST_ASSERT_TRUE(r.steam.pin); // brew's own off request does not touch steam
    r.req(r.steam, true);
    TEST_ASSERT_FALSE(r.steam.pin);
}

void test_steam_autotune_takes_the_lead() {
    Rig r(true, 50);
    r.req(r.brew, true);
    r.steam.autotuning = true;
    r.at(T0 + 10);
    r.req(r.steam, true);
    TEST_ASSERT_FALSE(r.brew.pin);
    TEST_ASSERT_FALSE(r.steam.pin);
    r.at(T0 + 20);
    r.req(r.brew, true); // brew yields while steam autotunes
    TEST_ASSERT_FALSE(r.brew.pin);
    r.at(T0 + 60);
    r.req(r.steam, true);
    TEST_ASSERT_TRUE(r.steam.pin);
    r.req(r.brew, true);
    TEST_ASSERT_FALSE(r.brew.pin);
    TEST_ASSERT_TRUE(r.steam.pin);
}

void test_steam_autotune_blocks_brew_during_off_phase() {
    Rig r(true, 50);
    r.steam.autotuning = true;
    r.req(r.steam, false);
    r.at(T0 + 1000);
    r.req(r.brew, true);
    TEST_ASSERT_FALSE(r.brew.pin);
}

void test_brew_regains_lead_after_steam_autotune() {
    Rig r(true, 50);
    r.steam.autotuning = true;
    r.req(r.steam, true);
    r.steam.autotuning = false;
    r.at(T0 + 10);
    r.req(r.brew, true);
    TEST_ASSERT_FALSE(r.steam.pin);
    r.at(T0 + 60);
    r.req(r.brew, true);
    TEST_ASSERT_TRUE(r.brew.pin);
}

void test_steam_resumes_after_brew_autotune() {
    Rig r(true, 50);
    r.brew.autotuning = true;
    r.req(r.brew, true);
    r.at(T0 + 100);
    r.req(r.brew, false);
    r.brew.autotuning = false;
    r.at(T0 + 150);
    r.req(r.steam, true);
    TEST_ASSERT_TRUE(r.steam.pin);
}

// --- Simulated heater tasks --------------------------------------------------------------------------------------

// Brew runs a soft-PWM window like Heater::softPwm while steam demands heat continuously; both tasks tick every 10 ms.
static void runPwm(Rig &r, uint32_t brewOnMs, uint32_t durationMs) {
    for (uint32_t t = 0; t < durationMs; t++) {
        r.at(T0 + t);
        if (t % 10 == 0)
            r.req(r.brew, (t % 1000) < brewOnMs);
        if (t % 10 == 3)
            r.req(r.steam, true);
    }
}

static uint32_t onTimeMs(const Heater &h, uint32_t endTime) {
    uint32_t total = 0;
    uint32_t since = 0;
    bool on = false;
    for (const auto &e : h.edges) {
        if (e.second)
            since = e.first;
        else if (on)
            total += e.first - since;
        on = e.second;
    }
    if (on)
        total += endTime - since;
    return total;
}

void test_pwm_steam_fills_brew_off_time() {
    Rig r(true, 50);
    runPwm(r, 300, 10000);
    assertExclusiveWithHandover(r.brew, r.steam, 50);
    const uint32_t brew = onTimeMs(r.brew, T0 + 10000);
    const uint32_t steam = onTimeMs(r.steam, T0 + 10000);
    // Brew loses the handover per window; steam gets the rest of each window minus its own handover.
    TEST_ASSERT_UINT32_WITHIN(200, 10 * (300 - 50), brew);
    TEST_ASSERT_UINT32_WITHIN(300, 10 * (700 - 50), steam);
}

void test_pwm_full_brew_demand_starves_steam() {
    Rig r(true, 50);
    runPwm(r, 1000, 5000);
    TEST_ASSERT_TRUE(r.brew.pin);
    TEST_ASSERT_EQUAL(1, r.brew.edges.size());
    TEST_ASSERT_TRUE(r.steam.edges.empty());
}

// Random demands, autotune flags and task phases; exclusivity, handover and progress must hold throughout.
static void runRandom(uint32_t seed, uint32_t handoverMs) {
    fakeNow = T0;
    Rig r(true, handoverMs);
    uint32_t state = seed;
    auto rnd = [&state](uint32_t n) {
        state = state * 1664525u + 1013904223u;
        return (state >> 8) % n;
    };
    bool demand[2] = {false, false};
    uint32_t aloneSince[2] = {0, 0}; // since when this heater alone has wanted heat with nothing autotuning
    bool alone[2] = {false, false};
    Heater *heaters[2] = {&r.brew, &r.steam};
    for (uint32_t t = 0; t < 200000; t++) {
        r.at(T0 + t);
        if (rnd(200) == 0)
            demand[rnd(2)] = rnd(2);
        if (rnd(5000) == 0) {
            Heater *h = heaters[rnd(2)];
            h->autotuning = !h->autotuning;
            if (r.brew.autotuning && r.steam.autotuning)
                h->autotuning = false; // the firmware only ever autotunes one heater at a time
        }
        for (int ch = 0; ch < 2; ch++) {
            if (t % 10 == static_cast<uint32_t>(ch * 5))
                r.req(*heaters[ch], demand[ch]);
            const bool nowAlone = demand[ch] && !demand[1 - ch] && !r.brew.autotuning && !r.steam.autotuning;
            if (nowAlone && !alone[ch])
                aloneSince[ch] = t;
            alone[ch] = nowAlone;
            if (alone[ch] && t - aloneSince[ch] > handoverMs + 20)
                TEST_ASSERT_TRUE_MESSAGE(heaters[ch]->pin, "sole demanding heater never got power");
        }
        TEST_ASSERT_FALSE_MESSAGE(r.brew.pin && r.steam.pin, "both heaters on at once");
    }
    assertExclusiveWithHandover(r.brew, r.steam, handoverMs);
    TEST_ASSERT_TRUE(r.brew.edges.size() > 10);
    TEST_ASSERT_TRUE(r.steam.edges.size() > 10);
}

void test_random_min_handover() { runRandom(1, HeaterCoordinator::MIN_HANDOVER_MS); }
void test_random_default_handover() { runRandom(2, 50); }
void test_random_long_handover() { runRandom(3, 500); }

int main(int, char **) {
    UNITY_BEGIN();
    RUN_TEST(test_disabled_by_default_runs_heaters_in_parallel);
    RUN_TEST(test_disabled_follows_requests_directly);
    RUN_TEST(test_disabled_ignores_autotune);
    RUN_TEST(test_brew_turns_on_immediately_from_cold);
    RUN_TEST(test_steam_turns_on_immediately_from_cold);
    RUN_TEST(test_cold_start_with_max_handover_is_immediate);
    RUN_TEST(test_off_is_immediate);
    RUN_TEST(test_reasserting_on_does_not_toggle);
    RUN_TEST(test_brew_preempts_steam_and_waits_handover);
    RUN_TEST(test_steam_yields_while_brew_is_on);
    RUN_TEST(test_steam_yields_while_brew_waits_for_handover);
    RUN_TEST(test_steam_waits_handover_after_brew_releases);
    RUN_TEST(test_steam_resumes_once_brew_no_longer_wants_heat);
    RUN_TEST(test_handover_below_minimum_is_clamped);
    RUN_TEST(test_handover_above_maximum_is_clamped);
    RUN_TEST(test_handover_survives_millis_wraparound);
    RUN_TEST(test_disabling_at_runtime_allows_parallel);
    RUN_TEST(test_enabling_at_runtime_restores_exclusivity_on_next_request);
    RUN_TEST(test_brew_autotune_blocks_steam_during_off_phase);
    RUN_TEST(test_brew_autotune_preempts_running_steam);
    RUN_TEST(test_steam_autotune_takes_the_lead);
    RUN_TEST(test_steam_autotune_blocks_brew_during_off_phase);
    RUN_TEST(test_brew_regains_lead_after_steam_autotune);
    RUN_TEST(test_steam_resumes_after_brew_autotune);
    RUN_TEST(test_pwm_steam_fills_brew_off_time);
    RUN_TEST(test_pwm_full_brew_demand_starves_steam);
    RUN_TEST(test_random_min_handover);
    RUN_TEST(test_random_default_handover);
    RUN_TEST(test_random_long_handover);
    return UNITY_END();
}
