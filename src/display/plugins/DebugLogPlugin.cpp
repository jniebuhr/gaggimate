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

void debugLogPutcWrapper(char c) {
    // Write to buffer only (file writes happen in loop())
    DebugLog.writeCharToBuffer(c);

    // Also send to actual UART so we still see output on serial monitor
    esp_rom_uart_tx_one_char(c);
}

void DebugLogPlugin::setup(Controller *c, PluginManager *pm) {
    controller = c;
    pluginManager = pm;

    if (controller->isSDCard()) {
        fs = &SD_MMC;
    } else {
        fs = &SPIFFS;
    }

    rotateLogIfNeeded();

    // Hook low-level UART output to capture printf/console_printf
    // Channel 1 is the default console UART
    esp_rom_install_channel_putc(1, &debugLogPutcWrapper);
    ESP_LOGI("DebugLogPlugin", "Redirecting logs to file and WS buffer");
}

void DebugLogPlugin::loop() {
    unsigned long now = millis();

    if (isBufferAlmostFull || (now - lastFlush > DEBUG_LOG_FLUSH_INTERVAL)) {
        flushToFile();
        rotateLogIfNeeded();
        isBufferAlmostFull = false;
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
                ESP_LOGI("DebugLogPlugin", "Rotated log file (was %d bytes)", size);
            }
        }
    }
}

String DebugLogPlugin::getNewLogs() {
    String result;
    result.reserve(512); // Pre-allocate some space

    wsReadPos = readFromCircularBuffer(
        wsReadPos, logWritePos,
        [](const uint8_t *data, size_t len, void *ctx) { ((String *)ctx)->concat((const char *)data, len); }, &result);

    return result;
}

void DebugLogPlugin::writeCharToBuffer(char c) {
    size_t nextWritePos = (logWritePos + 1) % DEBUG_LOG_BUFFER_SIZE;

    // Flag for flush when we're getting close (100 bytes away from overwriting)
    size_t freeSpace;
    if (logWritePos >= fileReadPos) {
        freeSpace = DEBUG_LOG_BUFFER_SIZE - logWritePos + fileReadPos;
    } else {
        freeSpace = (fileReadPos - logWritePos) - 1;
    }

    if (freeSpace >= 100) {
        isBufferAlmostFull = true;
    }

    // If buffer full for a reader, drop oldest byte
    if (nextWritePos == wsReadPos) {
        wsReadPos = (wsReadPos + 1) % DEBUG_LOG_BUFFER_SIZE;
    }
    if (nextWritePos == fileReadPos) {
        fileReadPos = (fileReadPos + 1) % DEBUG_LOG_BUFFER_SIZE;
    }

    logBuffer[logWritePos] = c;
    logWritePos = nextWritePos;
}

void DebugLogPlugin::flushToFile() {
    if (!fs) {
        return;
    }

    File tempFile = fs->open(logFilePath, FILE_APPEND);
    if (tempFile) {
        fileReadPos = readFromCircularBuffer(
            fileReadPos, logWritePos, [](const uint8_t *data, size_t len, void *ctx) { ((File *)ctx)->write(data, len); },
            &tempFile);
        tempFile.close();
    }
}

size_t DebugLogPlugin::readFromCircularBuffer(size_t readPos, size_t writePos,
                                              void (*writeChunkCallback)(const uint8_t *data, size_t len, void *context),
                                              void *context) {
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
