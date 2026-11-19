// Unit tests: Bookoo Motto 80 protocol - fragment framing, requests and message parsing.
// Host-side, no ESP32/Arduino/NimBLE runtime - pio test -e native -f test_bookoo_motto.

#include <unity.h>

#include <string>
#include <vector>

#include "grinders/bookoo_motto_protocol.cpp"

using namespace motto;

void setUp() {}
void tearDown() {}

static const uint8_t *bytes(const std::string &packet) { return reinterpret_cast<const uint8_t *>(packet.data()); }

// Feeds every packet and returns the completed message, or "" when none completed.
static std::string reassemble(FrameReassembler &reassembler, const std::vector<std::string> &packets, uint32_t now = 0) {
    std::string message;
    for (const std::string &packet : packets) {
        reassembler.feed(bytes(packet), packet.size(), now, message);
    }
    return message;
}

static void test_handshake_fragments_match_reference() {
    // 20-byte packets as in the vendor's reference client: 8-byte header + up to 12 payload bytes.
    const std::string json = buildHandshakeRequest();
    TEST_ASSERT_EQUAL_STRING("{\"request\":{\"appHello\":{\"op\":\"handshake\"}}}", json.c_str());
    TEST_ASSERT_EQUAL(43, json.size());

    const std::vector<std::string> packets = encodeFragments(json, 1, 20);
    TEST_ASSERT_EQUAL(4, packets.size());
    const uint8_t expectedFirst[] = {0xA5, 0x01, 0x01, 0x00, 0x2B, 0x00, 0x00, 0x00, '{', '"',
                                     'r',  'e',  'q',  'u',  'e',  's',  't',  '"',  ':', '{'};
    TEST_ASSERT_EQUAL(sizeof(expectedFirst), packets[0].size());
    TEST_ASSERT_EQUAL_UINT8_ARRAY(expectedFirst, bytes(packets[0]), sizeof(expectedFirst));
    // Last packet: offset 36 (0x24), remaining 7 bytes.
    const uint8_t expectedLastHeader[] = {0xA5, 0x01, 0x01, 0x00, 0x2B, 0x00, 0x24, 0x00};
    TEST_ASSERT_EQUAL(8 + 7, packets[3].size());
    TEST_ASSERT_EQUAL_UINT8_ARRAY(expectedLastHeader, bytes(packets[3]), sizeof(expectedLastHeader));
}

static void test_single_packet_when_mtu_allows() {
    const std::string json = buildHandshakeRequest();
    const std::vector<std::string> packets = encodeFragments(json, 0xBEEF, packetLengthForMtu(255));
    TEST_ASSERT_EQUAL(1, packets.size());
    TEST_ASSERT_EQUAL(8 + json.size(), packets[0].size());
    TEST_ASSERT_EQUAL_HEX8(0xEF, static_cast<uint8_t>(packets[0][2]));
    TEST_ASSERT_EQUAL_HEX8(0xBE, static_cast<uint8_t>(packets[0][3]));
}

static void test_packet_length_follows_mtu() {
    TEST_ASSERT_EQUAL(20, packetLengthForMtu(0));
    TEST_ASSERT_EQUAL(20, packetLengthForMtu(23));
    TEST_ASSERT_EQUAL(252, packetLengthForMtu(255));
    TEST_ASSERT_EQUAL(512, packetLengthForMtu(517));
    TEST_ASSERT_EQUAL(512, packetLengthForMtu(1000));
}

static void test_encode_rejects_invalid_input() {
    TEST_ASSERT_TRUE(encodeFragments("", 1, 20).empty());
    TEST_ASSERT_TRUE(encodeFragments(std::string(4097, 'x'), 1, 20).empty());
    TEST_ASSERT_TRUE(encodeFragments("{}", 1, 8).empty());
    TEST_ASSERT_TRUE(encodeFragments("{}", 1, 513).empty());
    TEST_ASSERT_FALSE(encodeFragments(std::string(4096, 'x'), 1, 512).empty());
}

static void test_reassembly_round_trip() {
    const std::string json = "{\"broadcast\":{\"periodInfo\":{\"feedingRpm\":65,\"bladeGap\":500,\"grindRpm\":700}}}";
    for (size_t packetLength : {9u, 20u, 64u, 512u}) {
        FrameReassembler reassembler;
        TEST_ASSERT_EQUAL_STRING(json.c_str(), reassemble(reassembler, encodeFragments(json, 7, packetLength)).c_str());
    }
}

