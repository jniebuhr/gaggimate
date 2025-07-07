# 🔧 GaggiMate Firmware Flasher

A web-based firmware flasher for GaggiMate boards using ESP Web Tools, hosted on GitHub Pages.

## 🌐 Live Flasher

**👉 [Flash Your GaggiMate Board Now](https://yourusername.github.io/gaggimate/flasher/)**

*Replace `yourusername` with your actual GitHub username*

## 📋 Requirements

- **Browser:** Chrome 89+ or Edge 89+ (Web Serial API support required)
- **USB Cable:** Data-capable USB cable to connect your ESP32-S3 board
- **Drivers:** ESP32-S3 drivers (usually installed automatically)

## 🚀 How to Use

1. **Visit the flasher page** using the link above
2. **Connect your board** via USB
3. **Enter download mode:**
   - Hold the **BOOT** button
   - Press and release the **RESET** button  
   - Release the **BOOT** button
4. **Select the appropriate firmware:**
   - **Display Firmware:** For LilyGo T-RGB boards
   - **Controller Firmware:** For GaggiMate Controller boards
5. **Click "Install"** and select your USB port
6. **Wait for flashing to complete**
7. **Reset your board** when done

## 🛠️ Setting Up GitHub Pages

To deploy this flasher on your own GitHub Pages:

### 1. Enable GitHub Pages
1. Go to your repository settings
2. Scroll to "Pages" section
3. Set source to "Deploy from a branch"
4. Select branch: `main` (or your default branch)
5. Set folder: `/docs`
6. Click "Save"

### 2. Update Firmware Files
After building new firmware:
```bash
# Copy built firmware to docs directory
copy .pio\build\display\firmware.bin docs\flasher\firmware\gaggimate-display.bin
copy .pio\build\controller\firmware.bin docs\flasher\firmware\gaggimate-controller.bin

# Commit and push changes
git add docs/flasher/firmware/
git commit -m "Update firmware files"
git push
```

### 3. Access Your Flasher
Your flasher will be available at:
```
https://yourusername.github.io/repository-name/flasher/
```

## 📁 File Structure

```
docs/flasher/
├── index.html              # Main flasher page
├── firmware/
│   ├── gaggimate-display.bin    # Display firmware
│   └── gaggimate-controller.bin # Controller firmware
└── manifests/
    ├── display-manifest.json    # Display firmware manifest
    └── controller-manifest.json # Controller firmware manifest
```

## 🔧 Building Firmware

To rebuild firmware from source:

```bash
# Build display firmware
platformio run -e display

# Build controller firmware  
platformio run -e controller

# Copy to flasher directory
copy .pio\build\display\firmware.bin docs\flasher\firmware\gaggimate-display.bin
copy .pio\build\controller\firmware.bin docs\flasher\firmware\gaggimate-controller.bin
```

## 📱 Board Information

### LilyGo T-RGB (Display)
- **Chip:** ESP32-S3
- **Flash:** 16MB  
- **PSRAM:** 8MB OPI
- **Features:** WiFi, Bluetooth, Touchscreen

### GaggiMate Controller
- **Chip:** ESP32-S3
- **Flash:** 8MB
- **PSRAM:** 8MB OPI  
- **Features:** PID Control, Sensors, Bluetooth

## 🛡️ Security & Privacy

- All flashing happens locally in your browser
- No data is sent to external servers
- Firmware files are served directly from GitHub
- ESP Web Tools handles the secure serial communication

## 🐛 Troubleshooting

### Browser Issues
- ✅ Use Chrome 89+ or Edge 89+
- ✅ Ensure you're on HTTPS (GitHub Pages provides this automatically)
- ✅ Try refreshing the page

### Connection Issues  
- ✅ Check USB cable (must support data transfer)
- ✅ Ensure board is in download mode
- ✅ Try different USB port
- ✅ Check ESP32-S3 drivers are installed

### Flashing Issues
- ✅ Select correct firmware for your board type
- ✅ Don't disconnect USB during flashing
- ✅ Try putting board in download mode again
- ✅ Restart browser and try again

## 📝 License

This project is open source. See the main repository for license details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test the flasher locally
5. Submit a pull request

## 💡 Tips

- **Bookmark the flasher page** for easy access
- **Test locally first** using the Python server before pushing to GitHub
- **Keep firmware files under 25MB** (GitHub file size limit)
- **Use descriptive commit messages** when updating firmware

---

Made with ❤️ for the GaggiMate community
