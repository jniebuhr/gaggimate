#include "WaveshareLCDPanel.h"
#include "pin_config.h"
#include "WS_ST77916.h"

// Include TCA9554PWR from existing Waveshare driver
#include <display/drivers/Waveshare/TCA9554PWR.h>
#include <display/drivers/Waveshare/I2C_Driver.h>

// Arduino GFX Library - includes QSPI bus
#include "Arduino_GFX_Library.h"

// Touch driver
#include <TouchDrvCSTXXX.hpp>

// SD Card
#include <SD.h>
#include <SPI.h>

WaveshareLCDPanel::WaveshareLCDPanel()
    : _brightness(0), _panelType(WS_LCD_UNKNOWN), _touchType(WS_LCD_TOUCH_UNKNOWN),
      _bus(nullptr), _gfx(nullptr), _touchDrv(nullptr), 
      _initialized(false), _sdCardInstalled(false),
      _panel_handle(nullptr), _io_handle(nullptr) {
}

WaveshareLCDPanel::~WaveshareLCDPanel() {
    if (_touchDrv) {
        delete _touchDrv;
        _touchDrv = nullptr;
    }
    if (_gfx) {
        delete (WS_ST77916*)_gfx;
        _gfx = nullptr;
    }
    if (_bus) {
        delete (Arduino_ESP32QSPI*)_bus;
        _bus = nullptr;
    }
}

bool WaveshareLCDPanel::begin() {
    if (_initialized) {
        return true;
    }

    // Initialize backlight PWM (10-bit resolution like official code)
    ledcSetup(WS_LCD_185_PWM_CHANNEL, WS_LCD_185_PWM_FREQ, WS_LCD_185_PWM_RESOLUTION);
    ledcAttachPin(WS_LCD_185_BL, WS_LCD_185_PWM_CHANNEL);
    setBrightness(0); // Start with backlight off

    // Initialize I2C Bus 0 (Wire) for GPIO expander
    if (!initI2C()) {
        Serial.println(F("WaveshareLCDPanel: I2C init failed"));
        return false;
    }

    // Initialize TCA9554PWR GPIO expander
    if (!initGPIOExpander()) {
        Serial.println(F("WaveshareLCDPanel: GPIO expander init failed"));
        return false;
    }

    // Reset and initialize display
    if (!initDisplay()) {
        Serial.println(F("WaveshareLCDPanel: Display init failed"));
        return false;
    }

    // Initialize touch controller on separate I2C bus (Wire1)
    if (!initTouch()) {
        Serial.println(F("WaveshareLCDPanel: Touch init failed - continuing without touch"));
    }

    _panelType = WS_LCD_1_85_INCHES;
    _initialized = true;

    // Fade in backlight (50% = 512 for 10-bit)
    for (int i = 0; i <= 512; i += 32) {
        setBrightness(i);
        delay(20);
    }

    Serial.println(F("WaveshareLCDPanel: Initialization complete"));
    return true;
}

bool WaveshareLCDPanel::initI2C() {
    // Initialize I2C Bus 0 (Wire) for TCA9554PWR GPIO Expander
    Wire.begin(WS_LCD_185_I2C0_SDA, WS_LCD_185_I2C0_SCL);
    Wire.setClock(400000);
    delay(10);
    return true;
}

bool WaveshareLCDPanel::initGPIOExpander() {
    // Initialize TCA9554PWR with all pins as output, low
    TCA9554PWR_Init(0x00);
    delay(10);
    return true;
}

void WaveshareLCDPanel::resetLCD() {
    // Reset LCD via TCA9554PWR EXIO_PIN2
    Set_EXIO(EXIO_PIN2, Low);
    delay(10);
    Set_EXIO(EXIO_PIN2, High);
    delay(50);
}

void WaveshareLCDPanel::resetTouch() {
    // Reset Touch via TCA9554PWR EXIO_PIN1
    Set_EXIO(EXIO_PIN1, Low);
    delay(10);
    Set_EXIO(EXIO_PIN1, High);
    delay(50);
}

