#include "MatterPlugin.h"

#ifdef GAGGIMATE_MATTER

#include "../core/BLECoordinator.h"
#include "../core/Controller.h"
#include "../core/Event.h"
#include "../core/PluginManager.h"
#include "../core/constants.h"
#include <app-common/zap-generated/ids/Attributes.h>
#include <app-common/zap-generated/ids/Clusters.h>
#include <app/server/OnboardingCodesUtil.h>
#include <app/server/Server.h>
#include <cstring>
#include <esp_log.h>
#include <esp_matter.h>
#include <esp_matter_attribute_utils.h>
#include <esp_matter_core.h>
#include <esp_matter_endpoint.h>
#include <platform/CHIPDeviceEvent.h>
#include <platform/CommissionableDataProvider.h>
#include <platform/ConnectivityManager.h>
#include <platform/DeviceInstanceInfoProvider.h>

static constexpr char LOG_TAG[] = "MatterPlugin";

// Vendor-specific device type ID until CSA assigns one for espresso machines.
// Matter 1.4 does not define a Coffee Maker type; `0xFFF1xxxx` is the hobby range.
static constexpr uint32_t kGaggiMateDeviceTypeId = 0xFFF1FC01;
static constexpr uint8_t kGaggiMateDeviceTypeVersion = 1;

// Identity strings surfaced to Matter controllers. BLE GAP name is shown
// during commissioning; NodeLabel/VendorName/ProductName appear in Apple Home,
// Google Home, HA etc. after pairing. VendorName/ProductName default to
// "TEST_VENDOR"/"TEST_PRODUCT" from CHIP_DEVICE_CONFIG_* until we ship factory
// data via mfg_tool with a CSA-assigned VID; this runtime override at least
// keeps controller UIs from showing "TEST_" strings.
static constexpr char kNodeLabel[] = "GaggiMate";
static constexpr char kVendorName[] = "GaggiMate";
static constexpr char kProductName[] = "GaggiMate Espresso";
static constexpr char kBleDeviceName[] = "GaggiMate";

// Temperature values on the Matter TemperatureControl cluster are in hundredths
// of a degree Celsius (int16).
static constexpr int16_t kTempMinCentiC = 2000;   // 20.00 C
static constexpr int16_t kTempMaxCentiC = 16000;  // 160.00 C
static constexpr int16_t kTempDefaultCentiC = 9300; // 93.00 C

static MatterPlugin *s_instance = nullptr;

MatterPlugin *MatterPlugin::instance() { return s_instance; }

static int16_t floatCtoCenti(float v) {
    if (v < -327.0f) v = -327.0f;
    if (v > 327.0f) v = 327.0f;
    return static_cast<int16_t>(v * 100.0f);
}

static float centiToFloatC(int16_t v) {
    return static_cast<float>(v) / 100.0f;
}

static esp_err_t matter_attr_update_cb(esp_matter::attribute::callback_type_t type, uint16_t endpoint_id, uint32_t cluster_id,
                                       uint32_t attribute_id, esp_matter_attr_val_t *val, void * /*priv*/) {
    if (type != esp_matter::attribute::PRE_UPDATE || s_instance == nullptr) {
        return ESP_OK;
    }
    s_instance->onAttributeWrite(endpoint_id, cluster_id, attribute_id, static_cast<void *>(val));
    return ESP_OK;
}

