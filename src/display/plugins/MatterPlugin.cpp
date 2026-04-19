#include "MatterPlugin.h"

#ifdef GAGGIMATE_MATTER

#include "../core/Controller.h"
#include "../core/Event.h"
#include <esp_log.h>
#include <esp_matter.h>
#include <esp_matter_core.h>
#include <esp_matter_endpoint.h>

static constexpr char LOG_TAG[] = "MatterPlugin";

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

    const esp_err_t err = esp_matter::start(nullptr);
    if (err != ESP_OK) {
        ESP_LOGE(LOG_TAG, "esp_matter::start failed: %d", err);
        return;
    }

    started = true;
    ESP_LOGI(LOG_TAG, "Matter stack started");
}

#endif // GAGGIMATE_MATTER
