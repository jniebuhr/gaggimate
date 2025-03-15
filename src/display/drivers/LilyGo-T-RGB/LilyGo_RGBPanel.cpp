/**
 * @file      LilyGo_RGBPanel.cpp
 * @author    Lewis He (lewishe@outlook.com)
 * @license   MIT
 * @copyright Copyright (c) 2024  Shenzhen Xin Yuan Electronic Technology Co.,
 * Ltd
 * @date      2024-01-22
 *
 */
#include "LilyGo_RGBPanel.h"
#include "utilities.h"
#include <display/drivers/common/RGBPanelInit.h>
#include <esp_adc_cal.h>

static void TouchDrvDigitalWrite(uint32_t gpio, uint8_t level);
static int TouchDrvDigitalRead(uint32_t gpio);
static void TouchDrvPinMode(uint32_t gpio, uint8_t mode);
static ExtensionIOXL9555 extension;
static const lcd_init_cmd_t *_init_cmd = NULL;

LilyGo_RGBPanel::LilyGo_RGBPanel(/* args */)
    : _brightness(0), _panelDrv(NULL), _touchDrv(NULL), _order(LILYGO_T_RGB_ORDER_RGB), _has_init(false),
      _wakeupMethod(LILYGO_T_RGB_WAKEUP_FORM_BUTTON), _sleepTimeUs(0), _touchType(LILYGO_T_RGB_TOUCH_UNKNOWN) {}

LilyGo_RGBPanel::~LilyGo_RGBPanel() {
    if (_panelDrv) {
        esp_lcd_panel_del(_panelDrv);
        _panelDrv = NULL;
    }
    if (_touchDrv) {
        delete _touchDrv;
        _touchDrv = NULL;
    }
}

bool LilyGo_RGBPanel::begin(LilyGo_RGBPanel_Color_Order order) {
    if (_panelDrv) {
        return true;
    }

    _order = order;

    pinMode(BOARD_TFT_BL, OUTPUT);
    digitalWrite(BOARD_TFT_BL, LOW);

    // Initialize the XL9555 expansion chip
    if (!extension.init(Wire, BOARD_I2C_SDA, BOARD_I2C_SCL)) {
        Serial.println("External GPIO expansion chip does not exist.");
        assert(false);
    }

    /**
     * * The power enable is connected to the XL9555 expansion chip GPIO.
     * * It must be turned on and can only be started when using a battery.
     */
    extension.pinMode(power_enable, OUTPUT);
    extension.digitalWrite(power_enable, HIGH);

    if (!initTouch()) {
        Serial.println("Touch chip not found.");
    }

    initBUS();

    getModel();

    return true;
}

bool LilyGo_RGBPanel::installSD() {
    extension.pinMode(sdmmc_cs, OUTPUT);
    extension.digitalWrite(sdmmc_cs, HIGH);

    SD_MMC.setPins(BOARD_SDMMC_SCK, BOARD_SDMMC_CMD, BOARD_SDMMC_DAT);

    if (SD_MMC.begin("/sdcard", true, false)) {
        uint8_t cardType = SD_MMC.cardType();
        if (cardType != CARD_NONE) {
            Serial.print("SD Card Type: ");
            if (cardType == CARD_MMC)
                Serial.println("MMC");
            else if (cardType == CARD_SD)
                Serial.println("SDSC");
            else if (cardType == CARD_SDHC)
                Serial.println("SDHC");
            else
                Serial.println("UNKNOWN");
            uint64_t cardSize = SD_MMC.cardSize() / (1024 * 1024);
            Serial.printf("SD Card Size: %lluMB\n", cardSize);
        }
        return true;
    }
    return false;
}

void LilyGo_RGBPanel::uninstallSD() {
    SD_MMC.end();
    extension.digitalWrite(sdmmc_cs, LOW);
    extension.pinMode(sdmmc_cs, INPUT);
}