bool WaveshareLCDPanel::initDisplay() {
    // Reset the display first via GPIO expander
    resetLCD();
    delay(120);  // Wait for reset to complete

    // Create QSPI bus using Arduino_GFX library
    Arduino_ESP32QSPI *bus = new Arduino_ESP32QSPI(
        WS_LCD_185_CS,    // CS
        WS_LCD_185_SCK,   // SCK
        WS_LCD_185_SDA0,  // D0
        WS_LCD_185_SDA1,  // D1
        WS_LCD_185_SDA2,  // D2
        WS_LCD_185_SDA3   // D3
    );
    _bus = bus;

    // Create ST77916 display driver with Waveshare init sequence
    WS_ST77916 *gfx = new WS_ST77916(
        bus,
        -1,                    // RST pin (-1 because we use GPIO expander)
        0,                     // Rotation
        false,                 // IPS
        WS_LCD_185_WIDTH,      // Width (360)
        WS_LCD_185_HEIGHT      // Height (360)
    );
    _gfx = gfx;

    // Initialize display at 80MHz
    if (!gfx->begin(80000000)) {
        Serial.println(F("WaveshareLCDPanel: GFX begin failed"));
        return false;
    }

    // Fill screen with black
    gfx->fillScreen(BLACK);

    Serial.printf("WaveshareLCDPanel: Display initialized (%dx%d)\n", 
                  WS_LCD_185_WIDTH, WS_LCD_185_HEIGHT);
    return true;
}

bool WaveshareLCDPanel::initTouch() {
    // Reset touch controller first via GPIO expander
    resetTouch();
    delay(50);
    
    // Initialize I2C Bus 1 (Wire1) for Touch
    Wire1.begin(WS_LCD_185_I2C1_SDA, WS_LCD_185_I2C1_SCL);
    Wire1.setClock(400000);
    delay(10);
    
    TouchDrvCSTXXX *touch = new TouchDrvCSTXXX();
    
    touch->setPins(WS_LCD_185_TP_RST, WS_LCD_185_TP_INT);
    
    // Use Wire1 for touch
    if (touch->begin(Wire1, WS_LCD_185_CST816_ADDR, WS_LCD_185_I2C1_SDA, WS_LCD_185_I2C1_SCL)) {
        _touchDrv = touch;
        _touchType = WS_LCD_TOUCH_CST816;
        touch->setMaxCoordinates(WS_LCD_185_WIDTH, WS_LCD_185_HEIGHT);
        Serial.printf("WaveshareLCDPanel: Touch initialized (CST816 @ 0x%02X)\n", WS_LCD_185_CST816_ADDR);
        return true;
    }
    
    Serial.println(F("WaveshareLCDPanel: CST816 not found on Wire1"));
    delete touch;
    return false;
}

void WaveshareLCDPanel::setBrightness(int brightness) {
    _brightness = constrain(brightness, 0, WS_LCD_185_BACKLIGHT_MAX);
    ledcWrite(WS_LCD_185_PWM_CHANNEL, _brightness);
}

String WaveshareLCDPanel::getModel() {
    return "Waveshare 1.85\" LCD (360x360)";
}

void WaveshareLCDPanel::sleep() {
    setBrightness(0);
    WS_ST77916 *gfx = (WS_ST77916*)_gfx;
    if (gfx) {
        gfx->displayOff();
    }
}

void WaveshareLCDPanel::wakeup() {
    WS_ST77916 *gfx = (WS_ST77916*)_gfx;
    if (gfx) {
        gfx->displayOn();
    }
    setBrightness(512);
}

uint16_t WaveshareLCDPanel::width() {
    return WS_LCD_185_WIDTH;  // Native 360
}

uint16_t WaveshareLCDPanel::height() {
    return WS_LCD_185_HEIGHT;  // Native 360
}

uint8_t WaveshareLCDPanel::getPoint(int16_t *x, int16_t *y, uint8_t get_point) {
    if (!_touchDrv || !_touchDrv->isPressed()) {
        return 0;
    }
    
    return _touchDrv->getPoint(x, y, get_point);
}

void WaveshareLCDPanel::pushColors(uint16_t x, uint16_t y, uint16_t w, uint16_t h, uint16_t *data) {
    WS_ST77916 *gfx = (WS_ST77916*)_gfx;
    if (!gfx) return;
    
    gfx->draw16bitRGBBitmap(x, y, data, w, h);
}

bool WaveshareLCDPanel::installSD() {
    Serial.println(F("WaveshareLCDPanel: SD Card not supported yet"));
    return false;
}

void WaveshareLCDPanel::uninstallSD() {
    if (_sdCardInstalled) {
        SD.end();
        _sdCardInstalled = false;
    }
}