static void test_reassembly_restarts_on_offset_zero() {
    FrameReassembler reassembler;
    const std::vector<std::string> first = encodeFragments("{\"a\":\"0123456789012345678901234567890\"}", 1, 20);
    const std::vector<std::string> second = encodeFragments("{\"b\":1}", 2, 20);
    std::string message;
    TEST_ASSERT_FALSE(reassembler.feed(bytes(first[0]), first[0].size(), 0, message));
    // A new message replaces the unfinished one.
    TEST_ASSERT_TRUE(reassembler.feed(bytes(second[0]), second[0].size(), 10, message));
    TEST_ASSERT_EQUAL_STRING("{\"b\":1}", message.c_str());
}

static void test_reassembly_drops_out_of_order_and_mismatched() {
    const std::vector<std::string> packets = encodeFragments("{\"a\":\"0123456789012345678901234567890\"}", 1, 20);
    TEST_ASSERT_EQUAL(4, packets.size());
    std::string message;

    FrameReassembler skipped;
    TEST_ASSERT_FALSE(skipped.feed(bytes(packets[0]), packets[0].size(), 0, message));
    TEST_ASSERT_FALSE(skipped.feed(bytes(packets[2]), packets[2].size(), 0, message));
    // The message is gone: the remaining fragments no longer complete it.
    TEST_ASSERT_FALSE(skipped.feed(bytes(packets[1]), packets[1].size(), 0, message));
    TEST_ASSERT_FALSE(skipped.feed(bytes(packets[3]), packets[3].size(), 0, message));

    FrameReassembler otherSequence;
    std::string foreign = packets[1];
    foreign[2] = 0x09;
    TEST_ASSERT_FALSE(otherSequence.feed(bytes(packets[0]), packets[0].size(), 0, message));
    TEST_ASSERT_FALSE(otherSequence.feed(bytes(foreign), foreign.size(), 0, message));
    TEST_ASSERT_TRUE(message.empty());
}

static void test_reassembly_times_out() {
    const std::vector<std::string> packets = encodeFragments("{\"a\":\"0123456789012345678901234567890\"}", 1, 30);
    TEST_ASSERT_EQUAL(2, packets.size());
    std::string message;

    FrameReassembler inTime;
    TEST_ASSERT_FALSE(inTime.feed(bytes(packets[0]), packets[0].size(), 1000, message));
    TEST_ASSERT_TRUE(inTime.feed(bytes(packets[1]), packets[1].size(), 3000, message));

    FrameReassembler late;
    message.clear();
    TEST_ASSERT_FALSE(late.feed(bytes(packets[0]), packets[0].size(), 1000, message));
    TEST_ASSERT_FALSE(late.feed(bytes(packets[1]), packets[1].size(), 3001, message));
}

static void test_reassembly_rejects_malformed_packets() {
    FrameReassembler reassembler;
    std::string message;
    const std::string valid = encodeFragments("{\"b\":1}", 2, 20)[0];

    std::string badMagic = valid;
    badMagic[0] = 0x5A;
    TEST_ASSERT_FALSE(reassembler.feed(bytes(badMagic), badMagic.size(), 0, message));
    std::string badVersion = valid;
    badVersion[1] = 0x02;
    TEST_ASSERT_FALSE(reassembler.feed(bytes(badVersion), badVersion.size(), 0, message));
    // Header only, no payload.
    TEST_ASSERT_FALSE(reassembler.feed(bytes(valid), 8, 0, message));
    // Declared total shorter than the fragment.
    std::string overflow = valid;
    overflow[4] = 0x03;
    TEST_ASSERT_FALSE(reassembler.feed(bytes(overflow), overflow.size(), 0, message));
    // Total length zero and above the 4096 byte limit.
    std::string zero = valid;
    zero[4] = 0x00;
    TEST_ASSERT_FALSE(reassembler.feed(bytes(zero), zero.size(), 0, message));
    std::string huge = valid;
    huge[4] = 0x01;
    huge[5] = 0x10;
    TEST_ASSERT_FALSE(reassembler.feed(bytes(huge), huge.size(), 0, message));
    TEST_ASSERT_FALSE(reassembler.feed(nullptr, 0, 0, message));
    TEST_ASSERT_TRUE(message.empty());
    // Still usable afterwards.
    TEST_ASSERT_TRUE(reassembler.feed(bytes(valid), valid.size(), 0, message));
}

