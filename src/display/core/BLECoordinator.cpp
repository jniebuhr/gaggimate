#include "BLECoordinator.h"

#include <esp_log.h>

static constexpr char LOG_TAG[] = "BLECoordinator";

BLECoordinator &BLECoordinator::instance() {
    static BLECoordinator inst;
    return inst;
}

BLECoordinator::BLECoordinator() {
#ifdef GAGGIMATE_MATTER
    released = false;
#else
    released = true;
#endif
}

void BLECoordinator::requestNimBleInit(InitCallback cb) {
    if (!cb)
        return;
    if (released) {
        cb();
        invoked = true;
        return;
    }
    ESP_LOGI(LOG_TAG, "NimBLE init deferred until Matter BLE released");
    pending.push_back(std::move(cb));
}

void BLECoordinator::notifyBLEReleased() {
    if (released)
        return;
    released = true;
    ESP_LOGI(LOG_TAG, "BLE stack released, draining %u pending init(s)", (unsigned)pending.size());
    auto drain = std::move(pending);
    pending.clear();
    for (auto &cb : drain) {
        cb();
    }
    invoked = !drain.empty();
}
