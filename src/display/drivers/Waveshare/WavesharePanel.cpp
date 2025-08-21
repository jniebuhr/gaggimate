#include "WavesharePanel.h"
#include "I2C_Driver.h"
#include "TCA9554PWR.h"
#include "driver/gpio.h"
#include "driver/spi_master.h"
#include "utilities.h"
#include <display/drivers/common/RGBPanelInit.h>
#include <esp_adc_cal.h>

static void TouchDrvDigitalWrite(uint32_t gpio, uint8_t level);
static int TouchDrvDigitalRead(uint32_t gpio);
static void TouchDrvPinMode(uint32_t gpio, uint8_t mode);

void ST7701_CS_EN() {
    Set_EXIO(EXIO_PIN3, Low);
    delay(10);
}

void ST7701_CS_Dis() {
    Set_EXIO(EXIO_PIN3, High);
    delay(10);
}

void ST7701_Reset() {
    Set_EXIO(EXIO_PIN1, Low);
    delay(20);
    Set_EXIO(EXIO_PIN1, High);
    delay(10);
}

WavesharePanel::WavesharePanel(/* args */)
    : _brightness(0), _panelDrv(nullptr), _touchDrv(nullptr), _order(WS_T_RGB_ORDER_RGB), _has_init(false),
      _wakeupMethod(WS_T_RGB_WAKEUP_FORM_BUTTON), _sleepTimeUs(0), _touchType(WS_T_RGB_TOUCH_UNKNOWN) {}

WavesharePanel::~WavesharePanel() {
    if (_panelDrv) {
        esp_lcd_panel_del(_panelDrv);
        _panelDrv = nullptr;
    }
    if (_touchDrv) {
        delete _touchDrv;
        _touchDrv = nullptr;
    }
}

bool WavesharePanel::begin(WS_RGBPanel_Color_Order order) {
    if (_panelDrv) {
        return true;
    }

    _order = order;

    ledcSetup(WS_PWM_CHANNEL, WS_PWM_FREQ, WS_PWM_RESOLUTION);
    ledcAttachPin(WS_BOARD_TFT_BL, WS_PWM_CHANNEL);

    I2C_Init();
    delay(120);
    TCA9554PWR_Init(0x00);
    Set_EXIO(EXIO_PIN8, Low);

    if (!initTouch()) {
        Serial.println(F("Touch chip not found."));
        return false;
    }

    initBUS();
    getModel();
    return true;
}

bool WavesharePanel::installSD() {
    Mode_EXIO(EXIO_PIN4, TCA9554_OUTPUT_REG);
    Set_EXIO(EXIO_PIN4, High);

    SD_MMC.setPins(WS_BOARD_SDMMC_SCK, WS_BOARD_SDMMC_CMD, WS_BOARD_SDMMC_DAT);

    if (SD_MMC.begin("/sdcard", true, false)) {
        uint8_t cardType = SD_MMC.cardType();
        if (cardType != CARD_NONE) {
            Serial.print(F("SD Card Type: "));
            if (cardType == CARD_MMC)
                Serial.println(F("MMC"));
            else if (cardType == CARD_SD)
                Serial.println(F("SDSC"));
            else if (cardType == CARD_SDHC)
                Serial.println(F("SDHC"));
            else
                Serial.println(F("UNKNOWN"));
            uint64_t cardSize = SD_MMC.cardSize() / (1024 * 1024);
            Serial.printf("SD Card Size: %lluMB\n", cardSize);
        }
        return true;
    }
    return false;
}

void WavesharePanel::uninstallSD() {
    SD_MMC.end();
    Set_EXIO(EXIO_PIN4, Low);
    Mode_EXIO(EXIO_PIN4, TCA9554_INPUT_REG);
}

void WavesharePanel::setBrightness(uint8_t value) {
    value = constrain(value, 0, WS_BACKLIGHT_MAX);
    _brightness = value;
    ledcWrite(WS_PWM_CHANNEL, _brightness);
}

uint8_t WavesharePanel::getBrightness() const { return _brightness; }

