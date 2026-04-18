#include <unity.h>

#include "display/core/brew_target.h"

void setUp(void) {}
void tearDown(void) {}

// Bug C reproducer: prior to the fix, Controller::activate() picked VOLUMETRIC
// whenever the profile was volumetric and the scale was healthy, ignoring the
// user's `settings.isVolumetricTarget()` preference. These tests pin the new
// three-input selector so the bug cannot regress.

void test_volumetric_when_profile_user_and_scale_all_agree(void) {
    TEST_ASSERT_EQUAL(static_cast<int>(ProcessTarget::VOLUMETRIC),
                      static_cast<int>(chooseBrewTarget(/*isVolumetricProfile=*/true,
                                                        /*userPrefersVolumetric=*/true,
                                                        /*scaleHealthy=*/true)));
}

void test_time_when_user_prefers_time_even_if_profile_volumetric(void) {
    TEST_ASSERT_EQUAL(static_cast<int>(ProcessTarget::TIME), static_cast<int>(chooseBrewTarget(/*isVolumetricProfile=*/true,
                                                                                               /*userPrefersVolumetric=*/false,
                                                                                               /*scaleHealthy=*/true)));
}

void test_time_when_profile_is_not_volumetric(void) {
    TEST_ASSERT_EQUAL(static_cast<int>(ProcessTarget::TIME), static_cast<int>(chooseBrewTarget(/*isVolumetricProfile=*/false,
                                                                                               /*userPrefersVolumetric=*/true,
                                                                                               /*scaleHealthy=*/true)));
}

void test_time_when_scale_is_unhealthy(void) {
    TEST_ASSERT_EQUAL(static_cast<int>(ProcessTarget::TIME), static_cast<int>(chooseBrewTarget(/*isVolumetricProfile=*/true,
                                                                                               /*userPrefersVolumetric=*/true,
                                                                                               /*scaleHealthy=*/false)));
}

int main(int, char **) {
    UNITY_BEGIN();
    RUN_TEST(test_volumetric_when_profile_user_and_scale_all_agree);
    RUN_TEST(test_time_when_user_prefers_time_even_if_profile_volumetric);
    RUN_TEST(test_time_when_profile_is_not_volumetric);
    RUN_TEST(test_time_when_scale_is_unhealthy);
    return UNITY_END();
}
