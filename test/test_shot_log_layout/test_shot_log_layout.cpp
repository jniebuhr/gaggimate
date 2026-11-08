#include <unity.h>
#include <initializer_list>
#include <display/models/shot_log_format.h>

void setUp() {}
void tearDown() {}

void test_legacy_and_current_layouts() {
    ShotLogHeader h{};
    h.fieldsMask = 0x1FFF;
    h.version = 5;
    h.reserved0 = 26;
    TEST_ASSERT_FALSE(shotLogHasElapsedTimestamp(h));
    TEST_ASSERT_EQUAL_UINT8(26, shotLogSampleSize(h));
    h.version = 6;
    TEST_ASSERT_FALSE(shotLogHasElapsedTimestamp(h));
    TEST_ASSERT_EQUAL_UINT8(26, shotLogSampleSize(h));
    h.reserved0 = 28;
    TEST_ASSERT_TRUE(shotLogHasElapsedTimestamp(h));
    TEST_ASSERT_EQUAL_UINT8(28, shotLogSampleSize(h));
    h.fieldsMask = 0x3FFF;
    h.reserved0 = 30;
    for (uint8_t version : {7, 8}) {
        h.version = version;
        TEST_ASSERT_TRUE(shotLogHasElapsedTimestamp(h));
        TEST_ASSERT_EQUAL_UINT8(30, shotLogSampleSize(h));
    }
    h.reserved0 = 26;
    TEST_ASSERT_EQUAL_UINT8(0, shotLogSampleSize(h));
}

int main() {
    UNITY_BEGIN();
    RUN_TEST(test_legacy_and_current_layouts);
    return UNITY_END();
}
