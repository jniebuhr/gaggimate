#ifndef CONFIG_H
#define CONFIG_H

#define WIFI_AP_SSID "GaggiMate"
#define NTP_SERVER "pool.ntp.org"

// Burn-in protection for AMOLED/OLED panels. Override either value with a
// build flag when a different delay or flash rate is wanted.
#ifndef OLED_SCREENSAVER_TIMEOUT_MS
#ifdef GAGGIMATE_SIM
#define OLED_SCREENSAVER_TIMEOUT_MS (5UL * 1000UL)
#else
#define OLED_SCREENSAVER_TIMEOUT_MS (5UL * 60UL * 1000UL)
#endif
#endif

#ifndef OLED_SCREENSAVER_FLASH_INTERVAL_MS
#define OLED_SCREENSAVER_FLASH_INTERVAL_MS 1000UL
#endif

#endif