void LilyGo_RGBPanel::setBrightness(uint8_t value) {
    static uint8_t steps = 16;

    if (_brightness == value) {
        return;
    }

    if (value > 16) {
        value = 16;
    }
    if (value == 0) {
        digitalWrite(BOARD_TFT_BL, 0);
        delay(3);
        _brightness = 0;
        return;
    }
    if (_brightness == 0) {
        digitalWrite(BOARD_TFT_BL, 1);
        _brightness = steps;
        delayMicroseconds(30);
    }
    int from = steps - _brightness;
    int to = steps - value;
    int num = (steps + to - from) % steps;
    for (int i = 0; i < num; i++) {
        digitalWrite(BOARD_TFT_BL, 0);
        digitalWrite(BOARD_TFT_BL, 1);
    }
    _brightness = value;
}

uint8_t LilyGo_RGBPanel::getBrightness() { return _brightness; }

LilyGo_RGBPanel_Type LilyGo_RGBPanel::getModel() {
    if (_touchDrv) {
        const char *model = _touchDrv->getModelName();
        if (model == NULL)
            return LILYGO_T_RGB_UNKNOWN;
        if (strlen(model) == 0)
            return LILYGO_T_RGB_UNKNOWN;
        if (strcmp(model, "FT3267") == 0) {
            _touchType = LILYGO_T_RGB_TOUCH_FT3267;
            return LILYGO_T_RGB_2_1_INCHES;
        } else if (strcmp(model, "CST820") == 0) {
            _touchType = LILYGO_T_RGB_TOUCH_CST820;
            return LILYGO_T_RGB_2_1_INCHES;
        } else if (strcmp(model, "GT911") == 0) {
            _touchType = LILYGO_T_RGB_TOUCH_GT911;
            return LILYGO_T_RGB_2_8_INCHES;
        }
    }
    return LILYGO_T_RGB_UNKNOWN;
}

const char *LilyGo_RGBPanel::getTouchModelName() {
    if (_touchDrv) {
        return _touchDrv->getModelName();
    }
    return "UNKNOWN";
}

void LilyGo_RGBPanel::enableTouchWakeup() { _wakeupMethod = LILYGO_T_RGB_WAKEUP_FORM_TOUCH; }

void LilyGo_RGBPanel::enableButtonWakeup() { _wakeupMethod = LILYGO_T_RGB_WAKEUP_FORM_BUTTON; }

void LilyGo_RGBPanel::enableTimerWakeup(uint64_t time_in_us) {
    _wakeupMethod = LILYGO_T_RGB_WAKEUP_FORM_TIMER;
    _sleepTimeUs = time_in_us;
}

// The sleep method tested CST820 and GT911, and the FTxxxx series should also
// be usable.
void LilyGo_RGBPanel::sleep() {
    // turn off blacklight
    for (int i = _brightness; i >= 0; --i) {
        setBrightness(i);
        delay(30);
    }

    if (LILYGO_T_RGB_WAKEUP_FORM_TOUCH != _wakeupMethod) {
        if (_touchDrv) {
            if (getModel() == LILYGO_T_RGB_2_8_INCHES) {
                pinMode(BOARD_TOUCH_IRQ, OUTPUT);
                digitalWrite(BOARD_TOUCH_IRQ,
                             LOW); // Before touch to set sleep, it is necessary
                                   // to set INT to LOW
            }
            _touchDrv->sleep();
        }
    }

    switch (_wakeupMethod) {
    case LILYGO_T_RGB_WAKEUP_FORM_TOUCH: {
        int16_t x_array[1];
        int16_t y_array[1];
        uint8_t get_point = 1;
        pinMode(BOARD_TOUCH_IRQ, INPUT);
        // Wait for your finger to be lifted from the screen
        while (!digitalRead(BOARD_TOUCH_IRQ)) {
            delay(100);
            // Clear touch buffer
            getPoint(x_array, y_array, get_point);
        }
        // Wait for the interrupt level to stabilize
        delay(2000);
        // Set touch irq wakeup
        esp_sleep_enable_ext1_wakeup(_BV(BOARD_TOUCH_IRQ), ESP_EXT1_WAKEUP_ALL_LOW);
    } break;
    case LILYGO_T_RGB_WAKEUP_FORM_BUTTON:
        esp_sleep_enable_ext1_wakeup(_BV(0), ESP_EXT1_WAKEUP_ALL_LOW);
        break;
    case LILYGO_T_RGB_WAKEUP_FORM_TIMER:
        esp_sleep_enable_timer_wakeup(_sleepTimeUs);
        break;
    default:
        // Default GPIO0 Wakeup
        esp_sleep_enable_ext1_wakeup(_BV(0), ESP_EXT1_WAKEUP_ALL_LOW);
        break;
    }

    if (_panelDrv) {
        esp_lcd_panel_disp_off(_panelDrv, true);
        esp_lcd_panel_del(_panelDrv);
    }

    Wire.end();

    pinMode(BOARD_I2C_SDA, OPEN_DRAIN);
    pinMode(BOARD_I2C_SCL, OPEN_DRAIN);

    Serial.end();

    // If the SD card is initialized, it needs to be unmounted.
    if (SD_MMC.cardSize()) {
        SD_MMC.end();
    }

    // Enter sleep
    esp_deep_sleep_start();
}

