// Out-of-line definitions for the Driver base virtuals so its vtable/typeinfo is
// emitted in the simulator build (SdlDriver overrides all of these, so none of
// these fallbacks are ever actually called).
#include <display/drivers/Driver.h>

bool Driver::isCompatible() { return false; }
void Driver::init() {}
void Driver::setBrightness(int) {}
bool Driver::supportsSDCard() { return false; }
bool Driver::installSDCard() { return false; }
