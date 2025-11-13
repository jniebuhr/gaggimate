#include "DebugLogPlugin.h"
#include "FS.h"

#include <SD_MMC.h>
#include <SPIFFS.h>
#include <display/core/Controller.h>
#include <esp_rom_sys.h>
#include <esp_rom_uart.h>
#include <time.h>
#include <version.h>

DebugLogPlugin DebugLog;

void DebugLogPlugin::setup(Controller *c, PluginManager *pm) {
    this->controller = c;
    this->pluginManager = pm;
    this->settings = &c->getSettings();

    if (controller->isSDCard()) {
        fs = &SD_MMC;
    } else {
        fs = &SPIFFS;
    }

    rotateLogIfNeeded();
    checkAndEnableLogging();
    pluginManager->on("settings:changed", [this](const Event &event) { checkAndEnableLogging(); });
}

void DebugLogPlugin::loop() {
    unsigned long now = millis();

    // Check if plugin is disabled and it's safe to free the buffer
    bool shouldFreeBuffer = logBuffer && disabledAtMillis > 0;
    // We're giving the 'unhook' some time to settle as there may still be in-flight ISRs or bytes left in the UART buffer.
    bool isGracePeriodPassed = (now - disabledAtMillis) > 100;
    bool allReadersUpToDate = logWritePos == fileReadPos && logWritePos == wsReadPos;
    if (shouldFreeBuffer && isGracePeriodPassed && allReadersUpToDate) {
        delete[] logBuffer;
        logBuffer = nullptr;
        logWritePos = 0;
        wsReadPos = 0;
        fileReadPos = 0;
    }

    // Buffer is empty (nothing to flush)
    if (!logBuffer || logWritePos == fileReadPos) {
        return;
    }

    // Check if buffer is getting full
    size_t freeSpace;
    if (logWritePos >= fileReadPos) {
        freeSpace = DEBUG_LOG_BUFFER_SIZE - logWritePos + fileReadPos - 1;
    } else {
        freeSpace = (fileReadPos - logWritePos) - 1;
    }

    if (freeSpace <= 1024 || (now - lastFlush > DEBUG_LOG_FLUSH_INTERVAL)) {
        flushToFile();
        rotateLogIfNeeded();
        lastFlush = now;
    }
}

void DebugLogPlugin::rotateLogIfNeeded() {
    if (!fs) {
        return;
    }

    if (fs->exists(logFilePath)) {
        File checkFile = fs->open(logFilePath, "r");
        if (checkFile) {
            size_t size = checkFile.size();
            checkFile.close();

            if (size > DEBUG_LOG_MAX_FILE_SIZE) {
                if (fs->exists(oldLogFilePath)) {
                    fs->remove(oldLogFilePath);
                }
                fs->rename(logFilePath, oldLogFilePath);
                ESP_LOGI("DebugLogPlugin", "Rotated log file");
            }
        }
    }
}

void debugLogPutcWrapper(char c) {
    DebugLog.writeCharToBuffer(c);

    // Also send to actual UART so we still see output on serial monitor
    esp_rom_uart_tx_one_char(c);
}

void DebugLogPlugin::checkAndEnableLogging() {
    if (settings->isDebugLoggingEnabled()) {
        if (!logBuffer) {
            logBuffer = new uint8_t[DEBUG_LOG_BUFFER_SIZE];
            logWritePos = 0;
            wsReadPos = 0;
            fileReadPos = 0;
            disabledAtMillis = 0;
        }
        // Channel 1 is the default console UART
        esp_rom_install_channel_putc(1, &debugLogPutcWrapper);
        ESP_LOGI("DebugLogPlugin", "Debug logging enabled");
    } else {
        // Restore normal UART output
        esp_rom_install_uart_printf();
        disabledAtMillis = millis();
        ESP_LOGI("DebugLogPlugin", "Debug logging disabled");
    }
}

String DebugLogPlugin::getNewWSLogs() {
    String result;

    wsReadPos = readFromCircularBuffer(
        wsReadPos, logWritePos,
        [](const uint8_t *data, size_t len, void *ctx) { ((String *)ctx)->concat((const char *)data, len); }, &result);

    return result;
}

void DebugLogPlugin::writeCharToBuffer(char c) {
    if (!logBuffer) {
        return;
    }

    size_t nextWritePos = (logWritePos + 1) % DEBUG_LOG_BUFFER_SIZE;

    // When buffer is full, just drop the latest bytes
    if (nextWritePos == wsReadPos || nextWritePos == fileReadPos) {
        return;
    }

    logBuffer[logWritePos] = c;
    logWritePos = nextWritePos;
}

void DebugLogPlugin::flushToFile() {
    if (!fs) {
        return;
    }

    File logFile = fs->open(logFilePath, FILE_APPEND);
    if (logFile) {
        fileReadPos = readFromCircularBuffer(
            fileReadPos, logWritePos, [](const uint8_t *data, size_t len, void *ctx) { ((File *)ctx)->write(data, len); },
            &logFile);
        logFile.close();
    }
}

// Consume some bytes from the circular buffer via a callback.
// The callback gets invoked once or twice depending on whether the read needs to wrap around the 'end' of the buffer.
// Returns the new reader position.
size_t DebugLogPlugin::readFromCircularBuffer(size_t readPos, size_t writePos,
                                              void (*writeChunkCallback)(const uint8_t *data, size_t len, void *context),
                                              void *context) {
    if (!logBuffer) {
        return readPos;
    }

    if (readPos < writePos) {
        writeChunkCallback(&logBuffer[readPos], writePos - readPos, context);
        return writePos;
    } else if (readPos > writePos) {
        writeChunkCallback(&logBuffer[readPos], DEBUG_LOG_BUFFER_SIZE - readPos, context);
        writeChunkCallback(&logBuffer[0], writePos, context);
        return writePos;
    }
    return readPos;
}
