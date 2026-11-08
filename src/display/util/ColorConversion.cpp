#include "ColorConversion.h"

#include <algorithm>
#include <cmath>

// ---------------------------------------------------------------------------
// Pipeline (see ColorConversion.h for the "why"):
//
//   sRGB 0-255  --decode-->  linear sRGB  --[sRGB->XYZ]-->  target XYZ
//        --[M_rgb^-1]-->  R/G/B die intensities
//        --white extraction-->  R/G/B/W die intensities (color-preserving)
//        --brightness fit-->  scaled die intensities (chromaticity-preserving)
//        --x255-->  PCA9634 duties
//
// "Die intensity" is a 0..1 fraction of that die's full output. PCA9634 PWM duty
// is ~linear in time-averaged light, so duty = round(255 * intensity); no
// re-gamma on the way out.
// ---------------------------------------------------------------------------

namespace ColorConversion {

namespace {

double srgbToLinear(double c) { return c <= 0.04045 ? c / 12.92 : std::pow((c + 0.055) / 1.055, 2.4); }

double linearToSrgb(double c) {
    c = std::min(1.0, std::max(0.0, c));
    return c <= 0.0031308 ? 12.92 * c : 1.055 * std::pow(c, 1.0 / 2.4) - 0.055;
}

void xyYToXYZ(double x, double y, double Y, double &X, double &Z) {
    if (y < 1e-6) {
        X = 0.0;
        Z = 0.0;
        return;
    }
    X = (x / y) * Y;
    Z = ((1.0 - x - y) / y) * Y;
}

bool invert3x3(const double m[3][3], double out[3][3]) {
    const double a = m[0][0], b = m[0][1], c = m[0][2];
    const double d = m[1][0], e = m[1][1], f = m[1][2];
    const double g = m[2][0], h = m[2][1], i = m[2][2];

    const double A = e * i - f * h;
    const double B = -(d * i - f * g);
    const double C = d * h - e * g;
    const double det = a * A + b * B + c * C;
    if (std::fabs(det) < 1e-12) {
        return false;
    }
    const double invDet = 1.0 / det;

    out[0][0] = A * invDet;
    out[0][1] = (c * h - b * i) * invDet;
    out[0][2] = (b * f - c * e) * invDet;
    out[1][0] = B * invDet;
    out[1][1] = (a * i - c * g) * invDet;
    out[1][2] = (c * d - a * f) * invDet;
    out[2][0] = C * invDet;
    out[2][1] = (b * g - a * h) * invDet;
    out[2][2] = (a * e - b * d) * invDet;
    return true;
}

void mul3x3(const double m[3][3], double x, double y, double z, double &ox, double &oy, double &oz) {
    ox = m[0][0] * x + m[0][1] * y + m[0][2] * z;
    oy = m[1][0] * x + m[1][1] * y + m[1][2] * z;
    oz = m[2][0] * x + m[2][1] * y + m[2][2] * z;
}

uint8_t toDuty(double intensity) {
    const double clamped = std::min(1.0, std::max(0.0, intensity));
    return static_cast<uint8_t>(std::lround(clamped * 255.0));
}

} // namespace

Rgbw fromRgb(uint8_t r, uint8_t g, uint8_t b, const Calibration &cal) {
    const double lr = srgbToLinear(r / 255.0);
    const double lg = srgbToLinear(g / 255.0);
    const double lb = srgbToLinear(b / 255.0);
    const double V = std::max({lr, lg, lb});
    if (V <= 0.0) {
        return {0, 0, 0, 0};
    }

    const double X = 0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb;
    const double Y = 0.2126729 * lr + 0.7151522 * lg + 0.0721750 * lb;
    const double Z = 0.0193339 * lr + 0.1191920 * lg + 0.9503041 * lb;

    const double lumMax = std::max({cal.rLum, cal.gLum, cal.bLum, cal.wLum, 1e-9});
    double Xr, Zr, Xg, Zg, Xb, Zb, Xw, Zw;
    xyYToXYZ(cal.rx, cal.ry, cal.rLum / lumMax, Xr, Zr);
    xyYToXYZ(cal.gx, cal.gy, cal.gLum / lumMax, Xg, Zg);
    xyYToXYZ(cal.bx, cal.by, cal.bLum / lumMax, Xb, Zb);
    xyYToXYZ(cal.wx, cal.wy, cal.wLum / lumMax, Xw, Zw);

    const double M[3][3] = {
        {Xr, Xg, Xb},
        {cal.rLum / lumMax, cal.gLum / lumMax, cal.bLum / lumMax},
        {Zr, Zg, Zb},
    };
    double Minv[3][3];
    if (!invert3x3(M, Minv)) {
        return {toDuty(lr), toDuty(lg), toDuty(lb), 0};
    }

    double dr, dg, db;
    mul3x3(Minv, X, Y, Z, dr, dg, db);
    dr = std::max(0.0, dr);
    dg = std::max(0.0, dg);
    db = std::max(0.0, db);

    double dw = 0.0;
    double rfw, gfw, bfw;
    mul3x3(Minv, Xw, cal.wLum / lumMax, Zw, rfw, gfw, bfw);
    if (rfw > 1e-9 && gfw > 1e-9 && bfw > 1e-9) {
        dw = std::min({dr / rfw, dg / gfw, db / bfw, cal.whiteMix});
        dw = std::max(0.0, dw);
        dr = std::max(0.0, dr - dw * rfw);
        dg = std::max(0.0, dg - dw * gfw);
        db = std::max(0.0, db - dw * bfw);
    }

    const double mx = std::max({dr, dg, db, dw});
    if (mx > 1e-9) {
        const double f = V / mx;
        dr *= f;
        dg *= f;
        db *= f;
        dw *= f;
    }

    return {toDuty(dr), toDuty(dg), toDuty(db), toDuty(dw)};
}

Rgbw fromHex(const String &hex, const Calibration &cal) {
    String s = hex;
    s.trim();
    if (s.startsWith("#")) {
        s = s.substring(1);
    }
    if (s.length() != 6) {
        return {0, 0, 0, 0};
    }
    char *end = nullptr;
    const long value = strtol(s.c_str(), &end, 16);
    if (end == s.c_str() || *end != '\0') {
        return {0, 0, 0, 0};
    }
    const uint8_t r = (value >> 16) & 0xFF;
    const uint8_t g = (value >> 8) & 0xFF;
    const uint8_t b = value & 0xFF;
    return fromRgb(r, g, b, cal);
}

Rgb toRgb(uint8_t r, uint8_t g, uint8_t b, uint8_t w, const Calibration &cal) {
    // Inverse of fromRgb.
    const double kr = r / 255.0;
    const double kg = g / 255.0;
    const double kb = b / 255.0;
    const double kw = w / 255.0;
    const double V = std::max({kr, kg, kb, kw});
    if (V <= 0.0) {
        return {0, 0, 0};
    }

    const double lumMax = std::max({cal.rLum, cal.gLum, cal.bLum, cal.wLum, 1e-9});
    double Xr, Zr, Xg, Zg, Xb, Zb, Xw, Zw;
    xyYToXYZ(cal.rx, cal.ry, cal.rLum / lumMax, Xr, Zr);
    xyYToXYZ(cal.gx, cal.gy, cal.gLum / lumMax, Xg, Zg);
    xyYToXYZ(cal.bx, cal.by, cal.bLum / lumMax, Xb, Zb);
    xyYToXYZ(cal.wx, cal.wy, cal.wLum / lumMax, Xw, Zw);
    const double X = Xr * kr + Xg * kg + Xb * kb + Xw * kw;
    const double Y = (cal.rLum * kr + cal.gLum * kg + cal.bLum * kb + cal.wLum * kw) / lumMax;
    const double Z = Zr * kr + Zg * kg + Zb * kb + Zw * kw;

    double lr = 3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z;
    double lg = -0.9692660 * X + 1.8760108 * Y + 0.0415560 * Z;
    double lb = 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z;
    lr = std::max(0.0, lr);
    lg = std::max(0.0, lg);
    lb = std::max(0.0, lb);

    const double mx = std::max({lr, lg, lb});
    if (mx > 1e-9) {
        const double f = V / mx;
        lr *= f;
        lg *= f;
        lb *= f;
    }

    return {toDuty(linearToSrgb(lr)), toDuty(linearToSrgb(lg)), toDuty(linearToSrgb(lb))};
}

String toHex(uint8_t r, uint8_t g, uint8_t b, uint8_t w, const Calibration &cal) {
    const Rgb c = toRgb(r, g, b, w, cal);
    char buf[8];
    snprintf(buf, sizeof(buf), "#%02X%02X%02X", c.r, c.g, c.b);
    return String(buf);
}

} // namespace ColorConversion
