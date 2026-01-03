#include "MaTouch21Panel.h"
#include "MaTouch21Utilities.h"
#include "driver/spi_master.h"
#include "esp_lcd_st7701/esp_lcd_panel_io_additions.h"
#include "esp_lcd_st7701/esp_lcd_st7701.h"
#include <Wire.h>
#include <display/drivers/common/RGBPanelInit.h>
#include <esp_adc_cal.h>

MaTouch21Panel::MaTouch21Panel(/* args */) : _panelDrv(nullptr) {}

MaTouch21Panel::~MaTouch21Panel() {
    if (_panelDrv) {
        esp_lcd_panel_del(_panelDrv);
        _panelDrv = nullptr;
    }
}

bool MaTouch21Panel::isCompatible(void) {
    if (!Wire.begin(BOARD_I2C_SDA, BOARD_I2C_SCL)) {
        return false;
    }

    Wire.beginTransmission(I2C_TOUCH_ADDR);
    if (Wire.endTransmission() != 0) {
        log_e("Unable to find touch device at %x.", I2C_TOUCH_ADDR);
        return false;
    }
    log_i("MaTouch 2.1 panel found");
    return true;
}

bool MaTouch21Panel::begin(void) {
    if (_panelDrv) {
        return true;
    }

    ledcSetup(0, 20000, 4);
    ledcAttachPin(BOARD_TFT_BL, 0);

    // pinMode(BOARD_TFT_BL, OUTPUT);
    //  Reset seq
    // digitalWrite(BOARD_TFT_BL, LOW);
    // delay(20);
    // digitalWrite(BOARD_TFT_BL, HIGH);
    // delay(20);

    if (!initTouch()) {
        log_w("Touch chip not found.");
    }

    initBUS();

    return true;
}

void MaTouch21Panel::setBrightness(uint8_t value) {
    value = constrain(value, 0, 16);
    _brightness = value;
    ledcWrite(0, _brightness);
}

uint16_t MaTouch21Panel::width() { return BOARD_TFT_WIDTH; }

uint16_t MaTouch21Panel::height() { return BOARD_TFT_HEIGHT; }

uint8_t MaTouch21Panel::getPoint(int16_t *x_array, int16_t *y_array, uint8_t get_point) {
    int touchX = 0, touchY = 0;
    get_point = readTouch(&touchX, &touchY);
    if (get_point > 0) {
        touchX = constrain(touchX, 0, BOARD_TFT_WIDTH);
        touchY = constrain(touchY, 0, BOARD_TFT_HEIGHT);
        x_array[0] = (uint16_t)touchX;
        y_array[0] = (uint16_t)touchY;
        return get_point;
    }
    return 0;
}

void MaTouch21Panel::initBUS() {
    if (_panelDrv) {
        return;
    }

    spi_line_config_t line_config = {
        .cs_io_type = IO_TYPE_GPIO, // Set to `IO_TYPE_GPIO` if using GPIO, same to below
        .cs_gpio_num = BOARD_TFT_CS,
        .scl_io_type = IO_TYPE_GPIO,
        .scl_gpio_num = BOARD_TFT_SCLK,
        .sda_io_type = IO_TYPE_GPIO,
        .sda_gpio_num = BOARD_TFT_MOSI,
        .io_expander = NULL, // Set to NULL if not using IO expander
    };
    esp_lcd_panel_io_3wire_spi_config_t io_config = ST7701_PANEL_IO_3WIRE_SPI_CONFIG(line_config, 0);
    esp_lcd_panel_io_handle_t io_handle = NULL;
    ESP_ERROR_CHECK(esp_lcd_new_panel_io_3wire_spi(&io_config, &io_handle));

    esp_lcd_rgb_panel_config_t rgb_config = {
        .clk_src = LCD_CLK_SRC_PLL160M,
        //.timings = ST7701_480_480_PANEL_60HZ_RGB_TIMING(),
        .timings =
            {
                .pclk_hz = 12 * 1000 * 1000L,
                .h_res = BOARD_TFT_HEIGHT,
                .v_res = BOARD_TFT_WIDTH,
                .hsync_pulse_width = 8,
                .hsync_back_porch = 50,
                .hsync_front_porch = 10,
                .vsync_pulse_width = 8,
                .vsync_back_porch = 20,
                .vsync_front_porch = 10,
                .flags =
                    {
                        .pclk_active_neg = false,
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
                BOARD_TFT_DATA1,
                BOARD_TFT_DATA2,
                BOARD_TFT_DATA3,
                BOARD_TFT_DATA4,
                BOARD_TFT_DATA5,

                BOARD_TFT_DATA6,
                BOARD_TFT_DATA7,
                BOARD_TFT_DATA8,
                BOARD_TFT_DATA9,
                BOARD_TFT_DATA10,
                BOARD_TFT_DATA11,

                // BOARD_TFT_DATA12,
                BOARD_TFT_DATA13,
                BOARD_TFT_DATA14,
                BOARD_TFT_DATA15,
                BOARD_TFT_DATA16,
                BOARD_TFT_DATA17,
            },
        .disp_gpio_num = GPIO_NUM_NC,
        .on_frame_trans_done = NULL,
        .user_ctx = NULL,
        .flags =
            {
                .fb_in_psram = 1, // allocate frame buffer in PSRAM
            },
    };

    st7701_vendor_config_t vendor_config = {
        .init_cmds = st7701_type5_init_operations,
        .init_cmds_size = sizeof(st7701_type5_init_operations) / sizeof(st7701_type5_init_operations[0]),
        .rgb_config = &rgb_config,
    };

    const esp_lcd_panel_dev_config_t panel_config = {
        .reset_gpio_num = BOARD_TFT_RST,
        //.rgb_ele_order = LCD_RGB_ELEMENT_ORDER_RGB,
        .bits_per_pixel = 16,
        .vendor_config = &vendor_config,
    };

    ESP_ERROR_CHECK(esp_lcd_new_panel_st7701(io_handle, &panel_config, &_panelDrv));
    ESP_ERROR_CHECK(esp_lcd_panel_reset(_panelDrv));
    ESP_ERROR_CHECK(esp_lcd_panel_init(_panelDrv));

    log_i("panel OK");
}

bool MaTouch21Panel::initTouch() {
    log_i("=================initTouch====================");
    return true;
}

int MaTouch21Panel::readTouch(int *x, int *y) {
    byte data_raw[7];
    int res = MaTouch21Panel::i2c_read(I2C_TOUCH_ADDR, 0x02, data_raw, 7);

    int event = data_raw[1] >> 6;

    if (event == 2) {
        *x = (int)data_raw[2] + (int)(data_raw[1] & 0x0f) * 256;
        *y = (int)data_raw[4] + (int)(data_raw[3] & 0x0f) * 256;

        return 1;
    } else {
        return 0;
    }
}

int MaTouch21Panel::i2c_read(uint16_t addr, uint8_t reg_addr, uint8_t *reg_data, uint32_t length) {
    Wire.beginTransmission(addr);
    Wire.write(reg_addr);
    if (Wire.endTransmission(true))
        return -1;
    Wire.requestFrom(addr, length, true);
    for (int i = 0; i < length; i++) {
        *reg_data++ = Wire.read();
    }
    return 0;
}

void MaTouch21Panel::pushColors(uint16_t x, uint16_t y, uint16_t width, uint16_t hight, uint16_t *data) {
    assert(_panelDrv);
    esp_lcd_panel_draw_bitmap(_panelDrv, x, y, width, hight, data);
}
