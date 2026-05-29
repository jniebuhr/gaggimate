#ifndef NANOPBCOMM_MESSAGES_H
#define NANOPBCOMM_MESSAGES_H

// Short, namespaced aliases for the package-prefixed nanopb types so library
// internals read cleanly (gm::Payload instead of gaggimate_Payload). These are
// used only inside NanoPbComm -- the high-level GaggiMateClient/Server API
// exposes plain C++ types, so firmware code never sees nanopb structs.
//
// Tag/descriptor/init macros (gaggimate_*_tag, gaggimate_*_msg,
// gaggimate_*_init_zero) are macros, not types, so they are referenced with
// their full names where needed.

#include "gaggimate.pb.h"

namespace gm {

using Frame = gaggimate_Frame;
using Payload = gaggimate_Payload;

using Ping = gaggimate_Ping;
using BoilerControl = gaggimate_BoilerControl;
using PumpControl = gaggimate_PumpControl;
using ValveControl = gaggimate_ValveControl;
using AltControl = gaggimate_AltControl;
using PidSettings = gaggimate_PidSettings;
using PumpModelCoeffs = gaggimate_PumpModelCoeffs;
using AutotuneRequest = gaggimate_AutotuneRequest;
using PressureScale = gaggimate_PressureScale;
using Tare = gaggimate_Tare;
using LedControl = gaggimate_LedControl;

using DeviceCapabilities = gaggimate_Capabilities;
using SystemInfo = gaggimate_SystemInfo;
using SensorData = gaggimate_SensorData;
using ButtonState = gaggimate_ButtonState;
using AutotuneResult = gaggimate_AutotuneResult;
using VolumetricMeasurement = gaggimate_VolumetricMeasurement;
using TofMeasurement = gaggimate_TofMeasurement;
using Error = gaggimate_Error;

using PumpMode = gaggimate_PumpMode;
using ErrorCode = gaggimate_ErrorCode;

} // namespace gm

#endif // NANOPBCOMM_MESSAGES_H
