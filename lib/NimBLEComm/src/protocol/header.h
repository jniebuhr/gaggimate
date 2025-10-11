#include <cstdint>
#include "gaggimate.pb.h"

#pragma pack(push, 1)
struct FrameHeader {
    uint16_t len;
    _MessageType mt;
    uint16_t seq;
};
#pragma pack(pop)
static_assert(sizeof(FrameHeader) == 5, "packed");
