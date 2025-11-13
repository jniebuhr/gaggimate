#ifndef DEBUGLOGPLUGIN_H
#define DEBUGLOGPLUGIN_H

#include <FS.h>
#include <WString.h>
#include <display/core/Plugin.h>
#include <display/core/Settings.h>
#include <esp_log.h>

constexpr size_t DEBUG_LOG_MAX_FILE_SIZE = 50 * 1024; // Max log file size
constexpr size_t DEBUG_LOG_FLUSH_INTERVAL = 5000;     // Interval to flush logs to file
constexpr size_t DEBUG_LOG_BUFFER_SIZE = 16384;       // Buffer to hold logs before flushing to file / WS
constexpr size_t DEBUG_LOG_WS_INTERVAL = 2000;        // Interval to send logs over WebSocket
constexpr size_t DEBUG_LOG_WS_FAST_INTERVAL = 250;    // Interval to send logs to WebSocket if there's more data to send

class DebugLogPlugin : public Plugin {
    friend void debugLogPutcWrapper(char c);

  public:
    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override;

    // Get new logs to send over WS. This advances wsReadPos.
    String getNewWSLogs();

  private:
    void rotateLogIfNeeded();
    void flushToFile();
    void checkAndEnableLogging();
    size_t readFromCircularBuffer(size_t readPos, size_t writePos,
                                  void (*callback)(const uint8_t *data, size_t len, void *context), void *context);

    void writeCharToBuffer(char c);

    Controller *controller;
    PluginManager *pluginManager;
    Settings *settings;
    FS *fs;

    String logFilePath = "/logs.txt";
    String oldLogFilePath = "/logs.old.txt";
    unsigned long lastFlush = 0;

    uint8_t *volatile logBuffer = nullptr;
    volatile unsigned long disabledAtMillis = 0; // When >0, indicates when the plugin got disabled
    volatile size_t logWritePos = 0;
    volatile size_t wsReadPos = 0;   // For WebSocket consumers
    volatile size_t fileReadPos = 0; // For file writes
};

extern DebugLogPlugin DebugLog;

#endif // DEBUGLOGPLUGIN_H
