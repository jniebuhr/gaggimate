// itoa/utoa are declared in stdlib_noniso.h but the ESP core gets them from
// newlib; the host libc has neither, so define them here.
#include "stdlib_noniso.h"

static void reverse(char *begin, char *end) {
    char *is = begin;
    char *ie = end - 1;
    while (is < ie) {
        char tmp = *ie;
        *ie = *is;
        *is = tmp;
        ++is;
        --ie;
    }
}

char *itoa(int value, char *result, int base) {
    if (base < 2 || base > 16) {
        *result = 0;
        return result;
    }
    char *out = result;
    int quotient = value < 0 ? -value : value;
    do {
        const int tmp = quotient / base;
        *out = "0123456789abcdef"[quotient - (tmp * base)];
        ++out;
        quotient = tmp;
    } while (quotient);
    if (value < 0)
        *out++ = '-';
    reverse(result, out);
    *out = 0;
    return result;
}

char *utoa(unsigned int value, char *result, int base) {
    if (base < 2 || base > 16) {
        *result = 0;
        return result;
    }
    char *out = result;
    unsigned int quotient = value;
    do {
        const unsigned int tmp = quotient / base;
        *out = "0123456789abcdef"[quotient - (tmp * base)];
        ++out;
        quotient = tmp;
    } while (quotient);
    reverse(result, out);
    *out = 0;
    return result;
}
