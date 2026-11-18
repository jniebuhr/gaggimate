#ifndef OTA_CA_BUNDLE_H
#define OTA_CA_BUNDLE_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

// Trusted roots for firmware TLS, generated at build time from lib/OTA/certs/ca_roots.pem.
extern const uint8_t gm_ca_bundle[];

#ifdef __cplusplus
}
#endif

#endif