WavesharePanelType WavesharePanel::getModel() {
    if (_touchDrv) {
        const char *model = _touchDrv->getModelName();
        if (model == NULL)
            return WS_UNKNOWN;
        if (strlen(model) == 0)
            return WS_UNKNOWN;
        if (strcmp(model, "CST820") == 0) {
            _touchType = WS_T_RGB_TOUCH_CST820;
            return WS_2_1_INCHES;
        } else if (strcmp(model, "GT911") == 0) {
            _touchType = WS_T_RGB_TOUCH_GT911;
            return WS_2_8_INCHES;
        }
    }
    return WS_UNKNOWN;
}

const char *WavesharePanel::getTouchModelName() const {
    if (_touchDrv) {
        return _touchDrv->getModelName();
    }
    return "UNKNOWN";
}

void WavesharePanel::enableTouchWakeup() { _wakeupMethod = WS_T_RGB_WAKEUP_FORM_TOUCH; }

void WavesharePanel::enableButtonWakeup() { _wakeupMethod = WS_T_RGB_WAKEUP_FORM_BUTTON; }

void WavesharePanel::enableTimerWakeup(uint64_t time_in_us) {
    _wakeupMethod = WS_T_RGB_WAKEUP_FORM_TIMER;
    _sleepTimeUs = time_in_us;
}

// The sleep method tested CST820 and GT911, and the FTxxxx series should also
// be usable.
void WavesharePanel::sleep() {
    // turn off blacklight
    for (int i = _brightness; i >= 0; --i) {
        setBrightness(i);
        delay(30);
    }

    if (WS_T_RGB_WAKEUP_FORM_TOUCH != _wakeupMethod) {
        if (_touchDrv) {
            if (getModel() == WS_2_8_INCHES) {
                pinMode(WS_BOARD_TOUCH_IRQ, OUTPUT);
                digitalWrite(WS_BOARD_TOUCH_IRQ,
                             LOW); // Before touch to set sleep, it is necessary
                                   // to set INT to LOW
            }
            _touchDrv->sleep();
        }
    }

    switch (_wakeupMethod) {
    case WS_T_RGB_WAKEUP_FORM_TOUCH: {
        int16_t x_array[1];
        int16_t y_array[1];
        uint8_t get_point = 1;
        pinMode(WS_BOARD_TOUCH_IRQ, INPUT);
        // Wait for your finger to be lifted from the screen
        while (!digitalRead(WS_BOARD_TOUCH_IRQ)) {
            delay(100);
            // Clear touch buffer
            getPoint(x_array, y_array, get_point);
        }
        // Wait for the interrupt level to stabilize
        delay(2000);
        // Set touch irq wakeup
        esp_sleep_enable_ext1_wakeup(_BV(WS_BOARD_TOUCH_IRQ), ESP_EXT1_WAKEUP_ANY_LOW);
    } break;
    case WS_T_RGB_WAKEUP_FORM_BUTTON:
        esp_sleep_enable_ext1_wakeup(_BV(0), ESP_EXT1_WAKEUP_ANY_LOW);
        break;
    case WS_T_RGB_WAKEUP_FORM_TIMER:
        esp_sleep_enable_timer_wakeup(_sleepTimeUs);
        break;
    default:
        // Default GPIO0 Wakeup
        esp_sleep_enable_ext1_wakeup(_BV(0), ESP_EXT1_WAKEUP_ANY_LOW);
        break;
    }

    if (_panelDrv) {
        esp_lcd_panel_disp_off(_panelDrv, true);
        esp_lcd_panel_del(_panelDrv);
    }

    Wire.end();

    pinMode(WS_BOARD_I2C_SDA, OPEN_DRAIN);
    pinMode(WS_BOARD_I2C_SCL, OPEN_DRAIN);

    Serial.end();

    // If the SD card is initialized, it needs to be unmounted.
    if (SD_MMC.cardSize()) {
        SD_MMC.end();
    }

    // Enter sleep
    esp_deep_sleep_start();
}

void WavesharePanel::wakeup() {}

uint16_t WavesharePanel::width() { return WS_BOARD_TFT_WIDTH; }

uint16_t WavesharePanel::height() { return WS_BOARD_TFT_HEIGHT; }

