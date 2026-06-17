// Host shim for mbedtls/platform.h: only the custom allocator hook is used.
#pragma once

#include <stddef.h>

static inline int mbedtls_platform_set_calloc_free(void *(*calloc_func)(size_t, size_t), void (*free_func)(void *)) {
    (void)calloc_func;
    (void)free_func;
    return 0;
}
