#include <display/plugins/ShotUploadPlugin.h>

#include <HTTPClient.h>
#include <LittleFS.h>
#include <SD_MMC.h>
#include <WiFi.h>
#include <ctype.h>
#include <display/core/Controller.h>
#include <display/core/Settings.h>
#include <display/util/PsramAllocator.h>
#include <version.h>

#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

// .slog stores scaled integers; these divisors (same values as the encoder in
// ShotHistoryPlugin) convert back to physical units for the JSON payload.
static constexpr float TEMP_SCALE_DIV = 10.0f;      // °C * 10
static constexpr float PRESSURE_SCALE_DIV = 10.0f;  // bar * 10
static constexpr float FLOW_SCALE_DIV = 100.0f;     // ml/s * 100
static constexpr float WEIGHT_SCALE_DIV = 10.0f;    // g * 10
static constexpr float RESISTANCE_SCALE_DIV = 100.0f; // puck resistance * 100

ShotUploadPlugin ShotUpload;

void ShotUploadPlugin::setup(Controller *c, PluginManager *pm) {
    controller = c;
    pluginManager = pm;
    if (controller->isSDCard()) {
        fs = &SD_MMC;
    }

    // A shot is fully persisted (file closed, header patched, index entry
    // appended) by the time ShotHistoryPlugin fires evt:history-shot-saved.
    pm->on("evt:history-shot-saved", [this](Event const &event) { enqueueShot(static_cast<uint32_t>(event.getInt("id"))); });

#ifndef GAGGIMATE_SIM // the simulator drives loop() cooperatively instead
    xTaskCreatePinnedToCore(taskLoop, "ShotUploadPlugin", configMINIMAL_STACK_SIZE * 8, this, 1, &taskHandle, 0);
#endif
}

void ShotUploadPlugin::loop() {
#ifdef GAGGIMATE_SIM
    processOnce();
#endif
}

[[noreturn]] void ShotUploadPlugin::taskLoop(void *arg) {
    auto *plugin = static_cast<ShotUploadPlugin *>(arg);
    while (true) {
        plugin->processOnce();
        vTaskDelay(pdMS_TO_TICKS(200));
    }
}

void ShotUploadPlugin::enqueueShot(uint32_t shotId) {
    std::lock_guard<std::mutex> guard(queueMutex);
    uploadQueue.push(shotId);
}

void ShotUploadPlugin::requestUpload(uint32_t shotId) {
    enqueueShot(shotId);
}

void ShotUploadPlugin::processOnce() {
    const Settings &settings = controller->getSettings();

    uint32_t shotId = 0;
    {
        std::lock_guard<std::mutex> guard(queueMutex);
        if (uploadQueue.empty()) {
            return;
        }
        shotId = uploadQueue.front();
        uploadQueue.pop();
    }

    // Feature disabled or misconfigured: drop queued shots instead of
    // accumulating them forever.
    if (!settings.isShotUploadEnabled() || settings.getShotUploadServer().isEmpty()) {
        ESP_LOGW("ShotUploadPlugin", "Shot %u dropped: upload disabled or server not configured", shotId);
        return;
    }

    String json;
    if (!buildShotJson(shotId, json)) {
        ESP_LOGW("ShotUploadPlugin", "Shot %u: failed to read .slog", shotId);
        return;
    }

    // Not on the network: drop the shot (no offline queueing).
    if (WiFi.status() != WL_CONNECTED) {
        ESP_LOGW("ShotUploadPlugin", "Shot %u: not connected, dropped", shotId);
        auto id = String(shotId, 10);
        while (id.length() < 6) {
            id = "0" + id;
        }
        pluginManager->trigger("evt:shot-upload:failed",
                               "msg", "shot #" + id + ": not connected, not uploaded");
        return;
    }

    bool ok = false;
    String error;
    int retries = settings.getShotUploadRetries();
    if (retries < 0) {
        retries = 0;
    }
    // retries = extra attempts after the initial one (setting su_r, default 3).
    for (int attempt = 0; attempt <= retries && !ok; attempt++) {
        if (attempt > 0) {
            vTaskDelay(pdMS_TO_TICKS(RETRY_DELAY_MS));
        }
        ok = upload(json, shotId, error);
        if (!ok) {
            ESP_LOGW("ShotUploadPlugin", "Shot %u: upload attempt %d/%d failed: %s", shotId, attempt + 1, retries + 1,
                     error.c_str());
        }
    }

    if (ok) {
        ESP_LOGI("ShotUploadPlugin", "Shot %u uploaded successfully (%u bytes)", shotId, json.length());
    } else {
        ESP_LOGW("ShotUploadPlugin", "Shot %u: dropped after %d failed attempts", shotId, retries + 1);
        auto id = String(shotId, 10);
        while (id.length() < 6) {
            id = "0" + id;
        }
        // Surfaced in the WebUI Print The Shot card so the user sees the failure.
        pluginManager->trigger("evt:shot-upload:failed",
                               "msg", "shot #" + id + ": upload failed after " + String(retries) + " retries (" + error + ")");
    }
}