uint8_t WavesharePanel::getPoint(int16_t *x_array, int16_t *y_array, uint8_t get_point) {
    if (_touchDrv) {

        // The FT3267 type touch reading INT level is to read the coordinates
        // after pressing The CST820 interrupt level is not continuous, so the
        // register must be read all the time to obtain continuous coordinates.
        if (_touchType == WS_T_RGB_TOUCH_FT3267) {
            if (!_touchDrv->isPressed()) {
                return 0;
            }
        }
        uint8_t touched = _touchDrv->getPoint(x_array, y_array, get_point);
        return touched;
    }
    return 0;
}

bool WavesharePanel::isPressed() const {
    if (_touchDrv) {
        return _touchDrv->isPressed();
    }
    return 0;
}

uint16_t WavesharePanel::getBattVoltage() {
    esp_adc_cal_characteristics_t adc_chars;
    esp_adc_cal_characterize(ADC_UNIT_1, ADC_ATTEN_DB_12, ADC_WIDTH_BIT_12, 1100, &adc_chars);

    const int number_of_samples = 20;
    uint32_t sum = 0;
    uint16_t raw_buffer[number_of_samples] = {0};
    for (int i = 0; i < number_of_samples; i++) {
        raw_buffer[i] = analogRead(WS_BOARD_ADC_DET);
        delay(2);
    }
    for (int i = 0; i < number_of_samples; i++) {
        sum += raw_buffer[i];
    }
    sum = sum / number_of_samples;

    return esp_adc_cal_raw_to_voltage(sum, &adc_chars) * 2;
}