void LilyGo_RGBPanel::wakeup() {}

uint16_t LilyGo_RGBPanel::width() { return BOARD_TFT_WIDTH; }

uint16_t LilyGo_RGBPanel::height() { return BOARD_TFT_HEIGHT; }

uint8_t LilyGo_RGBPanel::getPoint(int16_t *x_array, int16_t *y_array, uint8_t get_point) {
    if (_touchDrv) {

        // The FT3267 type touch reading INT level is to read the coordinates
        // after pressing The CST820 interrupt level is not continuous, so the
        // register must be read all the time to obtain continuous coordinates.
        if (_touchType == LILYGO_T_RGB_TOUCH_FT3267) {
            if (!_touchDrv->isPressed()) {
                return 0;
            }
        }
        uint8_t touched = _touchDrv->getPoint(x_array, y_array, get_point);
        return touched;
    }
    return 0;
}

bool LilyGo_RGBPanel::isPressed() {
    if (_touchDrv) {
        return _touchDrv->isPressed();
    }
    return 0;
}

uint16_t LilyGo_RGBPanel::getBattVoltage() {
    esp_adc_cal_characteristics_t adc_chars;
    esp_adc_cal_characterize(ADC_UNIT_1, ADC_ATTEN_DB_11, ADC_WIDTH_BIT_12, 1100, &adc_chars);

    const int number_of_samples = 20;
    uint32_t sum = 0;
    uint16_t raw_buffer[number_of_samples] = {0};
    for (int i = 0; i < number_of_samples; i++) {
        raw_buffer[i] = analogRead(BOARD_ADC_DET);
        delay(2);
    }
    for (int i = 0; i < number_of_samples; i++) {
        sum += raw_buffer[i];
    }
    sum = sum / number_of_samples;

    return esp_adc_cal_raw_to_voltage(sum, &adc_chars) * 2;
}

