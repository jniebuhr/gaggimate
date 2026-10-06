#ifndef SDIMAGEDECODER_H
#define SDIMAGEDECODER_H

// LVGL decoder for raw "S:...bin" images: loads the file once into a single PSRAM slot instead of reading SD per redraw.
void sdImageDecoderInit();

// Any task: drop the cached image so the next draw reloads it from SD (e.g. after an upload replaced the file).
void sdImageInvalidate();

// UI task only: apply a pending invalidation; returns true if the cached image was dropped.
bool sdImageProcessInvalidation();

#endif // SDIMAGEDECODER_H
