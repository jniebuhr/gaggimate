#include "Amoled_DisplayPanel.h"
#include "Arduino_GFX_Library.h"
#include "pin_config.h"
#include <esp_adc_cal.h>

Amoled_DisplayPanel::Amoled_DisplayPanel(AmoledHwConfig hw_config)
    : hwConfig(hw_config), displayBus(nullptr), display(nullptr), _touchDrv(nullptr), _wakeupMethod(WAKEUP_FROM_NONE),
      _sleepTimeUs(0), currentBrightness(0) {
    _rotation = 0;
}

Amoled_DisplayPanel::~Amoled_DisplayPanel() {
    uninstallSD();

    if (_touchDrv) {
        delete _touchDrv;
        _touchDrv = nullptr;
    }
    if (display) {
        display->setBrightness(0);
        digitalWrite(hwConfig.lcd_en, LOW);
        delete display;
        display = nullptr;
    }
    if (displayBus) {
        delete displayBus;
        displayBus = nullptr;
    }
}

bool Amoled_DisplayPanel::begin(Amoled_Display_Panel_Color_Order order) {
    bool success = true;

    success &= initTouch();
    success &= initDisplay(order);

    return success;
}

bool Amoled_DisplayPanel::installSD() {
    pinMode(hwConfig.sd_cs, OUTPUT);
    digitalWrite(hwConfig.sd_cs, HIGH);

    SD_MMC.setPins(hwConfig.sd_sclk, hwConfig.sd_mosi, hwConfig.sd_miso);

    return SD_MMC.begin("/sdcard", true, false);
}

void Amoled_DisplayPanel::uninstallSD() {
    SD_MMC.end();
    digitalWrite(hwConfig.sd_cs, LOW);
    pinMode(hwConfig.sd_cs, INPUT);
}