void LilyGo_RGBPanel::initBUS() {
    assert(_init_cmd);

    if (_panelDrv) {
        return;
    }

    extension.pinMode(reset, OUTPUT);
    extension.digitalWrite(reset, LOW);
    delay(20);
    extension.digitalWrite(reset, HIGH);
    delay(10);

    Wire.setClock(1000000UL);
    // uint32_t start = millis();

    extension.beginSPI(mosi, -1, sclk, cs);

    int i = 0;
    while (_init_cmd[i].databytes != 0xff) {
        writeCommand(_init_cmd[i].cmd);
        writeData(_init_cmd[i].data, _init_cmd[i].databytes & 0x1F);
        if (_init_cmd[i].databytes & 0x80) {
            delay(100);
        }
        i++;
    }

    // uint32_t end = millis();

    // Serial.printf("Initialization took %u milliseconds\n", end - start);

    // Uses 400k I2C speed : Initialization took about 6229 milliseconds
    // Uses 1M   I2C speed : Initialization took about 1833 milliseconds

    // Reduce to standard speed, touch does not support access greater than
    // 400KHZ speed
    Wire.setClock(400000UL);

    const int bus_rbg_order[SOC_LCD_RGB_DATA_WIDTH] = {
        // BOARD_TFT_DATA12,    //LSB
        BOARD_TFT_DATA13,
        BOARD_TFT_DATA14,
        BOARD_TFT_DATA15,
        BOARD_TFT_DATA16,
        BOARD_TFT_DATA17,

        BOARD_TFT_DATA0,
        BOARD_TFT_DATA1,
        BOARD_TFT_DATA2,
        BOARD_TFT_DATA3,
        BOARD_TFT_DATA4,
        BOARD_TFT_DATA5,

        // BOARD_TFT_DATA6,     //LSB
        BOARD_TFT_DATA7,
        BOARD_TFT_DATA8,
        BOARD_TFT_DATA9,
        BOARD_TFT_DATA10,
        BOARD_TFT_DATA11,
    };

    esp_lcd_rgb_panel_config_t panel_config = {
        .clk_src = LCD_CLK_SRC_PLL160M,
        .timings =
            {
                .pclk_hz = RGB_MAX_PIXEL_CLOCK_HZ,
                .h_res = BOARD_TFT_WIDTH,
                .v_res = BOARD_TFT_HEIGHT,
                // The following parameters should refer to LCD spec
                .hsync_pulse_width = 1,
                .hsync_back_porch = 30,
                .hsync_front_porch = 50,
                .vsync_pulse_width = 1,
                .vsync_back_porch = 30,
                .vsync_front_porch = 20,
                .flags =
                    {
                        .pclk_active_neg = 1,
                    },
            },
        .data_width = 16, // RGB565 in parallel mode, thus 16bit in width
        .psram_trans_align = 64,
        .hsync_gpio_num = BOARD_TFT_HSYNC,
        .vsync_gpio_num = BOARD_TFT_VSYNC,
        .de_gpio_num = BOARD_TFT_DE,
        .pclk_gpio_num = BOARD_TFT_PCLK,
        .data_gpio_nums =
            {
                // BOARD_TFT_DATA0,
                BOARD_TFT_DATA13,
                BOARD_TFT_DATA14,
                BOARD_TFT_DATA15,
                BOARD_TFT_DATA16,
                BOARD_TFT_DATA17,

                BOARD_TFT_DATA6,
                BOARD_TFT_DATA7,
                BOARD_TFT_DATA8,
                BOARD_TFT_DATA9,
                BOARD_TFT_DATA10,
                BOARD_TFT_DATA11,
                // BOARD_TFT_DATA12,

                BOARD_TFT_DATA1,
                BOARD_TFT_DATA2,
                BOARD_TFT_DATA3,
                BOARD_TFT_DATA4,
                BOARD_TFT_DATA5,
            },
        .disp_gpio_num = GPIO_NUM_NC,
        .on_frame_trans_done = NULL,
        .user_ctx = NULL,
        .flags =
            {
                .fb_in_psram = 1, // allocate frame buffer in PSRAM
            },
    };

    if (_order == LILYGO_T_RGB_ORDER_BGR) {

        // Swap color order

        uint8_t data = 0x00;
        writeCommand(0x36);
        writeData(&data, 1);

        memcpy(panel_config.data_gpio_nums, bus_rbg_order, sizeof(panel_config.data_gpio_nums));
    }

    ESP_ERROR_CHECK(esp_lcd_new_rgb_panel(&panel_config, &_panelDrv));
    ESP_ERROR_CHECK(esp_lcd_panel_init(_panelDrv));
}

