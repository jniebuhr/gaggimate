// Host shim for Arduino <pgmspace.h>: flash macros are no-ops on a desktop.
#pragma once

#include <stdint.h>
#include <stdio.h>
#include <string.h>

#define PROGMEM
#define PGM_P const char *
#define PGM_VOID_P const void *
#ifndef PSTR
#define PSTR(s) (s)
#endif

// pgm_read_* are plain dereferences on a flat address space.
#define pgm_read_byte(addr) (*reinterpret_cast<const uint8_t *>(addr))
#define pgm_read_word(addr) (*reinterpret_cast<const uint16_t *>(addr))
#define pgm_read_dword(addr) (*reinterpret_cast<const uint32_t *>(addr))
#define pgm_read_float(addr) (*reinterpret_cast<const float *>(addr))
#define pgm_read_ptr(addr) (*reinterpret_cast<const void *const *>(addr))
#define pgm_read_byte_near(addr) pgm_read_byte(addr)
#define pgm_read_word_near(addr) pgm_read_word(addr)

// _P string helpers map straight onto their libc equivalents.
#define strlen_P strlen
#define strcpy_P strcpy
#define strncpy_P strncpy
#define strcat_P strcat
#define strncat_P strncat
#define strcmp_P strcmp
#define strncmp_P strncmp
#define strcasecmp_P strcasecmp
#define strstr_P strstr
#define memcpy_P memcpy
#define memcmp_P memcmp
#define sprintf_P sprintf
#define snprintf_P snprintf
#define vsnprintf_P vsnprintf