static void test_settings_request() {
    GrinderSettings all;
    all.grindSize = 500.4f;
    all.rpm = 700;
    all.feedRpm = 65;
    TEST_ASSERT_EQUAL_STRING(
        "{\"request\":{\"geneSetting\":{\"op\":\"set\",\"data\":{\"feedingRpm\":65,\"bladeGap\":500,\"grindRpm\":700}}}}",
        buildSettingsRequest(all).c_str());

    GrinderSettings rpmOnly;
    rpmOnly.rpm = 900;
    TEST_ASSERT_EQUAL_STRING("{\"request\":{\"geneSetting\":{\"op\":\"set\",\"data\":{\"grindRpm\":900}}}}",
                             buildSettingsRequest(rpmOnly).c_str());

    TEST_ASSERT_TRUE(buildSettingsRequest(GrinderSettings{}).empty());
}

static void test_settings_request_clamps_to_device_ranges() {
    GrinderSettings low;
    low.grindSize = 0.0f;
    low.rpm = 0;
    low.feedRpm = 1;
    TEST_ASSERT_EQUAL_STRING(
        "{\"request\":{\"geneSetting\":{\"op\":\"set\",\"data\":{\"feedingRpm\":10,\"bladeGap\":0,\"grindRpm\":500}}}}",
        buildSettingsRequest(low).c_str());

    GrinderSettings high;
    high.grindSize = 5000.0f;
    high.rpm = 9999;
    high.feedRpm = 500;
    TEST_ASSERT_EQUAL_STRING(
        "{\"request\":{\"geneSetting\":{\"op\":\"set\",\"data\":{\"feedingRpm\":65,\"bladeGap\":999,\"grindRpm\":1500}}}}",
        buildSettingsRequest(high).c_str());
}

static void test_parse_period_info() {
    Message message;
    TEST_ASSERT_TRUE(
        parseMessage("{\"broadcast\":{\"periodInfo\":{\"feedingRpm\":65,\"bladeGap\":500,\"grindRpm\":700,\"humidity\":25,"
                     "\"devState\":\"IDLE\",\"netState\":\"CONNECTED\",\"totalGrinds\":120,\"cupDetect\":true,\"autoStop\":true,"
                     "\"fastClean\":true,\"brightness\":5,\"standbySec\":60,\"selectPreset\":-1}}}",
                     message));
    TEST_ASSERT_TRUE(message.hasPeriodInfo);
    TEST_ASSERT_FALSE(message.hasBaseInfo);
    TEST_ASSERT_FALSE(message.hasSettingsResponse);
    TEST_ASSERT_EQUAL_FLOAT(500.0f, message.reported.grindSize);
    TEST_ASSERT_EQUAL(700, message.reported.rpm);
    TEST_ASSERT_EQUAL(65, message.reported.feedRpm);
    TEST_ASSERT_EQUAL(static_cast<int>(GrinderState::IDLE), static_cast<int>(message.state));
    TEST_ASSERT_EQUAL(-1, message.selectedPreset);
}

static void test_parse_first_broadcast_with_base_info() {
    Message message;
    TEST_ASSERT_TRUE(parseMessage(
        "{\"broadcast\":{\"baseInfo\":{\"releaseVer\":102190820,\"snCode\":\"SN0000000MT12355\",\"wifiName\":null},"
        "\"periodInfo\":{\"feedingRpm\":40,\"bladeGap\":180,\"grindRpm\":1100,\"devState\":\"GRINDING\",\"selectPreset\":3}}}",
        message));
    TEST_ASSERT_TRUE(message.hasBaseInfo);
    TEST_ASSERT_EQUAL_UINT32(102190820u, message.releaseVersion);
    TEST_ASSERT_EQUAL_STRING("SN0000000MT12355", message.serialNumber.c_str());
    TEST_ASSERT_TRUE(message.hasPeriodInfo);
    TEST_ASSERT_EQUAL(static_cast<int>(GrinderState::GRINDING), static_cast<int>(message.state));
    TEST_ASSERT_EQUAL(3, message.selectedPreset);
}

