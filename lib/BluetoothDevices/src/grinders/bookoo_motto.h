#pragma once
#include "BluetoothDeviceRegistry.h"
#include "BluetoothGrinder.h"
#include "bookoo_motto_protocol.h"
#include <mutex>
#include <string>
#include <vector>

// Bookoo Motto 80 grinder; needs grinder firmware v1.2.19.0820 or newer for the Custom GATT service.
class BookooMottoGrinder : public BluetoothGrinder {
  public:
    explicit BookooMottoGrinder(const DiscoveredDevice &device);
    // Ends the link before the members the notification callback uses are destroyed.
    ~BookooMottoGrinder() override { clientCleanup(); }

    bool connect() override;
    void disconnect() override;
    bool isConnected() override;
    void update() override;

    // Written to a GaggiMate-owned preset that is then selected; the burr gap itself stays manual on the Motto 80.
    bool applySettings(const GrinderSettings &settings) override;
    bool supportsGrindSize() const override { return true; }
    bool supportsRpm() const override { return true; }
    bool supportsFeedRpm() const override { return true; }

  private:
    // One request is in flight at a time; responses carry no id, so the step says which answer is expected.
    enum class Step : uint8_t {
        NONE,
        QUEUED,
        FETCH_GENERAL,  // read the N mode values for fields the recipe leaves unset
        LIST_PRESETS,   // look for the GaggiMate preset
        RESTORE_PRESET, // it sits in the grinder's recycle bin
        WRITE_PRESET,   // add or update it
        SELECT_PRESET,
        WRITE_GENERAL, // no preset slot free: fall back to the general settings
        WAIT_FOR_IDLE,
    };

    // Pending inbound messages are capped so a stalled update() cannot grow the queue without bound.
    static constexpr size_t INBOX_LIMIT = 16;
    static constexpr uint32_t RESPONSE_TIMEOUT_MS = 5000;
    static constexpr uint8_t SETTINGS_MAX_ATTEMPTS = 3;

    NimBLERemoteCharacteristic *rxCharacteristic = nullptr;
    NimBLERemoteCharacteristic *txCharacteristic = nullptr;

    // Written by the NimBLE host task only.
    motto::FrameReassembler reassembler;
    // Handed from the NimBLE host task to update() under inboxMutex.
    std::mutex inboxMutex;
    std::vector<std::string> inbox;

    // Everything below belongs to the task that calls update().
    bool ready = false; // first periodInfo received, the grinder accepts requests
    uint16_t sequence = 0;
    GrinderSettings pendingSettings;
    GrinderSettings presetValues; // pendingSettings with the unset fields filled in
    Step step = Step::NONE;
    uint8_t settingsAttempts = 0;
    uint32_t requestSentAt = 0;

    bool discoverCharacteristics();
    void onNotification(const uint8_t *data, size_t length);
    void handleMessage(const std::string &json);
    void handleResponse(const motto::Message &message);
    bool sendJson(const std::string &json);
    void startTransfer();
    void sendRequest(Step next, const std::string &json);
    void failTransfer(const motto::Message &message);
};

class BookooMottoGrinderPlugin {
  public:
    static void apply() {
        BluetoothDeviceRegistry::getInstance()->registerDriver<BookooMottoGrinder>("plugin-bookoo-motto",
                                                                                   &BookooMottoGrinderPlugin::handles);
    }

  private:
    // Advertised as "BOOKOO MT80 xxxxxxxx"; the service UUID is not part of the advertisement.
    static bool handles(const DiscoveredDevice &device) { return device.getName().rfind(motto::DEVICE_NAME_PREFIX, 0) == 0; }
};
