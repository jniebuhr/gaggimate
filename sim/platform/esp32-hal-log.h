// Host shim for Arduino esp32-hal-log.h: log_* macros print to stderr.
#pragma once

#include <stdio.h>

#define log_e(fmt, ...) fprintf(stderr, "[E] " fmt "\n", ##__VA_ARGS__)
#define log_w(fmt, ...) fprintf(stderr, "[W] " fmt "\n", ##__VA_ARGS__)
#define log_i(fmt, ...) fprintf(stderr, "[I] " fmt "\n", ##__VA_ARGS__)
#define log_d(fmt, ...) ((void)0)
#define log_v(fmt, ...) ((void)0)
#define log_n(fmt, ...) ((void)0)
#define isr_log_e(fmt, ...) log_e(fmt, ##__VA_ARGS__)
