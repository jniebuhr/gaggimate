# Crash Logging System

## Overview

The crash logging system automatically captures ESP32 crashes and stores them in a JSON file that can be accessed through the web UI. This helps with debugging and troubleshooting when devices crash in the field.

## Features

- **Automatic Crash Detection**: Detects crashes on startup based on reset reason
- **JSON Storage**: Stores crash logs in JSON format on SPIFFS filesystem
- **Size Management**: Automatically trims old crashes when log file gets too large
- **Web Access**: Download crash logs through the System & Updates page
- **Rich Crash Data**: Captures timestamp, heap info, reset reason, and system details

## Technical Details

### Storage Location
- Crash logs are stored at `/crash_log.json` on the SPIFFS filesystem
- Maximum file size: 32KB (automatically trimmed when exceeded)
- Trim size: 16KB (keeps most recent crashes after trimming)

### Crash Data Structure
```json
{
  "crashes": [
    {
      "timestamp": 123456789,
      "uptime_ms": 123456789,
      "free_heap": 50000,
      "min_free_heap": 45000,
      "chip_revision": 3,
      "cpu_freq_mhz": 240,
      "flash_size": 4194304,
      "reset_reason": "Software reset due to exception/panic",
      "crash_info": "LoadProhibited exception details..."
    }
  ]
}
```

### API Endpoints

#### Download Crash Log
- **URL**: `/api/crash-log`
- **Method**: GET
- **Response**: JSON file containing all crash logs
- **Usage**: Used by the web UI download button

#### Debug Crash Log (Testing)
- **URL**: `/api/debug/crash`
- **Method**: POST
- **Response**: `{"status":"ok","message":"Test crash logged"}`
- **Usage**: Manually add a test crash entry for testing

## Usage

### Web UI Access
1. Navigate to System & Updates page
2. Click "Download Crash Log" button
3. Browser will download the crash log JSON file

### Manual Testing
Send a POST request to `/api/debug/crash` to add a test crash entry.

## Implementation Details

### Classes and Methods

#### WebUIPlugin Class
- `setupCrashHandler()`: Initialize crash handling system
- `checkForCrashOnStartup()`: Check for crashes on device startup
- `logCrash(crashInfo)`: Log a crash to the JSON file
- `trimCrashLog()`: Remove old crashes when file gets too large
- `handleCrashLogDownload()`: HTTP handler for crash log download
- `debugLogCrash()`: Add test crash entry for debugging

### Reset Reasons Detected
- `ESP_RST_PANIC`: Software exception/panic
- `ESP_RST_INT_WDT`: Interrupt watchdog timeout
- `ESP_RST_TASK_WDT`: Task watchdog timeout
- `ESP_RST_WDT`: Other watchdog timeout

## Integration

The crash logging system is automatically initialized when the WebUIPlugin starts and requires no user configuration. It integrates seamlessly with the existing System & Updates page in the web UI.

## Future Enhancements

- Core dump analysis and inclusion in crash logs
- Automatic crash reporting to remote servers
- More detailed stack trace capture
- Crash pattern analysis and alerts
