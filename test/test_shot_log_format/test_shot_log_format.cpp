#include <unity.h>

#include "display/models/shot_log_format.h"

namespace {
void test_versioned_sample_sizes_match_binary_layouts() {
    TEST_ASSERT_EQUAL_UINT8(26, shotLogSampleSizeForVersion(5));
    TEST_ASSERT_EQUAL_UINT8(28, shotLogSampleSizeForVersion(6));
    TEST_ASSERT_EQUAL_UINT8(30, shotLogSampleSizeForVersion(7));
    TEST_ASSERT_EQUAL_UINT8(34, shotLogSampleSizeForVersion(8));
    TEST_ASSERT_EQUAL_UINT32(SHOT_LOG_SAMPLE_SIZE, sizeof(ShotLogSample));
}
} // namespace

void setUp(void) {}
void tearDown(void) {}

int main(int argc, char **argv) {
    (void)argc;
    (void)argv;
    UNITY_BEGIN();
    RUN_TEST(test_versioned_sample_sizes_match_binary_layouts);
    return UNITY_END();
}