void WavesharePanel::initBUS() {
    if (_panelDrv) {
        return;
    }

    ST7701_Reset();

    spi_bus_config_t buscfg = {.mosi_io_num = WS_BOARD_TFT_MOSI,
                               .miso_io_num = -1,
                               .sclk_io_num = WS_BOARD_TFT_SCLK,
                               .quadwp_io_num = -1,
                               .quadhd_io_num = -1,
                               .max_transfer_sz = 64, // ESP32 S3 max size is 64Kbytes
                               .intr_flags = ESP_INTR_FLAG_SHARED};
    spi_bus_initialize(SPI2_HOST, &buscfg, SPI_DMA_CH_AUTO);
    spi_device_interface_config_t devcfg = {
        .command_bits = 1,
        .address_bits = 8,
        .mode = SPI_MODE0,
        .clock_speed_hz = 40000000,
        .spics_io_num = -1,
        .queue_size = 1, // Not using queues
    };
    spi_bus_add_device(SPI2_HOST, &devcfg, &SPI_handle);

    ST7701_CS_EN();

    if (getModel() == WS_2_1_INCHES) {
        // 2.1inch

        writeCommand(0xFF);
        writeData(0x77);
        writeData(0x01);
        writeData(0x00);
        writeData(0x00);
        writeData(0x10);

        writeCommand(0xC0);
        writeData(0x3B); // Scan line
        writeData(0x00);

        writeCommand(0xC1);
        writeData(0x0B); // VBP
        writeData(0x02);

        writeCommand(0xC2);
        writeData(0x07);
        writeData(0x02);

        writeCommand(0xCC);
        writeData(0x10);

        writeCommand(0xCD); // RGB format
        writeData(0x08);

        writeCommand(0xB0); // IPS
        writeData(0x00);    // 255
        writeData(0x11);    // 251
        writeData(0x16);    // 247  down
        writeData(0x0e);    // 239
        writeData(0x11);    // 231
        writeData(0x06);    // 203
        writeData(0x05);    // 175
        writeData(0x09);    // 147
        writeData(0x08);    // 108
        writeData(0x21);    // 80
        writeData(0x06);    // 52
        writeData(0x13);    // 24
        writeData(0x10);    // 16
        writeData(0x29);    // 8    down
        writeData(0x31);    // 4
        writeData(0x18);    // 0

        writeCommand(0xB1); //  IPS
        writeData(0x00);    //  255
        writeData(0x11);    //  251
        writeData(0x16);    //  247   down
        writeData(0x0e);    //  239
        writeData(0x11);    //  231
        writeData(0x07);    //  203
        writeData(0x05);    //  175
        writeData(0x09);    //  147
        writeData(0x09);    //  108
        writeData(0x21);    //  80
        writeData(0x05);    //  52
        writeData(0x13);    //  24
        writeData(0x11);    //  16
        writeData(0x2a);    //  8  down
        writeData(0x31);    //  4
        writeData(0x18);    //  0

        writeCommand(0xFF);
        writeData(0x77);
        writeData(0x01);
        writeData(0x00);
        writeData(0x00);
        writeData(0x11);

        writeCommand(0xB0); // VOP  3.5375+ *x 0.0125
        writeData(0x6d);    // 5D

        writeCommand(0xB1); // VCOM amplitude setting
        writeData(0x37);    //

        writeCommand(0xB2); // VGH Voltage setting
        writeData(0x81);    // 12V

        writeCommand(0xB3);
        writeData(0x80);

        writeCommand(0xB5); // VGL Voltage setting
        writeData(0x43);    //-8.3V

        writeCommand(0xB7);
        writeData(0x85);

        writeCommand(0xB8);
        writeData(0x20);

        writeCommand(0xC1);
        writeData(0x78);

        writeCommand(0xC2);
        writeData(0x78);

        writeCommand(0xD0);
        writeData(0x88);

        writeCommand(0xE0);
        writeData(0x00);
        writeData(0x00);
        writeData(0x02);

        writeCommand(0xE1);
        writeData(0x03);
        writeData(0xA0);
        writeData(0x00);
        writeData(0x00);
        writeData(0x04);
        writeData(0xA0);
        writeData(0x00);
        writeData(0x00);
        writeData(0x00);
        writeData(0x20);
        writeData(0x20);

        writeCommand(0xE2);
        writeData(0x00);
        writeData(0x00);
        writeData(0x00);
        writeData(0x00);
        writeData(0x00);
        writeData(0x00);
        writeData(0x00);
        writeData(0x00);
        writeData(0x00);
        writeData(0x00);
        writeData(0x00);
        writeData(0x00);
        writeData(0x00);

        writeCommand(0xE3);
        writeData(0x00);
        writeData(0x00);
        writeData(0x11);
        writeData(0x00);

        writeCommand(0xE4);
        writeData(0x22);
        writeData(0x00);

        writeCommand(0xE5);
        writeData(0x05);
        writeData(0xEC);
        writeData(0xA0);
        writeData(0xA0);
        writeData(0x07);
        writeData(0xEE);
        writeData(0xA0);
        writeData(0xA0);
        writeData(0x00);
        writeData(0x00);
        writeData(0x00);
        writeData(0x00);
        writeData(0x00);
        writeData(0x00);
        writeData(0x00);
        writeData(0x00);

        writeCommand(0xE6);
        writeData(0x00);
        writeData(0x00);
        writeData(0x11);
        writeData(0x00);

        writeCommand(0xE7);
        writeData(0x22);
        writeData(0x00);

        writeCommand(0xE8);
        writeData(0x06);
        writeData(0xED);
        writeData(0xA0);
        writeData(0xA0);
        writeData(0x08);
        writeData(0xEF);
        writeData(0xA0);
        writeData(0xA0);
        writeData(0x00);
        writeData(0x00);
        writeData(0x00);
        writeData(0x00);
        writeData(0x00);
        writeData(0x00);
        writeData(0x00);
        writeData(0x00);

        writeCommand(0xEB);
        writeData(0x00);
        writeData(0x00);
        writeData(0x40);
        writeData(0x40);
        writeData(0x00);
        writeData(0x00);
        writeData(0x00);

        writeCommand(0xED);
        writeData(0xFF);
        writeData(0xFF);
        writeData(0xFF);
        writeData(0xBA);
        writeData(0x0A);
        writeData(0xBF);
        writeData(0x45);
        writeData(0xFF);
        writeData(0xFF);
        writeData(0x54);
        writeData(0xFB);
        writeData(0xA0);
        writeData(0xAB);
        writeData(0xFF);
        writeData(0xFF);
        writeData(0xFF);

        writeCommand(0xEF);
        writeData(0x10);
        writeData(0x0D);
        writeData(0x04);
        writeData(0x08);
        writeData(0x3F);
        writeData(0x1F);

        writeCommand(0xFF);
        writeData(0x77);
        writeData(0x01);
        writeData(0x00);
        writeData(0x00);
        writeData(0x13);

        writeCommand(0xEF);
        writeData(0x08);

        writeCommand(0xFF);
        writeData(0x77);
        writeData(0x01);
        writeData(0x00);
        writeData(0x00);
        writeData(0x00);

        writeCommand(0x36);
        writeData(0x00);

        writeCommand(0x3A);
        writeData(0x66);

        writeCommand(0x11);

        delay(480);
        vTaskDelay(pdMS_TO_TICKS(480));

        writeCommand(0x20); //
        delay(120);
        vTaskDelay(pdMS_TO_TICKS(120));
        writeCommand(0x29);
    } else {

        // 2.8inch
        writeCommand(0xFF);
        writeData(0x77);
        writeData(0x01);
        writeData(0x00);
        writeData(0x00);
        writeData(0x13);

        writeCommand(0xEF);
        writeData(0x08);

        writeCommand(0xFF);
        writeData(0x77);
        writeData(0x01);
        writeData(0x00);
        writeData(0x00);
        writeData(0x10);

        writeCommand(0xC0);
        writeData(0x3B);
        writeData(0x00);

        writeCommand(0xC1);
        writeData(0x10);
        writeData(0x0C);

        writeCommand(0xC2);
        writeData(0x07);
        writeData(0x0A);

        writeCommand(0xC7);
        writeData(0x00);

        writeCommand(0xCC);
        writeData(0x10);

        writeCommand(0xCD);
        writeData(0x08);

        writeCommand(0xB0);
        writeData(0x05);
        writeData(0x12);
        writeData(0x98);
        writeData(0x0E);
        writeData(0x0F);
        writeData(0x07);
        writeData(0x07);
        writeData(0x09);
        writeData(0x09);
        writeData(0x23);
        writeData(0x05);
        writeData(0x52);
        writeData(0x0F);
        writeData(0x67);
        writeData(0x2C);
        writeData(0x11);

        writeCommand(0xB1);
        writeData(0x0B);
        writeData(0x11);
        writeData(0x97);
        writeData(0x0C);
        writeData(0x12);
        writeData(0x06);
        writeData(0x06);
        writeData(0x08);
        writeData(0x08);
        writeData(0x22);
        writeData(0x03);
        writeData(0x51);
        writeData(0x11);
        writeData(0x66);
        writeData(0x2B);
        writeData(0x0F);

        writeCommand(0xFF);
        writeData(0x77);
        writeData(0x01);
        writeData(0x00);
        writeData(0x00);
        writeData(0x11);

        writeCommand(0xB0);
        writeData(0x5D);

        writeCommand(0xB1);
        writeData(0x3E);

        writeCommand(0xB2);
        writeData(0x81);

        writeCommand(0xB3);
        writeData(0x80);

        writeCommand(0xB5);
        writeData(0x4E);

        writeCommand(0xB7);
        writeData(0x85);

        writeCommand(0xB8);
        writeData(0x20);

        writeCommand(0xC1);
        writeData(0x78);

        writeCommand(0xC2);
        writeData(0x78);

        writeCommand(0xD0);
        writeData(0x88);

        writeCommand(0xE0);
        writeData(0x00);
        writeData(0x00);
        writeData(0x02);

        writeCommand(0xE1);
        writeData(0x06);
        writeData(0x30);
        writeData(0x08);
        writeData(0x30);
        writeData(0x05);
        writeData(0x30);
        writeData(0x07);
        writeData(0x30);
        writeData(0x00);
        writeData(0x33);
        writeData(0x33);

        writeCommand(0xE2);
        writeData(0x11);
        writeData(0x11);
        writeData(0x33);
        writeData(0x33);
        writeData(0xF4);
        writeData(0x00);
        writeData(0x00);
        writeData(0x00);
        writeData(0xF4);
        writeData(0x00);
        writeData(0x00);
        writeData(0x00);

        writeCommand(0xE3);
        writeData(0x00);
        writeData(0x00);
        writeData(0x11);
        writeData(0x11);

        writeCommand(0xE4);
        writeData(0x44);
        writeData(0x44);

        writeCommand(0xE5);
        writeData(0x0D);
        writeData(0xF5);
        writeData(0x30);
        writeData(0xF0);
        writeData(0x0F);
        writeData(0xF7);
        writeData(0x30);
        writeData(0xF0);
        writeData(0x09);
        writeData(0xF1);
        writeData(0x30);
        writeData(0xF0);
        writeData(0x0B);
        writeData(0xF3);
        writeData(0x30);
        writeData(0xF0);

        writeCommand(0xE6);
        writeData(0x00);
        writeData(0x00);
        writeData(0x11);
        writeData(0x11);

        writeCommand(0xE7);
        writeData(0x44);
        writeData(0x44);

        writeCommand(0xE8);
        writeData(0x0C);
        writeData(0xF4);
        writeData(0x30);
        writeData(0xF0);
        writeData(0x0E);
        writeData(0xF6);
        writeData(0x30);
        writeData(0xF0);
        writeData(0x08);
        writeData(0xF0);
        writeData(0x30);
        writeData(0xF0);
        writeData(0x0A);
        writeData(0xF2);
        writeData(0x30);
        writeData(0xF0);

        writeCommand(0xE9);
        writeData(0x36);
        writeData(0x01);

        writeCommand(0xEB);
        writeData(0x00);
        writeData(0x01);
        writeData(0xE4);
        writeData(0xE4);
        writeData(0x44);
        writeData(0x88);
        writeData(0x40);

        writeCommand(0xED);
        writeData(0xFF);
        writeData(0x10);
        writeData(0xAF);
        writeData(0x76);
        writeData(0x54);
        writeData(0x2B);
        writeData(0xCF);
        writeData(0xFF);
        writeData(0xFF);
        writeData(0xFC);
        writeData(0xB2);
        writeData(0x45);
        writeData(0x67);
        writeData(0xFA);
        writeData(0x01);
        writeData(0xFF);

        writeCommand(0xEF);
        writeData(0x08);
        writeData(0x08);
        writeData(0x08);
        writeData(0x45);
        writeData(0x3F);
        writeData(0x54);

        writeCommand(0xFF);
        writeData(0x77);
        writeData(0x01);
        writeData(0x00);
        writeData(0x00);
        writeData(0x00);

        writeCommand(0x11);
        delay(120); // ms

        writeCommand(0x3A);
        writeData(0x66); // 0x66  /  0x77

        writeCommand(0x36);
        writeData(0x00);

        writeCommand(0x35);
        writeData(0x00);

        writeCommand(0x29);
    }

    ST7701_CS_Dis();

    esp_lcd_rgb_panel_config_t panel_config = {
        .clk_src = LCD_CLK_SRC_PLL160M,
        .timings =
            {
                .pclk_hz = ESP_PANEL_LCD_RGB_TIMING_FREQ_HZ,
                .h_res = WS_BOARD_TFT_WIDTH,
                .v_res = WS_BOARD_TFT_HEIGHT,
                // The following parameters should refer to LCD spec
                .hsync_pulse_width = 8,
                .hsync_back_porch = 10,
                .hsync_front_porch = 50,
                .vsync_pulse_width = 2,
                .vsync_back_porch = 18,
                .vsync_front_porch = 8,
                .flags =
                    {
                        .pclk_active_neg = 0,
                    },
            },
        .data_width = 16, // RGB565 in parallel mode, thus 16bit in width
        .psram_trans_align = 64,
        .hsync_gpio_num = WS_BOARD_TFT_HSYNC,
        .vsync_gpio_num = WS_BOARD_TFT_VSYNC,
        .de_gpio_num = WS_BOARD_TFT_DE,
        .pclk_gpio_num = WS_BOARD_TFT_PCLK,
        .data_gpio_nums =
            {
                ESP_PANEL_LCD_PIN_NUM_RGB_DATA0,
                ESP_PANEL_LCD_PIN_NUM_RGB_DATA1,
                ESP_PANEL_LCD_PIN_NUM_RGB_DATA2,
                ESP_PANEL_LCD_PIN_NUM_RGB_DATA3,
                ESP_PANEL_LCD_PIN_NUM_RGB_DATA4,
                ESP_PANEL_LCD_PIN_NUM_RGB_DATA5,
                ESP_PANEL_LCD_PIN_NUM_RGB_DATA6,
                ESP_PANEL_LCD_PIN_NUM_RGB_DATA7,
                ESP_PANEL_LCD_PIN_NUM_RGB_DATA8,
                ESP_PANEL_LCD_PIN_NUM_RGB_DATA9,
                ESP_PANEL_LCD_PIN_NUM_RGB_DATA10,
                ESP_PANEL_LCD_PIN_NUM_RGB_DATA11,
                ESP_PANEL_LCD_PIN_NUM_RGB_DATA12,
                ESP_PANEL_LCD_PIN_NUM_RGB_DATA13,
                ESP_PANEL_LCD_PIN_NUM_RGB_DATA14,
                ESP_PANEL_LCD_PIN_NUM_RGB_DATA15,
            },
        .disp_gpio_num = GPIO_NUM_NC,
        .on_frame_trans_done = NULL,
        .user_ctx = NULL,
        .flags =
            {
                .fb_in_psram = 1, // allocate frame buffer in PSRAM
            },
    };

    ESP_ERROR_CHECK(esp_lcd_new_rgb_panel(&panel_config, &_panelDrv));
    ESP_ERROR_CHECK(esp_lcd_panel_reset(_panelDrv));
    ESP_ERROR_CHECK(esp_lcd_panel_init(_panelDrv));
}

