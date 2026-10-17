// Host shim for Arduino WiFi.h. STA begin() immediately "connects" and fires the
// registered events so the firmware's Wi-Fi flow runs; otherwise it stays in AP
// mode. Just enough surface for Controller::setupWifi and the UI status checks.
#pragma once

#include "IPAddress.h"
#include "WString.h"
#include <cstring>
#include <functional>
#include <stdint.h>
#include <utility>
#include <vector>

typedef enum {
    WL_IDLE_STATUS = 0,
    WL_NO_SSID_AVAIL = 1,
    WL_SCAN_COMPLETED = 2,
    WL_CONNECTED = 3,
    WL_CONNECT_FAILED = 4,
    WL_CONNECTION_LOST = 5,
    WL_DISCONNECTED = 6
} wl_status_t;

typedef enum {
    WIFI_MODE_NULL = 0,
    WIFI_MODE_STA = 1,
    WIFI_MODE_AP = 2,
    WIFI_MODE_APSTA = 3,
    WIFI_STA = WIFI_MODE_STA,
    WIFI_AP = WIFI_MODE_AP,
    WIFI_AP_STA = WIFI_MODE_APSTA
} wifi_mode_t;
typedef enum { WIFI_AUTH_OPEN = 0, WIFI_AUTH_WPA2_PSK = 3 } wifi_auth_mode_t;
#define WIFI_SCAN_RUNNING (-1)
#define WIFI_SCAN_FAILED (-2)
typedef enum { WIFI_POWER_19_5dBm = 78, WIFI_POWER_15dBm = 60, WIFI_POWER_7dBm = 28, WIFI_POWER_MINUS_1dBm = -4 } wifi_power_t;
typedef int wifi_err_reason_t;

typedef enum {
    ARDUINO_EVENT_WIFI_STA_CONNECTED,
    ARDUINO_EVENT_WIFI_STA_DISCONNECTED,
    ARDUINO_EVENT_WIFI_STA_GOT_IP,
    ARDUINO_EVENT_WIFI_STA_LOST_IP,
    ARDUINO_EVENT_WIFI_STA_AUTHMODE_CHANGE,
    ARDUINO_EVENT_WIFI_SCAN_DONE,
    ARDUINO_EVENT_MAX
} WiFiEvent_t;
typedef WiFiEvent_t arduino_event_id_t;

// Subset of the ESP-IDF event-info union accessed by the firmware.
struct sim_ip4 {
    uint32_t addr;
};
struct sim_ip_info {
    sim_ip4 ip;
    sim_ip4 netmask;
    sim_ip4 gw;
};
struct sim_got_ip {
    sim_ip_info ip_info;
};
struct sim_sta_connected {
    uint8_t ssid[32];
    uint8_t ssid_len;
    uint8_t bssid[6];
    uint8_t channel;
    uint8_t authmode;
};
struct sim_sta_disconnected {
    uint8_t ssid[32];
    uint8_t ssid_len;
    uint8_t bssid[6];
    uint8_t reason;
};
struct sim_authmode_change {
    uint8_t old_mode;
    uint8_t new_mode;
};
typedef union {
    sim_got_ip got_ip;
    sim_sta_connected wifi_sta_connected;
    sim_sta_disconnected wifi_sta_disconnected;
    sim_authmode_change wifi_sta_authmode_change;
} WiFiEventInfo_t;

typedef std::function<void(WiFiEvent_t, WiFiEventInfo_t)> WiFiEventFuncCb;

class WiFiClass {
  public:
    void setHostname(const char *) {}
    bool mode(wifi_mode_t m) {
        _mode = m;
        return true;
    }
    wifi_mode_t getMode() { return _mode; }
    void setAutoReconnect(bool) {}
    bool config(IPAddress, IPAddress, IPAddress, IPAddress = IPAddress()) { return true; }
    void onEvent(WiFiEventFuncCb cb, WiFiEvent_t id = ARDUINO_EVENT_MAX) { _cbs.emplace_back(id, std::move(cb)); }

