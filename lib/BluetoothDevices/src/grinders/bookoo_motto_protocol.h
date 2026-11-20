#pragma once
#include "GrinderSettings.h"
#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

// Bookoo Motto 80 (MT80) Custom GATT protocol: UTF-8 JSON messages carried in fragment frames (v1).
// Spec: https://github.com/BooKooCode/OpenSource/tree/main/bookoo_motto80
namespace motto {

constexpr const char *SERVICE_UUID = "4d543830-0001-4b80-8f00-424f4f4b4f4f";
constexpr const char *RX_CHARACTERISTIC_UUID = "4d543830-0002-4b80-8f00-424f4f4b4f4f"; // client -> grinder
constexpr const char *TX_CHARACTERISTIC_UUID = "4d543830-0003-4b80-8f00-424f4f4b4f4f"; // grinder -> client
constexpr const char *DEVICE_NAME_PREFIX = "BOOKOO MT80";

// Frame: magic, version, sequence LE16, total JSON length LE16, payload offset LE16, payload.
constexpr uint8_t FRAME_MAGIC = 0xA5;
constexpr uint8_t FRAME_VERSION = 0x01;
constexpr size_t FRAME_HEADER_LENGTH = 8;
constexpr size_t MESSAGE_MAX_LENGTH = 4096;
constexpr size_t PACKET_MIN_LENGTH = 20; // fits the default ATT MTU of 23
constexpr size_t PACKET_MAX_LENGTH = 512;
constexpr uint32_t REASSEMBLY_TIMEOUT_MS = 2000;

// Value ranges the grinder accepts; anything outside makes it reject the whole request.
constexpr int GRIND_SIZE_MIN = 0; // burr gap in µm
constexpr int GRIND_SIZE_MAX = 999;
constexpr int RPM_MIN = 500;
constexpr int RPM_MAX = 1500;
constexpr int FEED_RPM_MIN = 10;
constexpr int FEED_RPM_MAX = 65;

// User presets: the grinder shows up to 10, indexed 0-9 without gaps; -1 selects N mode (no preset).
constexpr int PRESET_LIMIT = 10;
constexpr int PRESET_NONE = -1;
constexpr size_t PRESET_NAME_MAX_BYTES = 32;
// Fixed id of the preset GaggiMate owns ("gaggimate" in hex, zero padded to the required 32 characters).
constexpr const char *GAGGIMATE_PRESET_UID = "67616767696d61746500000000000000";
constexpr const char *GAGGIMATE_PRESET_NAME = "GaggiMate";

// Largest packet for a connection: ATT payload (MTU - 3) limited to the protocol's bounds.
size_t packetLengthForMtu(uint16_t mtu);

// Splits one JSON message into ordered packets of at most packetLength bytes; empty when the input is invalid.
std::vector<std::string> encodeFragments(const std::string &json, uint16_t sequence, size_t packetLength);

// Rebuilds JSON messages from notification packets; one message at a time, as the grinder sends them.
class FrameReassembler {
  public:
    // Returns true and fills message once a packet completes a message; invalid packets drop the partial message.
    bool feed(const uint8_t *packet, size_t length, uint32_t nowMs, std::string &message);
    void reset();

  private:
    bool active = false;
    uint16_t sequence = 0;
    size_t totalLength = 0;
    uint32_t lastFragmentAt = 0;
    std::string payload;
};

// Starts the session: the grinder answers with baseInfo once and periodInfo at 5 Hz.
std::string buildHandshakeRequest();

// geneSetting "set" request with the set fields clamped to the grinder's ranges; empty when nothing is set.
std::string buildSettingsRequest(const GrinderSettings &settings);

// Reads the three general (N mode) values, used to fill what a recipe leaves unset.
std::string buildGeneralSettingsQuery();

// Preset name for a recipe: its label, shortened to make room for the dose ("Espresso 18g"), at most 32 bytes of UTF-8.
std::string buildPresetName(const std::string &label, float dose);

std::string buildPresetListRequest();
// A preset needs all three values; they are clamped to the grinder's ranges.
std::string buildPresetAddRequest(const std::string &uid, int index, const std::string &name, const GrinderSettings &values);
std::string buildPresetUpdateRequest(const std::string &uid, const std::string &name, const GrinderSettings &values);
// Brings a deleted preset back from the grinder's recycle bin, at the end of the list.
std::string buildPresetRestoreRequest(const std::string &uid);
// Switches the grinder to a preset by index, or to N mode with PRESET_NONE.
std::string buildSelectPresetRequest(int index);

// Maps a devState string to the generic grinder state; unlisted states are reported as UNKNOWN.
GrinderState parseDeviceState(const char *devState);

struct Message {
    // broadcast.periodInfo
    bool hasPeriodInfo = false;
    GrinderSettings reported;
    GrinderState state = GrinderState::UNKNOWN;
    int selectedPreset = -1; // -1 = N mode, 0-9 = user preset

    // broadcast.baseInfo
    bool hasBaseInfo = false;
    uint32_t releaseVersion = 0;
    std::string serialNumber;

    // response.geneSetting; general holds the values of a "get" answer
    bool hasSettingsResponse = false;
    bool settingsAccepted = false;
    GrinderSettings general;

    // response.grindPreset: a list answer fills presetUids (in list order), a single-preset answer presetIndex
    bool hasPresetResponse = false;
    bool presetAccepted = false;
    bool presetList = false;
    std::vector<std::string> presetUids;
    int presetIndex = PRESET_NONE;

    // error of a failed response
    std::string errorCode;
    std::string errorMessage;
    std::string errorField;
};

// Parses one reassembled JSON message; false when it is not valid JSON.
bool parseMessage(const std::string &json, Message &message);

} // namespace motto