bool ShotUploadPlugin::upload(const String &json, uint32_t, String &error) {
    // The Decent plugin passes a clean alphanumeric machine id in the query.
    String machineId = cleanMachineId(controller->getSettings().getShotUploadMachineId());
    // The shot server is typically a LAN-only service (Decent's own print
    // plugin talks plain HTTP to a local host). Honour an explicit scheme in
    // the configured server (e.g. https://...) so TLS setups work too, and
    // fall back to http for the default LAN case.
    String server = controller->getSettings().getShotUploadServer();
    // NOSONAR: the shot server is a user-configured LAN endpoint and the
    // Decent print ecosystem is plain-HTTP based; operators who need TLS can
    // configure an https:// server, which is honoured verbatim above.
    if (server.indexOf("://") < 0) {
        server = "http://" + server;
    }
    String url = server + "/" + controller->getSettings().getShotUploadEndpoint()
                 + "?machine_id=" + machineId;

    HTTPClient http;
    http.setConnectTimeout(5000);
    http.setTimeout(10000);
    if (!http.begin(url)) {
        error = "begin failed";
        return false;
    }
    http.addHeader("Content-Type", "application/json");
    int code = http.POST(json);
    if (code < 0) {
        error = "HTTP error " + http.errorToString(code);
    } else {
        error = "HTTP " + String(code);
    }
    http.end();
    return code >= 200 && code < 300;
}

String ShotUploadPlugin::cleanMachineId(const String &raw) const {
    String cleaned;
    cleaned.reserve(20);
    for (size_t i = 0; i < raw.length() && cleaned.length() < 20; i++) {
        char ch = raw[i];
        if (isalnum(ch)) {
            cleaned += ch;
        }
    }
    return cleaned.isEmpty() ? String("UNKNOWN") : cleaned;
}

bool ShotUploadPlugin::buildShotJson(uint32_t shotId, String &outJson) {
    // ShotHistoryPlugin writes .slog files zero-padded to 6 digits (/h/000000.slog).
    auto id = String(shotId, 10);
    while (id.length() < 6) {
        id = "0" + id;
    }
    String path = "/h/" + id + ".slog";
    File f = fs->open(path, "r");
    if (!f) {
        return false;
    }

    ShotLogHeader header{};
    if (f.read(reinterpret_cast<uint8_t *>(&header), sizeof(header)) != sizeof(header) || header.magic != SHOT_LOG_MAGIC) {
        f.close();
        return false;
    }

    JsonDocument doc(&psramAllocator);
    doc["version"] = "2";
    doc["clock"] = header.startEpoch;
    doc["timestamp"] = header.startEpoch;
    JsonArray elapsed = doc["elapsed"].to<JsonArray>();
    JsonArray pressure = doc["pressure"]["pressure"].to<JsonArray>();
    JsonArray pressureGoal = doc["pressure"]["goal"].to<JsonArray>();
    JsonArray flow = doc["flow"]["flow"].to<JsonArray>();
    JsonArray flowGoal = doc["flow"]["goal"].to<JsonArray>();
    JsonArray byWeight = doc["flow"]["by_weight"].to<JsonArray>();
    JsonArray basketTemp = doc["temperature"]["basket"].to<JsonArray>();
    JsonArray mixTemp = doc["temperature"]["mix"].to<JsonArray>();
    JsonArray tempGoal = doc["temperature"]["goal"].to<JsonArray>();
    JsonArray resistance = doc["resistance"]["resistance"].to<JsonArray>();
    JsonArray weight = doc["totals"]["weight"].to<JsonArray>();

    ShotLogSample sample{};
    f.seek(header.headerSize, SeekSet);
    for (uint32_t s = 0; s < header.sampleCount; s++) {
        if (f.read(reinterpret_cast<uint8_t *>(&sample), sizeof(sample)) != sizeof(sample)) {
            break;
        }
        elapsed.add(s * (SHOT_LOG_SAMPLE_INTERVAL_MS / 1000.0));
        pressure.add(sample.cp / PRESSURE_SCALE_DIV);
        pressureGoal.add(sample.tp / PRESSURE_SCALE_DIV);
        flow.add(sample.fl / FLOW_SCALE_DIV);
        flowGoal.add(sample.tf / FLOW_SCALE_DIV);
        byWeight.add(sample.pf / FLOW_SCALE_DIV);
        basketTemp.add(sample.ct / TEMP_SCALE_DIV);
        mixTemp.add(sample.ct / TEMP_SCALE_DIV);
        tempGoal.add(sample.tt / TEMP_SCALE_DIV);
        resistance.add(sample.pr / RESISTANCE_SCALE_DIV);
        weight.add(sample.ev / WEIGHT_SCALE_DIV);
    }
    f.close();

    doc["profile"]["title"] = header.profileName;
    doc["profile"]["notes"] = "";
    doc["meta"]["in"] = 0;
    doc["meta"]["out"] = header.finalWeight / WEIGHT_SCALE_DIV;
    doc["meta"]["time"] = header.durationMs / 1000.0;
    doc["meta"]["bean"].to<JsonObject>(); // present but empty, mirrors Decent schema
    doc["app"]["app_name"] = "GaggiMate";
    doc["app"]["app_version"] = BUILD_GIT_VERSION;

    if (serializeJson(doc, outJson) == 0) {
        return false;
    }
    return true;
}
