#include "LilyGo_TDisplayPanel.h"
#include "Arduino_GFX_Library.h"
#include "pin_config.h"
#include <esp_adc_cal.h>

LilyGo_TDisplayPanel::LilyGo_TDisplayPanel()
    : displayBus(nullptr), display(nullptr), _touchDrv(nullptr), _wakeupMethod(LILYGO_T_DISPLAY_WAKEUP_FROM_NONE),
      _sleepTimeUs(0), currentBrightness(0) {
    _rotation = 0;
}

LilyGo_TDisplayPanel::~LilyGo_TDisplayPanel() {
    uninstallSD();

    if (_touchDrv) {
        delete _touchDrv;
        _touchDrv = nullptr;
    }
    if (display) {
        display->setBrightness(0);
        digitalWrite(LCD_EN, LOW);
        delete display;
        display = nullptr;
    }
    if (displayBus) {
        delete displayBus;
        displayBus = nullptr;
    }
}

bool LilyGo_TDisplayPanel::begin(LilyGo_TDisplayPanel_Color_Order order) {
    bool success = true;

    success &= initDisplay(order);
    success &= initTouch();

    return success;
}

bool LilyGo_TDisplayPanel::installSD() {
    pinMode(SD_CS, OUTPUT);
    digitalWrite(SD_CS, HIGH);

    SD_MMC.setPins(SD_SCLK, SD_MOSI, SD_MISO);

    return SD_MMC.begin("/sdcard", true, false);
}

void LilyGo_TDisplayPanel::uninstallSD() {
    SD_MMC.end();
    digitalWrite(SD_CS, LOW);
    pinMode(SD_CS, INPUT);
}

void LilyGo_TDisplayPanel::setBrightness(uint8_t level) {
    uint16_t brightness = level * 16;

    brightness = brightness > 255 ? 255 : brightness;
    brightness = brightness < 0 ? 0 : brightness;

    if (brightness > this->currentBrightness) {
        for (int i = this->currentBrightness; i <= brightness; i++) {
            display->setBrightness(i);
            delay(1);
        }
    } else {
        for (int i = this->currentBrightness; i >= brightness; i--) {
            display->setBrightness(i);
            delay(1);
        }
    }
    this->currentBrightness = brightness;
}

uint8_t LilyGo_TDisplayPanel::getBrightness() { return (this->currentBrightness + 1) / 16; }

LilyGo_TDisplayPanel_Type LilyGo_TDisplayPanel::getModel() { return LILYGO_T_TDISPLAY_1_43_INCHES; }

const char *LilyGo_TDisplayPanel::getTouchModelName() { return _touchDrv->getModelName(); }

void LilyGo_TDisplayPanel::enableTouchWakeup() { _wakeupMethod = LILYGO_T_DISPLAY_WAKEUP_FROM_TOUCH; }

void LilyGo_TDisplayPanel::enableButtonWakeup() { _wakeupMethod = LILYGO_T_DISPLAY_WAKEUP_FROM_BUTTON; }

void LilyGo_TDisplayPanel::enableTimerWakeup(uint64_t time_in_us) {
    _wakeupMethod = LILYGO_T_DISPLAY_WAKEUP_FROM_TIMER;
    _sleepTimeUs = time_in_us;
}

void LilyGo_TDisplayPanel::sleep() {
    if (LILYGO_T_DISPLAY_WAKEUP_FROM_NONE == _wakeupMethod) {
        return;
    }

    setBrightness(0);

    if (LILYGO_T_DISPLAY_WAKEUP_FROM_TOUCH != _wakeupMethod) {
        if (_touchDrv) {
            pinMode(TP_INT, OUTPUT);
            digitalWrite(TP_INT, LOW); // Before touch to set sleep, it is necessary to set INT to LOW

            _touchDrv->sleep();
        }
    }

    switch (_wakeupMethod) {
    case LILYGO_T_DISPLAY_WAKEUP_FROM_TOUCH: {
        int16_t x_array[1];
        int16_t y_array[1];
        uint8_t get_point = 1;
        pinMode(TP_INT, INPUT);

        // Wait for the finger to be lifted from the screen
        while (!digitalRead(TP_INT)) {
            delay(100);
            // Clear touch buffer
            getPoint(x_array, y_array, get_point);
        }

        delay(2000); // Wait for the interrupt level to stabilize
        esp_sleep_enable_ext1_wakeup(_BV(TP_INT), ESP_EXT1_WAKEUP_ANY_LOW);
    } break;
    case LILYGO_T_DISPLAY_WAKEUP_FROM_BUTTON:
        esp_sleep_enable_ext1_wakeup(_BV(0), ESP_EXT1_WAKEUP_ANY_LOW);
        break;
    case LILYGO_T_DISPLAY_WAKEUP_FROM_TIMER:
        esp_sleep_enable_timer_wakeup(_sleepTimeUs);
        break;
    default:
        // Default GPIO0 Wakeup
        esp_sleep_enable_ext1_wakeup(_BV(0), ESP_EXT1_WAKEUP_ANY_LOW);
        break;
    }

    Wire.end();

    pinMode(IIC_SCL, OPEN_DRAIN);
    pinMode(IIC_SDA, OPEN_DRAIN);

    Serial.end();

    esp_deep_sleep_start();
}
void LilyGo_TDisplayPanel::wakeup() {}