static void test_parse_settings_responses() {
    Message ok;
    TEST_ASSERT_TRUE(parseMessage(
        "{\"response\":{\"geneSetting\":{\"result\":\"success\",\"data\":{\"feedingRpm\":65,\"grindRpm\":700}}}}", ok));
    TEST_ASSERT_TRUE(ok.hasSettingsResponse);
    TEST_ASSERT_TRUE(ok.settingsAccepted);
    TEST_ASSERT_FALSE(ok.hasPeriodInfo);

    Message fail;
    TEST_ASSERT_TRUE(parseMessage("{\"response\":{\"geneSetting\":{\"result\":\"fail\",\"error\":{\"code\":\"OUT_OF_RANGE\","
                                  "\"message\":\"feedingRpm out of range\",\"field\":\"feedingRpm\"}}}}",
                                  fail));
    TEST_ASSERT_TRUE(fail.hasSettingsResponse);
    TEST_ASSERT_FALSE(fail.settingsAccepted);
    TEST_ASSERT_EQUAL_STRING("OUT_OF_RANGE", fail.errorCode.c_str());
    TEST_ASSERT_EQUAL_STRING("feedingRpm out of range", fail.errorMessage.c_str());
    TEST_ASSERT_EQUAL_STRING("feedingRpm", fail.errorField.c_str());

    // Responses to other business objects are not settings responses.
    Message other;
    TEST_ASSERT_TRUE(parseMessage("{\"response\":{\"grindPreset\":{\"result\":\"success\",\"data\":[]}}}", other));
    TEST_ASSERT_FALSE(other.hasSettingsResponse);
}

static void test_parse_tolerates_unknown_and_missing_fields() {
    Message message;
    TEST_ASSERT_TRUE(parseMessage("{\"broadcast\":{\"periodInfo\":{\"devState\":\"SOMETHING_NEW\",\"future\":[1,2]}}}", message));
    TEST_ASSERT_TRUE(message.hasPeriodInfo);
    TEST_ASSERT_EQUAL(static_cast<int>(GrinderState::UNKNOWN), static_cast<int>(message.state));
    TEST_ASSERT_FALSE(message.reported.hasGrindSize());
    TEST_ASSERT_FALSE(message.reported.hasRpm());
    TEST_ASSERT_FALSE(message.reported.hasFeedRpm());

    Message invalid;
    TEST_ASSERT_FALSE(parseMessage("{\"broadcast\":{\"periodInfo\":", invalid));
    TEST_ASSERT_FALSE(invalid.hasPeriodInfo);
}

static void test_device_state_mapping() {
    TEST_ASSERT_EQUAL(static_cast<int>(GrinderState::IDLE), static_cast<int>(parseDeviceState("IDLE")));
    TEST_ASSERT_EQUAL(static_cast<int>(GrinderState::GRINDING), static_cast<int>(parseDeviceState("GRINDING")));
    for (const char *busy : {"SETTING", "UPDATING", "WARNING", "HIGHSPEEDCLEAN", "BOOTGUIDE", "ADJUSTMENTPURGE"}) {
        TEST_ASSERT_EQUAL_MESSAGE(static_cast<int>(GrinderState::BUSY), static_cast<int>(parseDeviceState(busy)), busy);
    }
    // Mixed-case names of grinder firmware before v1.3.11.1020.
    TEST_ASSERT_EQUAL(static_cast<int>(GrinderState::BUSY), static_cast<int>(parseDeviceState("HighSpeedClean")));
    TEST_ASSERT_EQUAL(static_cast<int>(GrinderState::BUSY), static_cast<int>(parseDeviceState("BootGuide")));
    TEST_ASSERT_EQUAL(static_cast<int>(GrinderState::UNKNOWN), static_cast<int>(parseDeviceState("UNKNOWN")));
    TEST_ASSERT_EQUAL(static_cast<int>(GrinderState::UNKNOWN), static_cast<int>(parseDeviceState("IDLEX")));
    TEST_ASSERT_EQUAL(static_cast<int>(GrinderState::UNKNOWN), static_cast<int>(parseDeviceState("")));
    TEST_ASSERT_EQUAL(static_cast<int>(GrinderState::UNKNOWN), static_cast<int>(parseDeviceState(nullptr)));
}

int main(int, char **) {
    UNITY_BEGIN();
    RUN_TEST(test_handshake_fragments_match_reference);
    RUN_TEST(test_single_packet_when_mtu_allows);
    RUN_TEST(test_packet_length_follows_mtu);
    RUN_TEST(test_encode_rejects_invalid_input);
    RUN_TEST(test_reassembly_round_trip);
    RUN_TEST(test_reassembly_restarts_on_offset_zero);
    RUN_TEST(test_reassembly_drops_out_of_order_and_mismatched);
    RUN_TEST(test_reassembly_times_out);
    RUN_TEST(test_reassembly_rejects_malformed_packets);
    RUN_TEST(test_settings_request);
    RUN_TEST(test_settings_request_clamps_to_device_ranges);
    RUN_TEST(test_parse_period_info);
    RUN_TEST(test_parse_first_broadcast_with_base_info);
    RUN_TEST(test_parse_settings_responses);
    RUN_TEST(test_parse_tolerates_unknown_and_missing_fields);
    RUN_TEST(test_device_state_mapping);
    return UNITY_END();
}
