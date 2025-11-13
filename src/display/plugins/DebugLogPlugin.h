#ifndef DEBUGLOGPLUGIN_H
#define DEBUGLOGPLUGIN_H

#include <FS.h>
#include <WString.h>
#include <display/core/Plugin.h>
#include <esp_log.h>

constexpr size_t DEBUG_LOG_MAX_FILE_SIZE = 50 * 1024; // 50KB max log size
constexpr size_t DEBUG_LOG_FLUSH_INTERVAL = 5000;     // Flush every 5 seconds
constexpr size_t DEBUG_LOG_BUFFER_SIZE = 16384;       // 16KB circular buffer for WebSocket
constexpr size_t DEBUG_LOG_WS_INTERVAL = 1000;        // Send logs to WebSocket every 1 second

class DebugLogPlugin : public Plugin {
    friend void debugLogPutcWrapper(char c);

  public:
    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override;

    // Get new log data as a string (consumes from buffer)
    String getNewLogs();

  private:
    void rotateLogIfNeeded();
    void flushToFile();
    size_t readFromCircularBuffer(size_t readPos, size_t writePos,
                                  void (*callback)(const uint8_t *data, size_t len, void *context), void *context);

    void writeCharToBuffer(char c);

    Controller *controller = nullptr;
    PluginManager *pluginManager = nullptr;
    FS *fs = nullptr;
    String logFilePath = "/logs.txt";
    String oldLogFilePath = "/logs.old.txt";
    unsigned long lastFlush = 0;
    volatile bool isBufferAlmostFull = false;

    // Circular buffer for WebSocket logs and file writes
    uint8_t logBuffer[DEBUG_LOG_BUFFER_SIZE];
    volatile size_t logWritePos = 0;
    volatile size_t wsReadPos = 0;   // For WebSocket consumers
    volatile size_t fileReadPos = 0; // For file writes
};

extern DebugLogPlugin DebugLog;

#endif // DEBUGLOGPLUGIN_H
