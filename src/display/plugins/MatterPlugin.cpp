#include "MatterPlugin.h"

#ifdef GAGGIMATE_MATTER

#include "../core/BLECoordinator.h"
#include "../core/Controller.h"
#include "../core/Event.h"
#include "../core/PluginManager.h"
#include "../core/constants.h"
#include <app-common/zap-generated/ids/Attributes.h>
#include <app-common/zap-generated/ids/Clusters.h>
#include <app/server/Server.h>
#include <cstring>
#include <esp_log.h>
#include <esp_matter.h>
#include <esp_matter_attribute_utils.h>
#include <esp_matter_core.h>
#include <esp_matter_endpoint.h>
#include <platform/CHIPDeviceEvent.h>

static constexpr char LOG_TAG[] = "MatterPlugin";

// Vendor-specific device type ID until CSA assigns one for espresso machines.
// Matter 1.4 does not define a Coffee Maker type; `0xFFF1xxxx` is the hobby range.
static constexpr uint32_t kGaggiMateDeviceTypeId = 0xFFF1FC01;
static constexpr uint8_t kGaggiMateDeviceTypeVersion = 1;

// Temperature values on the Matter TemperatureControl cluster are in hundredths
// of a degree Celsius (int16).
static constexpr int16_t kTempMinCentiC = 2000;   // 20.00 C
static constexpr int16_t kTempMaxCentiC = 16000;  // 160.00 C
static constexpr int16_t kTempDefaultCentiC = 9300; // 93.00 C

static MatterPlugin *s_instance = nullptr;

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

    const esp_err_t err = esp_matter::start(matter_event_cb);
    if (err != ESP_OK) {
        ESP_LOGE(LOG_TAG, "esp_matter::start failed: %d", err);
        BLECoordinator::instance().notifyBLEReleased();
        return;
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

#endif // GAGGIMATE_MATTER
