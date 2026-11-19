#include "bookoo_motto_protocol.h"
#include <ArduinoJson.h>
#include <algorithm>
#include <cctype>
#include <cmath>
#include <cstdio>
#include <cstring>

namespace motto {

static uint16_t readLE16(const uint8_t *data) { return static_cast<uint16_t>(data[0] | (data[1] << 8)); }

static void appendLE16(std::string &out, uint16_t value) {
    out.push_back(static_cast<char>(value & 0xFF));
    out.push_back(static_cast<char>(value >> 8));
}

size_t packetLengthForMtu(uint16_t mtu) {
    const size_t attPayload = mtu > 3 ? static_cast<size_t>(mtu) - 3 : 0;
    return std::min(std::max(attPayload, PACKET_MIN_LENGTH), PACKET_MAX_LENGTH);
}

std::vector<std::string> encodeFragments(const std::string &json, uint16_t sequence, size_t packetLength) {
    std::vector<std::string> packets;
    if (json.empty() || json.size() > MESSAGE_MAX_LENGTH || packetLength <= FRAME_HEADER_LENGTH ||
        packetLength > PACKET_MAX_LENGTH) {
        return packets;
    }
    const size_t capacity = packetLength - FRAME_HEADER_LENGTH;
    for (size_t offset = 0; offset < json.size(); offset += capacity) {
        std::string packet;
        packet.reserve(packetLength);
        packet.push_back(static_cast<char>(FRAME_MAGIC));
        packet.push_back(static_cast<char>(FRAME_VERSION));
        appendLE16(packet, sequence);
        appendLE16(packet, static_cast<uint16_t>(json.size()));
        appendLE16(packet, static_cast<uint16_t>(offset));
        packet.append(json, offset, capacity);
        packets.push_back(std::move(packet));
    }
    return packets;
}

void FrameReassembler::reset() {
    active = false;
    sequence = 0;
    totalLength = 0;
    payload.clear();
}

bool FrameReassembler::feed(const uint8_t *packet, size_t length, uint32_t nowMs, std::string &message) {
    if (active && nowMs - lastFragmentAt > REASSEMBLY_TIMEOUT_MS) {
        reset();
    }
    if (packet == nullptr || length <= FRAME_HEADER_LENGTH || packet[0] != FRAME_MAGIC || packet[1] != FRAME_VERSION) {
        reset();
        return false;
    }
    const uint16_t packetSequence = readLE16(packet + 2);
    const size_t packetTotal = readLE16(packet + 4);
    const size_t offset = readLE16(packet + 6);
    const size_t fragmentLength = length - FRAME_HEADER_LENGTH;
    if (packetTotal == 0 || packetTotal > MESSAGE_MAX_LENGTH || offset >= packetTotal || fragmentLength > packetTotal - offset) {
        reset();
        return false;
    }
    if (offset == 0) {
        // Offset zero always starts a new message and replaces an unfinished one.
        active = true;
        sequence = packetSequence;
        totalLength = packetTotal;
        payload.clear();
        payload.reserve(packetTotal);
    } else if (!active || packetSequence != sequence || packetTotal != totalLength || offset != payload.size()) {
        reset();
        return false;
    }
    payload.append(reinterpret_cast<const char *>(packet + FRAME_HEADER_LENGTH), fragmentLength);
    lastFragmentAt = nowMs;
    if (payload.size() != totalLength) {
        return false;
    }
    message = std::move(payload);
    reset();
    return true;
}

std::string buildHandshakeRequest() { return R"({"request":{"appHello":{"op":"handshake"}}})"; }

static int clampTo(long value, int low, int high) { return static_cast<int>(std::min<long>(std::max<long>(value, low), high)); }

std::string buildSettingsRequest(const GrinderSettings &settings) {
    if (settings.isEmpty()) {
        return "";
    }
    std::string fields;
    const auto append = [&fields](const char *key, int value) {
        char entry[32];
        snprintf(entry, sizeof(entry), "%s\"%s\":%d", fields.empty() ? "" : ",", key, value);
        fields += entry;
    };
    if (settings.hasFeedRpm()) {
        append("feedingRpm", clampTo(settings.feedRpm, FEED_RPM_MIN, FEED_RPM_MAX));
    }
    if (settings.hasGrindSize()) {
        append("bladeGap", clampTo(std::lround(settings.grindSize), GRIND_SIZE_MIN, GRIND_SIZE_MAX));
    }
    if (settings.hasRpm()) {
        append("grindRpm", clampTo(settings.rpm, RPM_MIN, RPM_MAX));
    }
    return R"({"request":{"geneSetting":{"op":"set","data":{)" + fields + "}}}}";
}

static bool equalsIgnoreCase(const char *a, const char *b) {
    for (; *a != '\0' && *b != '\0'; a++, b++) {
        if (std::tolower(static_cast<unsigned char>(*a)) != std::tolower(static_cast<unsigned char>(*b))) {
            return false;
        }
    }
    return *a == *b;
}

GrinderState parseDeviceState(const char *devState) {
    if (devState == nullptr) {
        return GrinderState::UNKNOWN;
    }
    if (equalsIgnoreCase(devState, "IDLE")) {
        return GrinderState::IDLE;
    }
    if (equalsIgnoreCase(devState, "GRINDING")) {
        return GrinderState::GRINDING;
    }
    // Firmware before v1.3.11.1020 used mixed case for some states, hence the case-insensitive match.
    static const char *const BUSY_STATES[] = {"SETTING", "UPDATING", "WARNING", "HIGHSPEEDCLEAN", "BOOTGUIDE", "ADJUSTMENTPURGE"};
    for (const char *busy : BUSY_STATES) {
        if (equalsIgnoreCase(devState, busy)) {
            return GrinderState::BUSY;
        }
    }
    return GrinderState::UNKNOWN;
}

bool parseMessage(const std::string &json, Message &message) {
    JsonDocument doc;
    if (deserializeJson(doc, json.data(), json.size()) != DeserializationError::Ok) {
        return false;
    }

    JsonVariantConst period = doc["broadcast"]["periodInfo"];
    if (period.is<JsonObjectConst>()) {
        message.hasPeriodInfo = true;
        message.reported.grindSize = period["bladeGap"] | -1.0f;
        message.reported.rpm = period["grindRpm"] | -1;
        message.reported.feedRpm = period["feedingRpm"] | -1;
        message.state = parseDeviceState(period["devState"] | static_cast<const char *>(nullptr));
        message.selectedPreset = period["selectPreset"] | -1;
    }

    JsonVariantConst base = doc["broadcast"]["baseInfo"];
    if (base.is<JsonObjectConst>()) {
        message.hasBaseInfo = true;
        message.releaseVersion = base["releaseVer"] | 0u;
        message.serialNumber = base["snCode"] | "";
    }

    JsonVariantConst settings = doc["response"]["geneSetting"];
    if (settings.is<JsonObjectConst>()) {
        message.hasSettingsResponse = true;
        message.settingsAccepted = strcmp(settings["result"] | "", "success") == 0;
        message.errorCode = settings["error"]["code"] | "";
        message.errorMessage = settings["error"]["message"] | "";
        message.errorField = settings["error"]["field"] | "";
    }
    return true;
}

} // namespace motto
