# GaggiMate Firmware Flasher

This directory contains a web-based firmware flasher for GaggiMate boards using ESP Web Tools.

## Quick Start

### Option 1: Using Python (Recommended)
1. Ensure Python 3 is installed on your system
2. Double-click `start_flasher.bat` (Windows) or run `python serve_flasher.py`
3. Your browser should open automatically to the flasher page
4. If not, manually open http://localhost:8000/flasher.html

### Option 2: Using any Web Server
1. Serve this directory using any web server (nginx, Apache, etc.)
2. Open the flasher.html file in Chrome or Edge
3. Make sure the server supports HTTPS or serves from localhost

## Requirements

- **Browser:** Chrome 89+ or Edge 89+ (Web Serial API support required)
- **USB Cable:** Connect your ESP32-S3 board via USB
- **Download Mode:** Put your board in download mode before flashing

## How to Use

1. **Connect your board** via USB
2. **Enter download mode:**
   - Hold the BOOT button
   - Press and release the RESET button
   - Release the BOOT button
3. **Open the flasher page** in Chrome/Edge
4. **Select the correct firmware:**
   - **Display Firmware:** For LilyGo T-RGB boards (display units)
   - **Controller Firmware:** For GaggiMate Controller boards
5. **Click "Install Firmware"** and follow the prompts
6. **Select your USB port** when prompted
7. **Wait for flashing to complete**

## Firmware Files

- `firmware/gaggimate-display.bin` - Display firmware for LilyGo T-RGB
- `firmware/gaggimate-controller.bin` - Controller firmware for GaggiMate Controller

## Troubleshooting

### "Browser doesn't work" Error
- Make sure you're using Chrome 89+ or Edge 89+
- Ensure you're accessing via HTTPS or localhost
- Try refreshing the page

### "Not allowed on HTTP" Error
- The page must be served via HTTPS or localhost
- Use the provided Python server or serve via HTTPS

### Board Not Detected
- Check USB cable connection
- Ensure board is in download mode (BOOT + RESET sequence)
- Try a different USB port
- Check if drivers are installed for your ESP32-S3 board

### Flash Failed
- Ensure correct firmware is selected for your board type
- Try putting the board in download mode again
- Check USB cable quality
- Restart the browser and try again

## Building Firmware

To rebuild the firmware from source:

```bash
# For display firmware
platformio run -e display

# For controller firmware  
platformio run -e controller

# Copy built firmware to firmware directory
copy .pio\build\display\firmware.bin firmware\gaggimate-display.bin
copy .pio\build\controller\firmware.bin firmware\gaggimate-controller.bin
```

## Board Information

### LilyGo T-RGB (Display)
- Chip: ESP32-S3
- Flash: 16MB
- PSRAM: 8MB OPI
- Features: WiFi, Bluetooth, Touchscreen

### GaggiMate Controller
- Chip: ESP32-S3  
- Flash: 8MB
- PSRAM: 8MB OPI
- Features: PID Control, Sensors, Bluetooth

## Security Note

This flasher runs locally and does not send any data to external servers. All flashing happens directly between your browser and the connected device.
