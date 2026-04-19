#include "MatterPlugin.h"

#ifdef GAGGIMATE_MATTER

#include "../core/BLECoordinator.h"
#include "../core/Controller.h"
#include "../core/Event.h"
#include <app/server/Server.h>
#include <esp_log.h>
#include <esp_matter.h>
#include <esp_matter_core.h>
#include <esp_matter_endpoint.h>
#include <platform/CHIPDeviceEvent.h>

static constexpr char LOG_TAG[] = "MatterPlugin";

static void matter_event_cb(const ChipDeviceEvent *event, intptr_t /*arg*/) {
    using chip::DeviceLayer::DeviceEventType::kBLEDeinitialized;
    using chip::DeviceLayer::DeviceEventType::kCommissioningComplete;
    using chip::DeviceLayer::DeviceEventType::kCommissioningSessionStarted;
    using chip::DeviceLayer::DeviceEventType::kCommissioningSessionStopped;
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
    case kCommissioningSessionStarted:
        ESP_LOGI(LOG_TAG, "Matter commissioning session started");
        break;
    case kCommissioningSessionStopped:
        ESP_LOGI(LOG_TAG, "Matter commissioning session stopped");
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
    pluginManager->on("controller:wifi:connect", [this](Event const &event) { start(event); });
}

void MatterPlugin::start(Event const &event) {
    if (started)
        return;
    const int apMode = event.getInt("AP");
    if (apMode)
        return;

    esp_matter::node_t *node = esp_matter::node::create_raw();
    if (!node) {
        ESP_LOGE(LOG_TAG, "Failed to create Matter node");
        return;
    }

    esp_matter::endpoint_t *ep = esp_matter::endpoint::create(node, esp_matter::ENDPOINT_FLAG_NONE, nullptr);
    if (!ep) {
        ESP_LOGE(LOG_TAG, "Failed to create Matter endpoint");
        return;
    }

    esp_matter::cluster::on_off::config_t onoff_cfg;
    esp_matter::cluster::on_off::create(ep, &onoff_cfg, esp_matter::CLUSTER_FLAG_SERVER,
                                        esp_matter::cluster::on_off::feature::lighting::get_id());

    const esp_err_t err = esp_matter::start(matter_event_cb);
    if (err != ESP_OK) {
        ESP_LOGE(LOG_TAG, "esp_matter::start failed: %d", err);
        BLECoordinator::instance().notifyBLEReleased();
        return;
    }

    started = true;
    ESP_LOGI(LOG_TAG, "Matter stack started");
}

#endif // GAGGIMATE_MATTER