bool LilyGo_RGBPanel::initTouch() {
    const uint8_t touch_reset_pin = tp_reset | 0x80;
    const uint8_t touch_irq_pin = BOARD_TOUCH_IRQ;
    bool result = false;

    log_i("=================initTouch====================");
    _touchDrv = new TouchDrvCSTXXX();
    _touchDrv->setGpioCallback(TouchDrvPinMode, TouchDrvDigitalWrite, TouchDrvDigitalRead);
    _touchDrv->setPins(touch_reset_pin, touch_irq_pin);
    result = _touchDrv->begin(Wire, CST816_SLAVE_ADDRESS, BOARD_I2C_SDA, BOARD_I2C_SCL);
    if (result) {

        _init_cmd = st7701_2_1_inches;

#if ARDUHAL_LOG_LEVEL >= ARDUHAL_LOG_LEVEL_INFO
        const char *model = _touchDrv->getModelName();
        log_i("Successfully initialized %s, using %s Driver!\n", model, model);
#endif
        return true;
    }
    delete _touchDrv;

    _touchDrv = new TouchDrvGT911();
    _touchDrv->setGpioCallback(TouchDrvPinMode, TouchDrvDigitalWrite, TouchDrvDigitalRead);
    _touchDrv->setPins(touch_reset_pin, touch_irq_pin);
    result = _touchDrv->begin(Wire, GT911_SLAVE_ADDRESS_L, BOARD_I2C_SDA, BOARD_I2C_SCL);
    if (result) {
        TouchDrvGT911 *tmp = static_cast<TouchDrvGT911 *>(_touchDrv);
        tmp->setInterruptMode(FALLING);

        _init_cmd = st7701_2_8_inches;
        log_i("Successfully initialized GT911, using GT911 Driver!");
        return true;
    }
    delete _touchDrv;

    _touchDrv = new TouchDrvFT6X36();
    _touchDrv->setGpioCallback(TouchDrvPinMode, TouchDrvDigitalWrite, TouchDrvDigitalRead);
    _touchDrv->setPins(touch_reset_pin, touch_irq_pin);
    result = _touchDrv->begin(Wire, FT3267_SLAVE_ADDRESS, BOARD_I2C_SDA, BOARD_I2C_SCL);
    if (result) {

        _init_cmd = st7701_2_1_inches;

        TouchDrvFT6X36 *tmp = static_cast<TouchDrvFT6X36 *>(_touchDrv);
        tmp->interruptTrigger();

#if ARDUHAL_LOG_LEVEL >= ARDUHAL_LOG_LEVEL_INFO
        const char *model = _touchDrv->getModelName();
        log_i("Successfully initialized %s, using %s Driver!\n", model, model);
#endif

        return true;
    }
    delete _touchDrv;

    log_e("Unable to find touch device.");

    _touchDrv = NULL;

    // If touch does not exist, add a default initialization sequence
    _init_cmd = st7701_2_1_inches;

    return false;
}

void LilyGo_RGBPanel::writeCommand(const uint8_t cmd) {
    uint16_t data = cmd;
    extension.transfer9(data);
}

void LilyGo_RGBPanel::writeData(const uint8_t *data, int len) {
    uint32_t i = 0;
    if (len > 0) {
        do {
            // The ninth bit of data, 1, represents data, 0 represents command
            uint16_t pdat = (*(data + i)) | 1 << 8;
            extension.transfer9(pdat);
            i++;
        } while (len--);
    }
}

void LilyGo_RGBPanel::pushColors(uint16_t x, uint16_t y, uint16_t width, uint16_t hight, uint16_t *data) {
    assert(_panelDrv);
    esp_lcd_panel_draw_bitmap(_panelDrv, x, y, width, hight, data);
}

static void TouchDrvDigitalWrite(uint32_t gpio, uint8_t level) {
    if (gpio & 0x80) {
        extension.digitalWrite(gpio & 0x7F, level);
    } else {
        digitalWrite(gpio, level);
    }
}

static int TouchDrvDigitalRead(uint32_t gpio) {
    if (gpio & 0x80) {
        return extension.digitalRead(gpio & 0x7F);
    } else {
        return digitalRead(gpio);
    }
}

static void TouchDrvPinMode(uint32_t gpio, uint8_t mode) {
    if (gpio & 0x80) {
        extension.pinMode(gpio & 0x7F, mode);
    } else {
        pinMode(gpio, mode);
    }
}
