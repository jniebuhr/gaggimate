// Reuse the real hardware settings helpers. The sim's GaggiMateClient.h has its own gm::Payload stand-in,
// so only the one nanopb alias they need is declared and the real Messages.h aliases are skipped.
#pragma once
#include "gaggimate.pb.h"

namespace gm {
using MachineHardwareSettings = gaggimate_MachineHardwareSettings;
}

#ifndef NANOPBCOMM_MESSAGES_H
#define NANOPBCOMM_MESSAGES_H
#endif
#include "../../lib/NanoPbComm/src/MachineHardwareSettings.h"
