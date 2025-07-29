
#ifndef CO5300_H
#define CO5300_H

#include "Arduino_GFX_Library.h"

class CO5300 : public Arduino_CO5300 {
  public:
    CO5300(Arduino_DataBus *bus, int8_t rst = GFX_NOT_DEFINED, uint8_t r = 0, bool ips = false, int16_t w = CO5300_MAXWIDTH,
           int16_t h = CO5300_MAXHEIGHT, uint8_t col_offset1 = 0, uint8_t row_offset1 = 0, uint8_t col_offset2 = 0,
           uint8_t row_offset2 = 0, uint8_t color_order = CO5300_MADCTL_RGB);
    void setRotation(uint8_t r) override;

  private:
    uint8_t _color_order;
};

#endif