static void matter_event_cb(const ChipDeviceEvent *event, intptr_t /*arg*/) {
    using chip::DeviceLayer::DeviceEventType::kBLEDeinitialized;
    using chip::DeviceLayer::DeviceEventType::kCommissioningComplete;
    using chip::DeviceLayer::DeviceEventType::kFabricRemoved;
    using chip::DeviceLayer::DeviceEventType::kServerReady;

    switch (event->Type) {
    case kServerReady:
        ESP_LOGI(LOG_TAG, "Matter server ready");
        // Log QR + manual pairing codes for convenient first-time commissioning;
        // same info is surfaced to the web UI via /api/matter/info.
        PrintOnboardingCodes(chip::RendezvousInformationFlags(chip::RendezvousInformationFlag::kBLE));
        if (chip::Server::GetInstance().GetFabricTable().FabricCount() > 0) {
            ESP_LOGI(LOG_TAG, "Fabric present, releasing BLE immediately");
            BLECoordinator::instance().notifyBLEReleased();
        }
        break;
    case kCommissioningComplete:
        ESP_LOGI(LOG_TAG, "Matter commissioning complete");
        break;
    case kBLEDeinitialized:
        ESP_LOGI(LOG_TAG, "Matter BLE deinitialized, handing BLE to NimBLE client");
        BLECoordinator::instance().notifyBLEReleased();
        break;
    case kFabricRemoved:
        ESP_LOGI(LOG_TAG, "Matter fabric removed");
        break;
    default:
        break;
    }
}

void MatterPlugin::setup(Controller *controller, PluginManager *pluginManager) {
    this->controller = controller;
    this->pluginManager = pluginManager;
    s_instance = this;

    pluginManager->on("controller:wifi:connect", [this](Event const &event) { start(event); });
    pluginManager->on("controller:mode:change", [this](Event const &e) { onModeChange(e.getInt("value")); });
    pluginManager->on("boiler:targetTemperature:change", [this](Event const &e) { onTargetTempChange(e.getFloat("value")); });
    pluginManager->on("boiler:currentTemperature:change", [this](Event const &e) { onCurrentTempChange(e.getFloat("value")); });
}