void Amoled_DisplayPanel::setBrightness(uint8_t level) {
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

uint8_t Amoled_DisplayPanel::getBrightness() { return (this->currentBrightness + 1) / 16; }

Amoled_Display_Panel_Type Amoled_DisplayPanel::getModel() { return panelType; }

const char *Amoled_DisplayPanel::getTouchModelName() { return _touchDrv->getModelName(); }

void Amoled_DisplayPanel::enableTouchWakeup() { _wakeupMethod = WAKEUP_FROM_TOUCH; }

void Amoled_DisplayPanel::enableButtonWakeup() { _wakeupMethod = WAKEUP_FROM_BUTTON; }

void Amoled_DisplayPanel::enableTimerWakeup(uint64_t time_in_us) {
    _wakeupMethod = WAKEUP_FROM_TIMER;
    _sleepTimeUs = time_in_us;
}

void Amoled_DisplayPanel::sleep() {
    if (WAKEUP_FROM_NONE == _wakeupMethod) {
        return;
    }

    setBrightness(0);

    if (WAKEUP_FROM_TOUCH != _wakeupMethod) {
        if (_touchDrv) {
            pinMode(hwConfig.tp_int, OUTPUT);
            digitalWrite(hwConfig.tp_int, LOW); // Before touch to set sleep, it is necessary to set INT to LOW

            _touchDrv->sleep();
        }
    }

    switch (_wakeupMethod) {
    case WAKEUP_FROM_TOUCH: {
        int16_t x_array[1];
        int16_t y_array[1];
        uint8_t get_point = 1;
        pinMode(hwConfig.tp_int, INPUT);

        // Wait for the finger to be lifted from the screen
        while (!digitalRead(hwConfig.tp_int)) {
            delay(100);
            // Clear touch buffer
            getPoint(x_array, y_array, get_point);
        }

        delay(2000); // Wait for the interrupt level to stabilize
        esp_sleep_enable_ext1_wakeup(_BV(hwConfig.tp_int), ESP_EXT1_WAKEUP_ANY_LOW);
    } break;
    case WAKEUP_FROM_BUTTON:
        esp_sleep_enable_ext1_wakeup(_BV(0), ESP_EXT1_WAKEUP_ANY_LOW);
        break;
    case WAKEUP_FROM_TIMER:
        esp_sleep_enable_timer_wakeup(_sleepTimeUs);
        break;
    default:
        // Default GPIO0 Wakeup
        esp_sleep_enable_ext1_wakeup(_BV(0), ESP_EXT1_WAKEUP_ANY_LOW);
        break;
    }

    Wire.end();

    pinMode(hwConfig.i2c_scl, OPEN_DRAIN);
    pinMode(hwConfig.i2c_sda, OPEN_DRAIN);

    Serial.end();

    esp_deep_sleep_start();
}
void Amoled_DisplayPanel::wakeup() {}

uint8_t Amoled_DisplayPanel::getPoint(int16_t *x_array, int16_t *y_array, uint8_t get_point) {
    if (touchType == TOUCH_CST92XX) {
        return _touchDrv->getPoint(x_array, y_array, _touchDrv->getSupportTouchPoint());
    }

    if (!_touchDrv || !_touchDrv->isPressed()) {
        return 0;
    }

    uint8_t points = _touchDrv->getPoint(x_array, y_array, get_point);

    for (uint8_t i = 0; i < points; i++) {
        int16_t rawX = x_array[i] + hwConfig.lcd_gram_offset_x;
        int16_t rawY = y_array[i] + hwConfig.lcd_gram_offset_y;

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

bool Amoled_DisplayPanel::isPressed() {
    if (_touchDrv) {
        return _touchDrv->isPressed();
    }
    return 0;
}

uint16_t Amoled_DisplayPanel::getBattVoltage(void) {
    if (hwConfig.battery_voltage_adc_data == -1) {
        return 0;
    }
    esp_adc_cal_characteristics_t adc_chars;
    esp_adc_cal_characterize(ADC_UNIT_1, ADC_ATTEN_DB_12, ADC_WIDTH_BIT_12, 1100, &adc_chars);

    const int number_of_samples = 20;
    uint32_t sum = 0;
    for (int i = 0; i < number_of_samples; i++) {
        sum += analogRead(hwConfig.battery_voltage_adc_data);
        delay(2);
    }
    sum = sum / number_of_samples;

    return esp_adc_cal_raw_to_voltage(sum, &adc_chars) * 2;
}

void Amoled_DisplayPanel::pushColors(uint16_t x, uint16_t y, uint16_t width, uint16_t height, uint16_t *data) {
    if (displayBus && display) {
        display->draw16bitRGBBitmap(x, y, data, width, height);
    }
}

void Amoled_DisplayPanel::setRotation(uint8_t rotation) {
    _rotation = rotation;

    if (displayBus && display) {
        display->setRotation(rotation);
    }
}

bool Amoled_DisplayPanel::initTouch() {
    TouchDrvCST92xx *tmp = new TouchDrvCST92xx();
    tmp->setPins(hwConfig.tp_rst, hwConfig.tp_int);

    if (tmp->begin(Wire, CST92XX_DEVICE_ADDRESS, hwConfig.i2c_sda, hwConfig.i2c_scl)) {
        _touchDrv = tmp;
        ESP_LOGI("LilyGo_TDisplayPanel", "Successfully initialized %s!\n", _touchDrv->getModelName());
        tmp->setMaxCoordinates(466, 466);
        if (hwConfig.mirror_touch) {
            tmp->setMirrorXY(true, true);
        }

        touchType = TOUCH_CST92XX;
        panelType = DISPLAY_1_75_INCHES;
        return true;
    }
    delete tmp;

    TouchDrvFT6X36 *tmp2 = new TouchDrvFT6X36();
    tmp2->setPins(hwConfig.tp_rst, hwConfig.tp_int);

    if (tmp2->begin(Wire, FT3168_DEVICE_ADDRESS, hwConfig.i2c_sda, hwConfig.i2c_scl)) {
        tmp2->interruptTrigger();

        _touchDrv = tmp2;
        ESP_LOGI("LilyGo_TDisplayPanel", "Successfully initialized %s!\n", _touchDrv->getModelName());

        touchType = TOUCH_FT3168;
        panelType = DISPLAY_1_43_INCHES;
        return true;
    }
    delete tmp2;

    ESP_LOGE("LilyGo_TDisplayPanel", "Unable to find touch device.");
    return false;
}

bool Amoled_DisplayPanel::initDisplay(Amoled_Display_Panel_Color_Order colorOrder) {
    if (displayBus == nullptr) {
        displayBus =
            new Arduino_ESP32QSPI(hwConfig.lcd_cs /* CS */, hwConfig.lcd_sclk /* SCK */, hwConfig.lcd_sdio0 /* SDIO0 */,
                                  hwConfig.lcd_sdio1 /* SDIO1 */, hwConfig.lcd_sdio2 /* SDIO2 */, hwConfig.lcd_sdio3 /* SDIO3 */);

        display = new CO5300(displayBus, hwConfig.lcd_rst /* RST */, _rotation /* rotation */, false /* IPS */,
                             hwConfig.lcd_width, hwConfig.lcd_height, hwConfig.lcd_gram_offset_x /* col offset 1 */,
                             0 /* row offset 1 */, hwConfig.lcd_gram_offset_y /* col_offset2 */, 0 /* row_offset2 */, colorOrder);
    }

    pinMode(hwConfig.lcd_en, OUTPUT);
    digitalWrite(hwConfig.lcd_en, HIGH);

    bool success = display->begin(80000000);
    if (!success) {
        ESP_LOGE("LilyGo_TDisplayPanel", "Failed to initialize display");
        return false;
    }

    switch (panelType) {
    case DISPLAY_1_75_INCHES:
        setRotation(hwConfig.rotation_175);
        break;
    case DISPLAY_1_43_INCHES:
    case DISPLAY_UNKNOWN:
    default:
        setRotation(0);
        break;
    }

    // required for correct GRAM initialization
    displayBus->writeCommand(CO5300_C_PTLON);
    display->fillScreen(BLACK);

    return success;
}
