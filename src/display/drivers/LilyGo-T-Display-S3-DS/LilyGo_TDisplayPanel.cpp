#include "LilyGo_TDisplayPanel.h"
#include "Arduino_GFX_Library.h"
#include "TouchDrvFT6x36.hpp"
#include "pin_config.h"

LilyGo_TDisplayPanel::LilyGo_TDisplayPanel() {}

LilyGo_TDisplayPanel::~LilyGo_TDisplayPanel() {}

bool LilyGo_TDisplayPanel::begin(LilyGo_TDisplayPanel_Color_Order order) {
    Serial.println("Starting display");

    bool success = initDisplay();
    delay(100);
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

const char *LilyGo_TDisplayPanel::getTouchModelName() { return nullptr; }

void LilyGo_TDisplayPanel::enableTouchWakeup() {}

void LilyGo_TDisplayPanel::enableButtonWakeup() {}

void LilyGo_TDisplayPanel::enableTimerWakeup(uint64_t time_in_us) {}

void LilyGo_TDisplayPanel::sleep() {}

void LilyGo_TDisplayPanel::wakeup() {}

uint8_t LilyGo_TDisplayPanel::getPoint(int16_t *x_array, int16_t *y_array, uint8_t get_point) {
    if (_touchDrv) {
        // The FT3267 type touch reading INT level is to read the coordinates
        // after pressing The CST820 interrupt level is not continuous, so the
        // register must be read all the time to obtain continuous coordinates.
        if (!_touchDrv->isPressed()) {
            return 0;
        }

        return _touchDrv->getPoint(x_array, y_array, get_point);
    }
    return 0;
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

        display = new Arduino_CO5300(displayBus, LCD_RST /* RST */, 0 /* rotation */, false /* IPS */, LCD_WIDTH, LCD_HEIGHT,
                                     6 /* col offset 1 */, 0 /* row offset 1 */, 0 /* col_offset2 */, 0 /* row_offset2 */);
    }

    pinMode(LCD_EN, OUTPUT);
    digitalWrite(LCD_EN, HIGH);

    bool success = display->begin(80000000);
    displayBus->writeCommand(CO5300_C_PTLON);
    display->fillScreen(BLACK);

    return success;
}
