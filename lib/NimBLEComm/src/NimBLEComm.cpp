#include "NimBLEComm.h"

String get_token(const String &from, uint8_t index, char separator) {
    uint16_t start = 0;
    uint16_t idx = 0;
    uint8_t cur = 0;
    while (idx < from.length()) {
        if (from.charAt(idx) == separator) {
            if (cur == index) {
                return from.substring(start, idx);
            }
            cur++;
            while (idx < from.length() - 1 && from.charAt(idx + 1) == separator)
                idx++;
            start = idx + 1;
        }
        idx++;
    }
    if ((cur == index) && (start < from.length())) {
        return from.substring(start, from.length());
    }
    return "";
}
