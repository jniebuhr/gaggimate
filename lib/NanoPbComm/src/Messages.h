#ifndef NANOPBCOMM_MESSAGES_H
#define NANOPBCOMM_MESSAGES_H

// NanoPbComm-internal aliases for nanopb types (gm::Payload vs gaggimate_Payload); firmware never sees nanopb structs.
// The gaggimate_*_tag/_msg/_init_zero macros are not types, so they keep their full names.

#include "gaggimate.pb.h"

namespace gm {

using Frame = gaggimate_Frame;
using Payload = gaggimate_Payload;

using Ping = gaggimate_Ping;
using BoilerControl = gaggimate_BoilerControl;
using PumpControl = gaggimate_PumpControl;
using RelayControl = gaggimate_RelayControl;
using PidSettings = gaggimate_PidSettings;
using PumpSettings = gaggimate_PumpSettings;
using AutotuneRequest = gaggimate_AutotuneRequest;
using PressureScale = gaggimate_PressureScale;
using Tare = gaggimate_Tare;
using LedChannel = gaggimate_LedChannel;
using LedControl = gaggimate_LedControl;

using DeviceCapabilities = gaggimate_Capabilities;
using Addon = gaggimate_Addon;
using SystemInfo = gaggimate_SystemInfo;
using SensorData = gaggimate_SensorData;
using BoilerReading = gaggimate_BoilerReading;
using ButtonState = gaggimate_ButtonState;
using AutotuneResult = gaggimate_AutotuneResult;
using VolumetricMeasurement = gaggimate_VolumetricMeasurement;
using TofMeasurement = gaggimate_TofMeasurement;
using Error = gaggimate_Error;

using PumpMode = gaggimate_PumpMode;
using BoilerMode = gaggimate_BoilerMode;
using ErrorCode = gaggimate_ErrorCode;

} // namespace gm

#endif // NANOPBCOMM_MESSAGES_H
