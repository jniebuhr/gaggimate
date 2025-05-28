#include "LilyGo_TDisplayPanel.h"
#include "Arduino_GFX_Library.h"
#include "TouchDrvFT6x36.hpp"
#include "pin_config.h"

LilyGo_TDisplayPanel::LilyGo_TDisplayPanel() { _rotation = 0; }

LilyGo_TDisplayPanel::~LilyGo_TDisplayPanel() {}

bool LilyGo_TDisplayPanel::begin(LilyGo_TDisplayPanel_Color_Order order) {
    bool success = false;
    success = initDisplay();
    success &= initTouch();

    Serial.println("Display initialized");

    return success;
}

bool LilyGo_TDisplayPanel::installSD() { return false; }

void LilyGo_TDisplayPanel::uninstallSD() {}

void LilyGo_TDisplayPanel::setBrightness(uint8_t level) {
    uint16_t brightness = level * 16;

    brightness = brightness > 255 ? 255 : brightness;
    brightness = brightness < 0 ? 0 : brightness;

    if (brightness > this->currentBrightness) {
        for (int i = this->currentBrightness; i <= brightness; i++) {
            display->setBrightness(i);
            delay(3);
        }
    } else {
        for (int i = this->currentBrightness; i >= brightness; i--) {
            display->setBrightness(i);
            delay(3);
        }
    }
    this->currentBrightness = brightness;
}

uint8_t LilyGo_TDisplayPanel::getBrightness() { return (this->currentBrightness + 1) / 16; }

LilyGo_TDisplayPanel_Type LilyGo_TDisplayPanel::getModel() { return LilyGo_TDisplayPanel_Type(); }

const char *LilyGo_TDisplayPanel::getTouchModelName() { return _touchDrv->getModelName(); }

void LilyGo_TDisplayPanel::enableTouchWakeup() {}

void LilyGo_TDisplayPanel::enableButtonWakeup() {}

void LilyGo_TDisplayPanel::enableTimerWakeup(uint64_t time_in_us) {}

void LilyGo_TDisplayPanel::sleep() {}

void LilyGo_TDisplayPanel::wakeup() {}

uint8_t LilyGo_TDisplayPanel::getPoint(int16_t *x_array, int16_t *y_array, uint8_t get_point) {
    if (!_touchDrv || !_touchDrv->isPressed()) {
        return 0;
    }

    uint8_t points = _touchDrv->getPoint(x_array, y_array, get_point);

    for (uint8_t i = 0; i < points; i++) {
        int16_t rawX = x_array[i];
        int16_t rawY = y_array[i];

        switch (_rotation) {
        case 1: // 90°
            x_array[i] = rawY;
            y_array[i] = width() - rawX;
            break;
        case 2: // 180°
            x_array[i] = width() - rawX;
            y_array[i] = height() - rawY;
            break;
        case 3: // 270°
            x_array[i] = height() - rawY;
            y_array[i] = rawX;
            break;
        default: // 0°
            break;
        }
    }

    return points;
}

bool LilyGo_TDisplayPanel::isPressed() {
    if (_touchDrv) {
        return _touchDrv->isPressed();
    }
    return 0;
}

uint16_t LilyGo_TDisplayPanel::getBattVoltage(void) { return 0; }

void LilyGo_TDisplayPanel::pushColors(uint16_t x, uint16_t y, uint16_t width, uint16_t height, uint16_t *data) {
    display->draw16bitRGBBitmap(x, y, data, width, height);
}

void LilyGo_TDisplayPanel::setRotation(uint8_t rotation) {
    _rotation = rotation;

    if (displayBus && display) {
        // Set the rotation of the display for the Arduino_GFX library
        display->setRotation(rotation);

        // Override the rotation of the display for the CO5300 display directly
        uint8_t r;
        switch (_rotation) {
        case 1:
            r = CO5300_MADCTL_COLOR_ORDER | 0x60;
            break;
        case 2:
            r = CO5300_MADCTL_COLOR_ORDER | 0xC0;
            break;
        case 3:
            r = CO5300_MADCTL_COLOR_ORDER | 0xA0;
            break;
        case 0:
        default:
            r = CO5300_MADCTL_COLOR_ORDER;
            break;
        }
        displayBus->beginWrite();
        displayBus->writeC8D8(CO5300_W_MADCTL, r);
        displayBus->endWrite();
    }
}

bool LilyGo_TDisplayPanel::initTouch() {
    bool result = false;

    log_i("=================initTouch====================");

    _touchDrv = new TouchDrvFT6X36();
    _touchDrv->setPins(TP_RST, TP_INT);

    result = _touchDrv->begin(Wire, FT3168_DEVICE_ADDRESS, IIC_SDA, IIC_SCL);

    if (result) {
        TouchDrvFT6X36 *tmp = static_cast<TouchDrvFT6X36 *>(_touchDrv);
        tmp->interruptTrigger();

        const char *model = _touchDrv->getModelName();
        log_i("Successfully initialized %s, using %s Driver!\n", model, model);

        return true;
    }

    log_e("Unable to find touch device.");
    return false;
}

bool LilyGo_TDisplayPanel::initDisplay() {
    if (displayBus == nullptr) {
        displayBus = new Arduino_ESP32QSPI(LCD_CS /* CS */, LCD_SCLK /* SCK */, LCD_SDIO0 /* SDIO0 */, LCD_SDIO1 /* SDIO1 */,
                                           LCD_SDIO2 /* SDIO2 */, LCD_SDIO3 /* SDIO3 */);

        display =
            new Arduino_CO5300(displayBus, LCD_RST /* RST */, _rotation /* rotation */, false /* IPS */, LCD_WIDTH, LCD_HEIGHT,
                               6 /* col offset 1 */, 0 /* row offset 1 */, 8 /* col_offset2 */, 0 /* row_offset2 */);
    }

    pinMode(LCD_EN, OUTPUT);
    digitalWrite(LCD_EN, HIGH);

    bool success = display->begin(80000000);
    this->setRotation(_rotation);

    // required for correct GRAM initialization
    displayBus->writeCommand(CO5300_C_PTLON);
    display->fillScreen(BLACK);

    return success;
}
