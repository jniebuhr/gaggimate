#ifndef WS_ST77916_H
#define WS_ST77916_H

#include "Arduino_GFX_Library.h"

// Waveshare-specific initialization sequence for 1.85" LCD
static const uint8_t ws_st77916_init_operations[] = {
    BEGIN_WRITE,
    WRITE_C8_D8, 0xF0, 0x28,
    WRITE_C8_D8, 0xF2, 0x28,
    WRITE_C8_D8, 0x73, 0xF0,
    WRITE_C8_D8, 0x7C, 0xD1,
    WRITE_C8_D8, 0x83, 0xE0,
    WRITE_C8_D8, 0x84, 0x61,
    WRITE_C8_D8, 0xF2, 0x82,
    WRITE_C8_D8, 0xF0, 0x00,
    WRITE_C8_D8, 0xF0, 0x01,
    WRITE_C8_D8, 0xF1, 0x01,
    WRITE_C8_D8, 0xB0, 0x56,
    WRITE_C8_D8, 0xB1, 0x4D,
    WRITE_C8_D8, 0xB2, 0x24,
    WRITE_C8_D8, 0xB4, 0x87,
    WRITE_C8_D8, 0xB5, 0x44,
    WRITE_C8_D8, 0xB6, 0x8B,
    WRITE_C8_D8, 0xB7, 0x40,
    WRITE_C8_D8, 0xB8, 0x86,
    WRITE_C8_D8, 0xBA, 0x00,
    WRITE_C8_D8, 0xBB, 0x08,
    WRITE_C8_D8, 0xBC, 0x08,
    WRITE_C8_D8, 0xBD, 0x00,
    WRITE_C8_D8, 0xC0, 0x80,
    WRITE_C8_D8, 0xC1, 0x10,
    WRITE_C8_D8, 0xC2, 0x37,
    WRITE_C8_D8, 0xC3, 0x80,
    WRITE_C8_D8, 0xC4, 0x10,
    WRITE_C8_D8, 0xC5, 0x37,
    WRITE_C8_D8, 0xC6, 0xA9,
    WRITE_C8_D8, 0xC7, 0x41,
    WRITE_C8_D8, 0xC8, 0x01,
    WRITE_C8_D8, 0xC9, 0xA9,
    WRITE_C8_D8, 0xCA, 0x41,
    WRITE_C8_D8, 0xCB, 0x01,
    WRITE_C8_D8, 0xD0, 0x91,
    WRITE_C8_D8, 0xD1, 0x68,
    WRITE_C8_D8, 0xD2, 0x68,
    WRITE_C8_D16, 0xF5, 0x00, 0xA5,
    WRITE_C8_D8, 0xDD, 0x4F,
    WRITE_C8_D8, 0xDE, 0x4F,
    WRITE_C8_D8, 0xF1, 0x10,
    WRITE_C8_D8, 0xF0, 0x00,
    WRITE_C8_D8, 0xF0, 0x02,
    WRITE_COMMAND_8, 0xE0,
    WRITE_BYTES, 14,
    0xF0, 0x0A, 0x10, 0x09,
    0x09, 0x36, 0x35, 0x33,
    0x4A, 0x29, 0x15, 0x15,
    0x2E, 0x34,
    WRITE_COMMAND_8, 0xE1,
    WRITE_BYTES, 14,
    0xF0, 0x0A, 0x0F, 0x08,
    0x08, 0x05, 0x34, 0x33,
    0x4A, 0x39, 0x15, 0x15,
    0x2D, 0x33,
    WRITE_C8_D8, 0xF0, 0x10,
    WRITE_C8_D8, 0xF3, 0x10,
    WRITE_C8_D8, 0xE0, 0x07,
    WRITE_C8_D8, 0xE1, 0x00,
    WRITE_C8_D8, 0xE2, 0x00,
    WRITE_C8_D8, 0xE3, 0x00,
    WRITE_C8_D8, 0xE4, 0xE0,
    WRITE_C8_D8, 0xE5, 0x06,
    WRITE_C8_D8, 0xE6, 0x21,
    WRITE_C8_D8, 0xE7, 0x01,
    WRITE_C8_D8, 0xE8, 0x05,
    WRITE_C8_D8, 0xE9, 0x02,
    WRITE_C8_D8, 0xEA, 0xDA,
    WRITE_C8_D8, 0xEB, 0x00,
    WRITE_C8_D8, 0xEC, 0x00,
    WRITE_C8_D8, 0xED, 0x0F,
    WRITE_C8_D8, 0xEE, 0x00,
    WRITE_C8_D8, 0xEF, 0x00,
    WRITE_C8_D8, 0xF8, 0x00,
    WRITE_C8_D8, 0xF9, 0x00,
    WRITE_C8_D8, 0xFA, 0x00,
    WRITE_C8_D8, 0xFB, 0x00,
    WRITE_C8_D8, 0xFC, 0x00,
    WRITE_C8_D8, 0xFD, 0x00,
    WRITE_C8_D8, 0xFE, 0x00,
    WRITE_C8_D8, 0xFF, 0x00,
    WRITE_C8_D8, 0x60, 0x40,
    WRITE_C8_D8, 0x61, 0x04,
    WRITE_C8_D8, 0x62, 0x00,
    WRITE_C8_D8, 0x63, 0x42,
    WRITE_C8_D8, 0x64, 0xD9,
    WRITE_C8_D8, 0x65, 0x00,
    WRITE_C8_D8, 0x66, 0x00,
    WRITE_C8_D8, 0x67, 0x00,
    WRITE_C8_D8, 0x68, 0x00,
    WRITE_C8_D8, 0x69, 0x00,
    WRITE_C8_D8, 0x6A, 0x00,
    WRITE_C8_D8, 0x6B, 0x00,
    WRITE_C8_D8, 0x70, 0x40,
    WRITE_C8_D8, 0x71, 0x03,
    WRITE_C8_D8, 0x72, 0x00,
    WRITE_C8_D8, 0x73, 0x42,
    WRITE_C8_D8, 0x74, 0xD8,
    WRITE_C8_D8, 0x75, 0x00,
    WRITE_C8_D8, 0x76, 0x00,
    WRITE_C8_D8, 0x77, 0x00,
    WRITE_C8_D8, 0x78, 0x00,
    WRITE_C8_D8, 0x79, 0x00,
    WRITE_C8_D8, 0x7A, 0x00,
    WRITE_C8_D8, 0x7B, 0x00,
    WRITE_C8_D8, 0x80, 0x48,
    WRITE_C8_D8, 0x81, 0x00,
    WRITE_C8_D8, 0x82, 0x06,
    WRITE_C8_D8, 0x83, 0x02,
    WRITE_C8_D8, 0x84, 0xD6,
    WRITE_C8_D8, 0x85, 0x04,
    WRITE_C8_D8, 0x86, 0x00,
    WRITE_C8_D8, 0x87, 0x00,
    WRITE_C8_D8, 0x88, 0x48,
    WRITE_C8_D8, 0x89, 0x00,
    WRITE_C8_D8, 0x8A, 0x08,
    WRITE_C8_D8, 0x8B, 0x02,
    WRITE_C8_D8, 0x8C, 0xD8,
    WRITE_C8_D8, 0x8D, 0x04,
    WRITE_C8_D8, 0x8E, 0x00,
    WRITE_C8_D8, 0x8F, 0x00,
    WRITE_C8_D8, 0x90, 0x48,
    WRITE_C8_D8, 0x91, 0x00,
    WRITE_C8_D8, 0x92, 0x0A,
    WRITE_C8_D8, 0x93, 0x02,
    WRITE_C8_D8, 0x94, 0xDA,
    WRITE_C8_D8, 0x95, 0x04,
    WRITE_C8_D8, 0x96, 0x00,
    WRITE_C8_D8, 0x97, 0x00,
    WRITE_C8_D8, 0x98, 0x48,
    WRITE_C8_D8, 0x99, 0x00,
    WRITE_C8_D8, 0x9A, 0x0C,
    WRITE_C8_D8, 0x9B, 0x02,
    WRITE_C8_D8, 0x9C, 0xDC,
    WRITE_C8_D8, 0x9D, 0x04,
    WRITE_C8_D8, 0x9E, 0x00,
    WRITE_C8_D8, 0x9F, 0x00,
    WRITE_C8_D8, 0xA0, 0x48,
    WRITE_C8_D8, 0xA1, 0x00,
    WRITE_C8_D8, 0xA2, 0x05,
    WRITE_C8_D8, 0xA3, 0x02,
    WRITE_C8_D8, 0xA4, 0xD5,
    WRITE_C8_D8, 0xA5, 0x04,
    WRITE_C8_D8, 0xA6, 0x00,
    WRITE_C8_D8, 0xA7, 0x00,
    WRITE_C8_D8, 0xA8, 0x48,
    WRITE_C8_D8, 0xA9, 0x00,
    WRITE_C8_D8, 0xAA, 0x07,
    WRITE_C8_D8, 0xAB, 0x02,
    WRITE_C8_D8, 0xAC, 0xD7,
    WRITE_C8_D8, 0xAD, 0x04,
    WRITE_C8_D8, 0xAE, 0x00,
    WRITE_C8_D8, 0xAF, 0x00,
    WRITE_C8_D8, 0xB0, 0x48,
    WRITE_C8_D8, 0xB1, 0x00,
    WRITE_C8_D8, 0xB2, 0x09,
    WRITE_C8_D8, 0xB3, 0x02,
    WRITE_C8_D8, 0xB4, 0xD9,
    WRITE_C8_D8, 0xB5, 0x04,
    WRITE_C8_D8, 0xB6, 0x00,
    WRITE_C8_D8, 0xB7, 0x00,
    WRITE_C8_D8, 0xB8, 0x48,
    WRITE_C8_D8, 0xB9, 0x00,
    WRITE_C8_D8, 0xBA, 0x0B,
    WRITE_C8_D8, 0xBB, 0x02,
    WRITE_C8_D8, 0xBC, 0xDB,
    WRITE_C8_D8, 0xBD, 0x04,
    WRITE_C8_D8, 0xBE, 0x00,
    WRITE_C8_D8, 0xBF, 0x00,
    WRITE_C8_D8, 0xC0, 0x10,
    WRITE_C8_D8, 0xC1, 0x47,
    WRITE_C8_D8, 0xC2, 0x56,
    WRITE_C8_D8, 0xC3, 0x65,
    WRITE_C8_D8, 0xC4, 0x74,
    WRITE_C8_D8, 0xC5, 0x88,
    WRITE_C8_D8, 0xC6, 0x99,
    WRITE_C8_D8, 0xC7, 0x01,
    WRITE_C8_D8, 0xC8, 0xBB,
    WRITE_C8_D8, 0xC9, 0xAA,
    WRITE_C8_D8, 0xD0, 0x10,
    WRITE_C8_D8, 0xD1, 0x47,
    WRITE_C8_D8, 0xD2, 0x56,
    WRITE_C8_D8, 0xD3, 0x65,
    WRITE_C8_D8, 0xD4, 0x74,
    WRITE_C8_D8, 0xD5, 0x88,
    WRITE_C8_D8, 0xD6, 0x99,
    WRITE_C8_D8, 0xD7, 0x01,
    WRITE_C8_D8, 0xD8, 0xBB,
    WRITE_C8_D8, 0xD9, 0xAA,
    WRITE_C8_D8, 0xF3, 0x01,
    WRITE_C8_D8, 0xF0, 0x00,
    // Set color mode to 16-bit (RGB565)
    WRITE_C8_D8, 0x3A, 0x55,
    // Display inversion on
    WRITE_C8_D8, 0x21, 0x00,
    // Sleep out
    WRITE_C8_D8, 0x11, 0x00,
    END_WRITE,
    DELAY, 120,
    BEGIN_WRITE,
    // Display on
    WRITE_C8_D8, 0x29, 0x00,
    END_WRITE
};