bool WavesharePanel::initTouch() {
    const uint8_t touch_irq_pin = WS_BOARD_TOUCH_IRQ;
    bool result = false;

    TouchDrvDigitalWrite(0, Low);
    delay(100);
    TouchDrvDigitalWrite(0, High);

    log_i("=================initTouch====================");
    _touchDrv = new TouchDrvCSTXXX();
    _touchDrv->setGpioCallback(TouchDrvPinMode, TouchDrvDigitalWrite, TouchDrvDigitalRead);
    _touchDrv->setPins(0x00, touch_irq_pin);
    result = _touchDrv->begin(Wire, CST816_SLAVE_ADDRESS, WS_BOARD_I2C_SDA, WS_BOARD_I2C_SCL);
    if (result) {
        const char *model = _touchDrv->getModelName();
        log_i("Successfully initialized %s, using %s Driver!\n", model, model);
        return true;
    }
    delete _touchDrv;

    _touchDrv = new TouchDrvGT911();
    _touchDrv->setGpioCallback(TouchDrvPinMode, TouchDrvDigitalWrite, TouchDrvDigitalRead);
    _touchDrv->setPins(0x00, touch_irq_pin);
    result = _touchDrv->begin(Wire, GT911_SLAVE_ADDRESS_L, WS_BOARD_I2C_SDA, WS_BOARD_I2C_SCL);
    if (result) {
        TouchDrvGT911 *tmp = static_cast<TouchDrvGT911 *>(_touchDrv);
        tmp->setInterruptMode(FALLING);

        log_i("Successfully initialized GT911, using GT911 Driver!");
        return true;
    }
    delete _touchDrv;

    log_e("Unable to find touch device.");

    _touchDrv = nullptr;

    return false;
}