    bool begin(const char *ssid, const char *pass = nullptr) {
        (void)ssid;
        (void)pass;
        _status = WL_CONNECTED;
        _ip = IPAddress(192, 168, 1, 123);
        fireConnect();
        return true;
    }
    bool begin(const String &ssid, const String &pass) { return begin(ssid.c_str(), pass.c_str()); }
    void setTxPower(wifi_power_t) {}
    wl_status_t status() { return _status; }
    IPAddress localIP() { return _ip; }
    bool disconnect(bool = false, bool = false) {
        _status = WL_DISCONNECTED;
        return true;
    }
    const char *disconnectReasonName(wifi_err_reason_t) { return "SIM"; }

    bool softAP(const char *ssid, const char *pass = nullptr) {
        (void)ssid;
        (void)pass;
        _ip = IPAddress(4, 4, 4, 1);
        return true;
    }
    bool softAPConfig(IPAddress, IPAddress, IPAddress) { return true; }
    IPAddress softAPIP() { return IPAddress(4, 4, 4, 1); }
    int softAPgetStationNum() { return 0; }
    String macAddress() { return String("AA:BB:CC:DD:EE:FF"); }
    // Fake neighbourhood for the setup wizard; results are ready immediately and SCAN_DONE fires synchronously.
    int16_t scanNetworks(bool = false) {
        _scan = {{"HomeNetwork", -48, WIFI_AUTH_WPA2_PSK, 6},
                 {"HomeNetwork", -71, WIFI_AUTH_WPA2_PSK, 11},
                 {"Neighbour 5G", -77, WIFI_AUTH_WPA2_PSK, 1},
                 {"CoffeeShop Guest", -82, WIFI_AUTH_OPEN, 1}};
        WiFiEventInfo_t info;
        memset(&info, 0, sizeof(info));
        for (auto &c : _cbs)
            if (c.first == ARDUINO_EVENT_WIFI_SCAN_DONE)
                c.second(ARDUINO_EVENT_WIFI_SCAN_DONE, info);
        return WIFI_SCAN_RUNNING;
    }
    int16_t scanComplete() { return static_cast<int16_t>(_scan.size()); }
    void scanDelete() { _scan.clear(); }
    String SSID(uint8_t i) { return i < _scan.size() ? String(_scan[i].ssid) : String(); }
    int32_t RSSI(uint8_t i) { return i < _scan.size() ? _scan[i].rssi : 0; }
    wifi_auth_mode_t encryptionType(uint8_t i) { return i < _scan.size() ? _scan[i].auth : WIFI_AUTH_OPEN; }
    int32_t channel(uint8_t i) { return i < _scan.size() ? _scan[i].channel : 0; }

  private:
    void fireConnect() {
        WiFiEventInfo_t info;
        memset(&info, 0, sizeof(info));
        for (auto &c : _cbs)
            if (c.first == ARDUINO_EVENT_WIFI_STA_CONNECTED)
                c.second(ARDUINO_EVENT_WIFI_STA_CONNECTED, info);
        for (auto &c : _cbs)
            if (c.first == ARDUINO_EVENT_WIFI_STA_GOT_IP)
                c.second(ARDUINO_EVENT_WIFI_STA_GOT_IP, info);
    }

    struct ScanResult {
        const char *ssid;
        int32_t rssi;
        wifi_auth_mode_t auth;
        int32_t channel;
    };
    std::vector<ScanResult> _scan;
    std::vector<std::pair<WiFiEvent_t, WiFiEventFuncCb>> _cbs;
    wl_status_t _status = WL_DISCONNECTED;
    wifi_mode_t _mode = WIFI_MODE_NULL;
    IPAddress _ip{0, 0, 0, 0};
};

extern WiFiClass WiFi;
