#include "BluetoothDevices.h"
#include "grinders/bookoo_motto.h"
#include "scales/acaia.h"
#include "scales/bookoo.h"
#include "scales/decent.h"
#include "scales/difluid.h"
#include "scales/dot.h"
#include "scales/eclair.h"
#include "scales/eureka.h"
#include "scales/felicitaScale.h"
#include "scales/myscale.h"
#include "scales/timemore.h"
#include "scales/varia.h"
#include "scales/weighmybru.h"

void BluetoothDevices::registerBuiltinDrivers() {
    // Scales, in the order the firmware has always matched them.
    AcaiaScalesPlugin::apply();
    BookooScalesPlugin::apply();
    DecentScalesPlugin::apply();
    DifluidScalesPlugin::apply();
    EclairScalesPlugin::apply();
    EurekaScalesPlugin::apply();
    FelicitaScalePlugin::apply();
    TimemoreScalesPlugin::apply();
    VariaScalesPlugin::apply();
    WeighMyBrewScalePlugin::apply();
    myscalePlugin::apply();
    TimemoreDotScalesPlugin::apply();

    // Grinders
    BookooMottoGrinderPlugin::apply();
}