void WavesharePanel::writeCommand(const uint8_t cmd) {
    spi_transaction_t spi_tran = {
        .cmd = 0,
        .addr = cmd,
        .length = 0,
        .rxlength = 0,
    };
    spi_device_transmit(SPI_handle, &spi_tran);
}

void WavesharePanel::writeData(uint8_t data) {
    spi_transaction_t spi_tran = {
        .cmd = 1,
        .addr = data,
        .length = 0,
        .rxlength = 0,
    };
    spi_device_transmit(SPI_handle, &spi_tran);
}

void WavesharePanel::pushColors(uint16_t x, uint16_t y, uint16_t width, uint16_t hight, uint16_t *data) {
    assert(_panelDrv);
    esp_lcd_panel_draw_bitmap(_panelDrv, x, y, width, hight, data);
}

static void TouchDrvDigitalWrite(uint32_t gpio, uint8_t level) {
    if (gpio == 0) {
        Set_EXIO(EXIO_PIN2, level);
    } else {
        digitalWrite(gpio, level);
    }
}

static int TouchDrvDigitalRead(uint32_t gpio) {
    if (gpio == 0) {
        return Read_EXIO(EXIO_PIN2);
    } else {
        return digitalRead(gpio);
    }
}

static void TouchDrvPinMode(uint32_t gpio, uint8_t mode) {
    if (gpio == 0) {
        Mode_EXIO(EXIO_PIN2, mode);
    } else {
        pinMode(gpio, mode);
    }
}
