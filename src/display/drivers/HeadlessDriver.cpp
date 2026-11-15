#ifdef GAGGIMATE_HEADLESS
#include "HeadlessDriver.h"
#include <Arduino.h>
#include <SD_MMC.h>

HeadlessDriver *HeadlessDriver::instance = nullptr;

// The display drivers leave the base virtuals undefined; headless builds anchor the vtable here.
bool Driver::isCompatible() { return false; }
void Driver::init() {}
void Driver::setBrightness(int) {}
bool Driver::supportsSDCard() { return false; }
bool Driver::installSDCard() { return false; }

void HeadlessDriver::init() {
    // GPIO43 boots as the UART0 console; park it idle-high so our log output never reaches the controller's RX.
    pinMode(UART_TX_PIN, OUTPUT);
    digitalWrite(UART_TX_PIN, HIGH);
}

bool HeadlessDriver::installSDCard() {
    // 1-bit SD mode only uses D0; D3 doubles as chip select and has to idle high.
    pinMode(SD_D3_PIN, OUTPUT);
    digitalWrite(SD_D3_PIN, HIGH);

    SD_MMC.setPins(SD_CLK_PIN, SD_CMD_PIN, SD_D0_PIN);

    // maxOpenFiles 10: the web server serves several shot logs next to live logging and index access. [GM-90]
    if (!SD_MMC.begin("/sdcard", true, false, BOARD_MAX_SDMMC_FREQ, 10))
        return false;
    if (SD_MMC.cardType() == CARD_NONE) {
        SD_MMC.end();
        return false;
    }
    return true;
}
#endif // GAGGIMATE_HEADLESS
