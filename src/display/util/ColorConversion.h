#pragma once
#ifndef COLORCONVERSION_H
#define COLORCONVERSION_H

#include <Arduino.h>

// Converts a picker color (sRGB hex / 0-255 RGB) into calibrated PCA9634 PWM
// duties for the XL-5050RGBW tank LED.
//
// Why a plain "R->ch0, G->ch1, B->ch2" passthrough looks wrong, and what this
// fixes:
//   1. sRGB is gamma-encoded; PCA9634 PWM is ~linear in time-averaged light.
//      -> we sRGB-decode before treating values as "amount of light".
//   2. The four dies are not equal brightness. Datasheet output @20mA:
//      R ~700mcd, G ~1150mcd, B ~400mcd, W ~23.5lm -- green is brightest, blue
//      dimmest, and the white die far brighter still. Driving them 1:1 skews
//      every hue. -> per-die luminance weighting (white balance).
//   3. The dies are not the sRGB primaries, and the white die is a fixed ~6250K
//      white, not equal-energy. -> a CIE-XYZ mixing matrix maps a target color
//      to the die mix that actually reproduces it.
//
// The calibration constants below are derived from the XL-5050RGBW datasheet
// (XINGLIGHT, LCSC C7371891) plus your series resistors. They are plain numbers
// you can re-tune per build; see ColorConversion.cpp for the full derivation.

namespace ColorConversion {

struct Rgbw {
    uint8_t r;
    uint8_t g;
    uint8_t b;
    uint8_t w;
};

struct Rgb {
    uint8_t r;
    uint8_t g;
    uint8_t b;
};

struct Calibration {
    // CIE 1931 xy chromaticity of each die.
    //   G/B: spectral-locus point at the mid dominant wavelength (522 / 467 nm).
    //   R:   datasheet dominant ~622nm is the deep-red locus point
    //        (0.6951, 0.3047). That is more saturated than sRGB red, so the
    //        matrix mixes noticeable green into reds/oranges to desaturate down
    //        to it. Pulled in toward sRGB red to (0.660, 0.321) so reds/oranges
    //        stay punchy (tuned by eye). Push back toward 0.6951 for more green /
    //        sRGB accuracy; toward sRGB red's 0.64 for even less green.
    //   W:   daylight-locus point for ~6250K.
    double rx = 0.660, ry = 0.321;
    double gx = 0.0775, gy = 0.8341;
    double bx = 0.1303, by = 0.0471;
    double wx = 0.3170, wy = 0.3334;

    // Relative luminous output of each die at full PWM and its actual drive
    // current. Only the ratios matter (the code normalizes). The colored dies
    // are specced as luminous intensity (mcd @20mA), the white die as luminous
    // flux (lm), so we put all four on a flux basis via Phi ~= pi*I (~Lambertian
    // 120deg emitter -- same factor for every die), then scale by
    // (actual current / 20mA). Current comes from the 5V rail, series R and Vf:
    //   R:  700 mcd -> 0.700cd * pi = 2.20lm, * (5-2.1)/130 = 22.3mA/20 = 2.45
    //   G: 1150 mcd -> 1.150cd * pi = 3.61lm, * (5-3.1)/91  = 20.9mA/20 = 3.78
    //   B:  400 mcd -> 0.400cd * pi = 1.26lm, *               20.9mA/20 = 1.31
    //   W: 23.5 lm  (given directly),         *               20.9mA/20 = 24.6
    // (mcd/lm are midpoints of the datasheet ranges: R 600-800, G 1000-1300,
    //  B 350-450 mcd; W 20-27 lm.) The white die is so much brighter than the
    // colored dies that it dominates the neutral part of a color. wLum only
    // affects how much W is substituted for RGB-white (it touches nothing else),
    // so it is the knob for "how white vs. saturated" pastels look. Raised above
    // the ~24.6 datasheet-derived value to 40 so pastels (e.g. pink) lean less
    // on the white die and stay more saturated; pure white is unaffected (the
    // brightness fit still drives W to full). Higher -> less white in pastels.
    double rLum = 2.45;
    double gLum = 3.78;
    double bLum = 1.31;
    double wLum = 40.0;

    // How aggressively to use the dedicated white die for the neutral part of a
    // color. 1.0 = use it maximally (most efficient, best whites), 0.0 = never
    // (pure RGB mixing). Lower this if the white die's real color/brightness
    // differs enough from the assumed values to tint pastels.
    double whiteMix = 1.0;
};

// Convert an sRGB color (0-255 per channel, gamma-encoded, as from a web color
// picker) to calibrated RGBW duties.
Rgbw fromRgb(uint8_t r, uint8_t g, uint8_t b, const Calibration &cal = Calibration{});

// Convenience: parse "#RRGGBB" or "RRGGBB" and convert. Invalid input -> all 0.
Rgbw fromHex(const String &hex, const Calibration &cal = Calibration{});

// Inverse of fromRgb: reconstruct the sRGB color that produced these calibrated
// RGBW duties. Intended for migrating existing raw-duty settings (the legacy
// sunriseR/G/B/W) to a stored picker color. For an in-gamut color this is an
// exact inverse -- fromRgb(toRgb(d)) reproduces d (same hue and brightness).
Rgb toRgb(uint8_t r, uint8_t g, uint8_t b, uint8_t w, const Calibration &cal = Calibration{});

// Same as toRgb but formatted as an uppercase "#RRGGBB" string.
String toHex(uint8_t r, uint8_t g, uint8_t b, uint8_t w, const Calibration &cal = Calibration{});

} // namespace ColorConversion

#endif // COLORCONVERSION_H