void MatterPlugin::start(Event const &event) {
    if (started)
        return;
    const int apMode = event.getInt("AP");
    if (apMode) {
        ESP_LOGI(LOG_TAG, "AP mode, Matter not started; releasing BLE to NimBLE client");
        BLECoordinator::instance().notifyBLEReleased();
        return;
    }

    // Silence per-attribute R/W trace (esp_matter_attribute fires on every
    // read AND write; temperature stream alone generates ~8 lines/sec at
    // INFO). State transitions we care about are still logged via our own
    // LOG_TAG at INFO.
    esp_log_level_set("esp_matter_attribute", ESP_LOG_WARN);
    // chip[DIS] retries advertiser init on every IP event for ~5s at startup;
    // drop to WARN so only genuine failures surface.
    esp_log_level_set("chip[DIS]", ESP_LOG_WARN);
#ifdef GAGGIMATE_MATTER_BLE_DEBUG
    // Crank BLE/BTP logs to DEBUG so the TX (handshake-response) side shows up
    // when diagnosing commissioning hangs. Off by default — stream is chatty.
    esp_log_level_set("chip[BLE]", ESP_LOG_DEBUG);
    esp_log_level_set("chip[DL]", ESP_LOG_DEBUG);
    esp_log_level_set("NimBLE", ESP_LOG_DEBUG);
#endif

    esp_matter::node::config_t node_cfg;
    esp_matter::node_t *node = esp_matter::node::create(&node_cfg, matter_attr_update_cb, nullptr);
    if (!node) {
        ESP_LOGE(LOG_TAG, "Failed to create Matter node");
        return;
    }

    esp_matter::endpoint_t *ep = esp_matter::endpoint::create(node, esp_matter::ENDPOINT_FLAG_NONE, this);
    if (!ep) {
        ESP_LOGE(LOG_TAG, "Failed to create Matter endpoint");
        return;
    }

    esp_matter::cluster::descriptor::config_t desc_cfg;
    esp_matter::cluster::descriptor::create(ep, &desc_cfg, esp_matter::CLUSTER_FLAG_SERVER);

    esp_matter::cluster::identify::config_t identify_cfg;
    esp_matter::cluster::identify::create(ep, &identify_cfg, esp_matter::CLUSTER_FLAG_SERVER);

    esp_matter::cluster::on_off::config_t onoff_cfg;
    esp_matter::cluster::on_off::create(ep, &onoff_cfg, esp_matter::CLUSTER_FLAG_SERVER,
                                        esp_matter::cluster::on_off::feature::lighting::get_id());

    esp_matter::cluster::temperature_control::config_t tc_cfg;
    tc_cfg.temperature_number.temp_setpoint = kTempDefaultCentiC;
    tc_cfg.temperature_number.min_temperature = kTempMinCentiC;
    tc_cfg.temperature_number.max_temperature = kTempMaxCentiC;
    tc_cfg.features = esp_matter::cluster::temperature_control::feature::temperature_number::get_id();
    esp_matter::cluster::temperature_control::create(ep, &tc_cfg, esp_matter::CLUSTER_FLAG_SERVER, tc_cfg.features);

    esp_matter::cluster::temperature_measurement::config_t tm_cfg;
    tm_cfg.min_measured_value = kTempMinCentiC;
    tm_cfg.max_measured_value = kTempMaxCentiC;
    esp_matter::cluster::temperature_measurement::create(ep, &tm_cfg, esp_matter::CLUSTER_FLAG_SERVER);

    const esp_err_t dt_err = esp_matter::endpoint::add_device_type(ep, kGaggiMateDeviceTypeId, kGaggiMateDeviceTypeVersion);
    if (dt_err != ESP_OK) {
        ESP_LOGW(LOG_TAG, "add_device_type failed: %d", dt_err);
    }

    endpointId = esp_matter::endpoint::get_id(ep);
    ESP_LOGI(LOG_TAG, "Matter endpoint %u built (device_type=0x%08lx)", endpointId,
             (unsigned long)kGaggiMateDeviceTypeId);

    // Override GAP name used in BLE commissioning advertisement.
    if (chip::DeviceLayer::ConnectivityMgr().SetBLEDeviceName(kBleDeviceName) != CHIP_NO_ERROR) {
        ESP_LOGW(LOG_TAG, "Failed to set BLE device name");
    }

    const esp_err_t err = esp_matter::start(matter_event_cb);
    if (err != ESP_OK) {
        ESP_LOGE(LOG_TAG, "esp_matter::start failed: %d", err);
        BLECoordinator::instance().notifyBLEReleased();
        return;
    }

    // BasicInformation attributes live on endpoint 0 (root node). Override
    // VendorName, ProductName, and NodeLabel so controller UIs show GaggiMate
    // instead of the CHIP_DEVICE_CONFIG_* defaults.
    {
        esp_matter_attr_val_t val;
        val = esp_matter_char_str(const_cast<char *>(kVendorName), sizeof(kVendorName) - 1);
        esp_matter::attribute::update(0, chip::app::Clusters::BasicInformation::Id,
                                      chip::app::Clusters::BasicInformation::Attributes::VendorName::Id, &val);
        val = esp_matter_char_str(const_cast<char *>(kProductName), sizeof(kProductName) - 1);
        esp_matter::attribute::update(0, chip::app::Clusters::BasicInformation::Id,
                                      chip::app::Clusters::BasicInformation::Attributes::ProductName::Id, &val);
        val = esp_matter_char_str(const_cast<char *>(kNodeLabel), sizeof(kNodeLabel) - 1);
        esp_matter::attribute::update(0, chip::app::Clusters::BasicInformation::Id,
                                      chip::app::Clusters::BasicInformation::Attributes::NodeLabel::Id, &val);
    }

    started = true;
    ESP_LOGI(LOG_TAG, "Matter stack started");
}

void MatterPlugin::onAttributeWrite(uint16_t endpoint_id, uint32_t cluster_id, uint32_t attribute_id, void *val_void) {
    if (endpoint_id != endpointId || controller == nullptr) {
        return;
    }
    const esp_matter_attr_val_t *val = static_cast<const esp_matter_attr_val_t *>(val_void);
    using namespace chip::app::Clusters;
    if (cluster_id == OnOff::Id && attribute_id == OnOff::Attributes::OnOff::Id) {
        const bool on = val->val.b;
        ESP_LOGI(LOG_TAG, "OnOff write: %d", on);
        applyingFromMatter = true;
        if (on) {
            controller->deactivateStandby();
        } else {
            controller->activateStandby();
        }
        applyingFromMatter = false;
        return;
    }
    if (cluster_id == TemperatureControl::Id && attribute_id == TemperatureControl::Attributes::TemperatureSetpoint::Id) {
        const float temp = centiToFloatC(val->val.i16);
        ESP_LOGI(LOG_TAG, "TemperatureSetpoint write: %.2f C", temp);
        applyingFromMatter = true;
        controller->setTargetTemp(temp);
        applyingFromMatter = false;
        return;
    }
}