class WS_ST77916 : public Arduino_TFT
{
public:
    WS_ST77916(
        Arduino_DataBus *bus, int8_t rst = GFX_NOT_DEFINED, uint8_t r = 0,
        bool ips = false, int16_t w = 360, int16_t h = 360,
        uint8_t col_offset1 = 0, uint8_t row_offset1 = 0, 
        uint8_t col_offset2 = 0, uint8_t row_offset2 = 0)
        : Arduino_TFT(bus, rst, r, ips, w, h, col_offset1, row_offset1, col_offset2, row_offset2)
    {
    }

    bool begin(int32_t speed = GFX_NOT_DEFINED) override
    {
        return Arduino_TFT::begin(speed);
    }

    void setRotation(uint8_t r) override
    {
        Arduino_TFT::setRotation(r);
        switch (_rotation)
        {
        case 1:
            r = 0x60;  // MX | MV
            break;
        case 2:
            r = 0xC0;  // MX | MY
            break;
        case 3:
            r = 0xA0;  // MY | MV
            break;
        default: // case 0:
            r = 0x00;
            break;
        }
        _bus->beginWrite();
        _bus->writeC8D8(0x36, r);  // MADCTL
        _bus->endWrite();
    }

    void writeAddrWindow(int16_t x, int16_t y, uint16_t w, uint16_t h) override
    {
        if ((x != _currentX) || (w != _currentW))
        {
            _currentX = x;
            _currentW = w;
            x += _xStart;
            _bus->writeC8D16D16(0x2A, x, x + w - 1);  // CASET
        }
        if ((y != _currentY) || (h != _currentH))
        {
            _currentY = y;
            _currentH = h;
            y += _yStart;
            _bus->writeC8D16D16(0x2B, y, y + h - 1);  // RASET
        }
        _bus->writeCommand(0x2C);  // RAMWR
    }

    void invertDisplay(bool i) override
    {
        _bus->sendCommand(i ? 0x21 : 0x20);  // INVON / INVOFF
    }

    void displayOn() override
    {
        _bus->sendCommand(0x11);  // SLPOUT
        delay(120);
        _bus->sendCommand(0x29);  // DISPON
    }

    void displayOff() override
    {
        _bus->sendCommand(0x28);  // DISPOFF
        _bus->sendCommand(0x10);  // SLPIN
        delay(120);
    }

protected:
    void tftInit() override
    {
        // Don't do hardware reset here - we already did it via GPIO expander
        // Just send the init commands
        _bus->batchOperation(ws_st77916_init_operations, sizeof(ws_st77916_init_operations));
    }
};

#endif
