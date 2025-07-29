#include "CO5300.h"

CO5300::CO5300(Arduino_DataBus *bus, int8_t rst, uint8_t r, bool ips, int16_t w, int16_t h, uint8_t col_offset1,
               uint8_t row_offset1, uint8_t col_offset2, uint8_t row_offset2, uint8_t color_order)
    : Arduino_CO5300(bus, rst, r, ips, w, h, col_offset1, row_offset1, col_offset2, row_offset2), _color_order(color_order) {}

void CO5300::setRotation(uint8_t r) {
    Arduino_TFT::setRotation(r);
    switch (_rotation) {
    case 1:
        r = _color_order | 0x60;
        break;
    case 2:
        r = _color_order | 0xC0;
        break;
    case 3:
        r = _color_order | 0xA0;
        break;
    default: // case 0:
        r = _color_order;
        break;
    }
    _bus->beginWrite();
    _bus->writeC8D8(CO5300_W_MADCTL, r);
    _bus->endWrite();
}
