#ifndef BLE_SERVER_H
#define BLE_SERVER_H

#include <Arduino.h>
#include <functional>
#include <NimBLEDevice.h>
#include <ble_ota_dfu.hpp>

// Transport-agnostic callback for raw data received
using ble_data_callback_t = std::function<void(const uint8_t* data, size_t length)>;
using ble_connection_callback_t = std::function<void(bool connected)>;

/**
 * Pure BLE server transport layer.
 * This class handles BLE advertising and data transmission but doesn't know about protocols.
 * It can send/receive raw byte arrays over BLE characteristics.
 */
class BLETransportServer : public NimBLEServerCallbacks, public NimBLECharacteristicCallbacks {
public:
    BLETransportServer();
    ~BLETransportServer();
    
    // Server management
    void initServer(const String& deviceName);
    bool isConnected() const;
    void startAdvertising();
    void stopAdvertising();
    
    // Raw data transmission
    bool sendData(const uint8_t* data, size_t length);
    
    // Register callback for received data
    void registerDataCallback(const ble_data_callback_t& callback);
    
    // Register callback for connection state changes
    void registerConnectionCallback(const ble_connection_callback_t& callback);
    
    // Device info
    void setDeviceInfo(const String& info);
    String getDeviceInfo() const;

private:
    bool deviceConnected;
    String deviceInfo;
    
    // BLE objects
    NimBLEServer* server;
    NimBLEService* service;
    NimBLECharacteristic* rx_char = nullptr;  // For receiving data from client
    NimBLECharacteristic* tx_char = nullptr;  // For sending data to client
    // Note: info_char removed - using nanopb messages for system info
    
    ble_data_callback_t data_callback = nullptr;
    ble_connection_callback_t connection_callback = nullptr;
    BLE_OTA_DFU ota_dfu_ble;
    
    // BLE callback overrides
    void onConnect(NimBLEServer* pServer) override;
    void onDisconnect(NimBLEServer* pServer) override;
    void onWrite(NimBLECharacteristic* pCharacteristic) override;
    
    // Service and characteristic UUIDs
    static const char* SERVICE_UUID;
    static const char* RX_CHAR_UUID;  // For receiving data from client
    static const char* TX_CHAR_UUID;  // For sending data to client
    // Note: INFO_CHAR_UUID removed - using nanopb messages for system info
};

#endif // BLE_SERVER_H