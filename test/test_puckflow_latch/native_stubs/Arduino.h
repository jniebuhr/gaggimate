// Native-host stand-in for the real Arduino.h (ESP32 core), scoped to what
// PressureController.cpp actually needs it for.
//
// PressureController.cpp includes <Arduino.h> only for the ESP_LOGI() macro
// used once in reset() — everything else it touches is plain STL/math and
// compiles natively without it. The real ESP32 Arduino.h pulls in the whole
// FreeRTOS/ESP-IDF/lwIP stack, none of which exists (or is needed) for a
// host build, and none of which `platform = native` can build against.
//
// test_puckflow_latch.cpp #defines ESP_LOGI to a no-op before pulling in
// PressureController.cpp, so this header intentionally defines nothing —
// its only job is to satisfy the #include so the real header isn't sought.
// Picked up ahead of the real Arduino.h via -I ordering in platformio.ini.