void MatterPlugin::onModeChange(int mode) {
    if (!started || applyingFromMatter)
        return;
    const bool on = (mode != MODE_STANDBY);
    esp_matter_attr_val_t v = esp_matter_bool(on);
    esp_matter::attribute::update(endpointId, chip::app::Clusters::OnOff::Id,
                                  chip::app::Clusters::OnOff::Attributes::OnOff::Id, &v);
}

void MatterPlugin::onTargetTempChange(float temperature) {
    if (!started || applyingFromMatter)
        return;
    esp_matter_attr_val_t v = esp_matter_int16(floatCtoCenti(temperature));
    esp_matter::attribute::update(endpointId, chip::app::Clusters::TemperatureControl::Id,
                                  chip::app::Clusters::TemperatureControl::Attributes::TemperatureSetpoint::Id, &v);
}

void MatterPlugin::onCurrentTempChange(float temperature) {
    if (!started || applyingFromMatter)
        return;
    esp_matter_attr_val_t v = esp_matter_nullable_int16(floatCtoCenti(temperature));
    esp_matter::attribute::update(endpointId, chip::app::Clusters::TemperatureMeasurement::Id,
                                  chip::app::Clusters::TemperatureMeasurement::Attributes::MeasuredValue::Id, &v);
}

bool MatterPlugin::getOnboardingInfo(OnboardingInfo &out) const {
    out = OnboardingInfo{};
    out.started = started;
    if (!started) {
        return false;
    }

    auto &fabrics = chip::Server::GetInstance().GetFabricTable();
    out.fabricCount = fabrics.FabricCount();
    out.commissioned = out.fabricCount > 0;

    auto *provider = chip::DeviceLayer::GetCommissionableDataProvider();
    if (provider != nullptr) {
        uint32_t passcode = 0;
        if (provider->GetSetupPasscode(passcode) == CHIP_NO_ERROR) {
            out.passcode = passcode;
        }
        uint16_t discriminator = 0;
        if (provider->GetSetupDiscriminator(discriminator) == CHIP_NO_ERROR) {
            out.discriminator = discriminator;
        }
    }

    auto *instanceInfo = chip::DeviceLayer::GetDeviceInstanceInfoProvider();
    if (instanceInfo != nullptr) {
        uint16_t vendorId = 0;
        if (instanceInfo->GetVendorId(vendorId) == CHIP_NO_ERROR) {
            out.vendorId = vendorId;
        }
        uint16_t productId = 0;
        if (instanceInfo->GetProductId(productId) == CHIP_NO_ERROR) {
            out.productId = productId;
        }
    }

    const chip::RendezvousInformationFlags flags(chip::RendezvousInformationFlag::kBLE);

    chip::MutableCharSpan qrSpan(out.qrPayload);
    if (GetQRCode(qrSpan, flags) == CHIP_NO_ERROR && qrSpan.size() < sizeof(out.qrPayload)) {
        out.qrPayload[qrSpan.size()] = '\0';
    } else {
        out.qrPayload[0] = '\0';
    }

    chip::MutableCharSpan manualSpan(out.manualCode);
    if (GetManualPairingCode(manualSpan, flags) == CHIP_NO_ERROR && manualSpan.size() < sizeof(out.manualCode)) {
        out.manualCode[manualSpan.size()] = '\0';
    } else {
        out.manualCode[0] = '\0';
    }

    return true;
}

#endif // GAGGIMATE_MATTER