uint8_t LilyGo_TDisplayPanel::getPoint(int16_t *x_array, int16_t *y_array, uint8_t get_point) {
    if (!_touchDrv || !_touchDrv->isPressed()) {
        return 0;
    }

    uint8_t points = _touchDrv->getPoint(x_array, y_array, get_point);

    for (uint8_t i = 0; i < points; i++) {
        int16_t rawX = x_array[i] + LCD_GRAM_OFFSET_X;
        int16_t rawY = y_array[i] + LCD_GRAM_OFFSET_Y;

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
            x_array[i] = rawX;
            y_array[i] = rawY;
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

uint16_t LilyGo_TDisplayPanel::getBattVoltage(void) {
    esp_adc_cal_characteristics_t adc_chars;
    esp_adc_cal_characterize(ADC_UNIT_1, ADC_ATTEN_DB_12, ADC_WIDTH_BIT_12, 1100, &adc_chars);

    const int number_of_samples = 20;
    uint32_t sum = 0;
    for (int i = 0; i < number_of_samples; i++) {
        sum += analogRead(BATTERY_VOLTAGE_ADC_DATA);
        delay(2);
    }
    sum = sum / number_of_samples;

    return esp_adc_cal_raw_to_voltage(sum, &adc_chars) * 2;
}

void LilyGo_TDisplayPanel::pushColors(uint16_t x, uint16_t y, uint16_t width, uint16_t height, uint16_t *data) {
    if (displayBus && display) {
        display->draw16bitRGBBitmap(x, y, data, width, height);
    }
}

void LilyGo_TDisplayPanel::setRotation(uint8_t rotation) {
    _rotation = rotation;

    if (displayBus && display) {
        display->setRotation(rotation);
    }
}

bool LilyGo_TDisplayPanel::initTouch() {
    TouchDrvFT6X36 *tmp = new TouchDrvFT6X36();
    tmp->setPins(TP_RST, TP_INT);

    if (tmp->begin(Wire, FT3168_DEVICE_ADDRESS, IIC_SDA, IIC_SCL)) {
        tmp->interruptTrigger();
        _touchDrv = tmp;

        const char *model = _touchDrv->getModelName();
        log_i("Successfully initialized %s, using %s Driver!\n", model, model);

        return true;
    }

    log_e("Unable to find touch device.");
    return false;
}

bool LilyGo_TDisplayPanel::initDisplay(LilyGo_TDisplayPanel_Color_Order colorOrder) {
    if (displayBus == nullptr) {
        displayBus = new Arduino_ESP32QSPI(LCD_CS /* CS */, LCD_SCLK /* SCK */, LCD_SDIO0 /* SDIO0 */, LCD_SDIO1 /* SDIO1 */,
                                           LCD_SDIO2 /* SDIO2 */, LCD_SDIO3 /* SDIO3 */);

        display = new CO5300(displayBus, LCD_RST /* RST */, _rotation /* rotation */, false /* IPS */, LCD_WIDTH, LCD_HEIGHT,
                             LCD_GRAM_OFFSET_X /* col offset 1 */, 0 /* row offset 1 */, LCD_GRAM_OFFSET_Y /* col_offset2 */,
                             0 /* row_offset2 */, colorOrder);
    }

    pinMode(LCD_EN, OUTPUT);
    digitalWrite(LCD_EN, HIGH);

    bool success = display->begin(80000000);
    if (!success) {
        ESP_LOGE("LilyGo_TDisplayPanel", "Failed to initialize display");
        return false;
    }

    this->setRotation(_rotation);

    // required for correct GRAM initialization
    displayBus->writeCommand(CO5300_C_PTLON);
    display->fillScreen(BLACK);

    return success;
}
