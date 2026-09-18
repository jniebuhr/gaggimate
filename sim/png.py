#!/usr/bin/env python3
"""Convert the simulator's raw RGB565 frame dumps (480x480) to PNG, stdlib only."""
import struct
import sys
import zlib

W = H = 480


def rgb565_to_png(raw: bytes, out_path: str):
    rows = []
    for y in range(H):
        row = bytearray([0])  # filter type 0
        base = y * W * 2
        for x in range(W):
            v = raw[base + 2 * x] | (raw[base + 2 * x + 1] << 8)
            r = (v >> 11) & 0x1F
            g = (v >> 5) & 0x3F
            b = v & 0x1F
            row += bytes(((r * 255) // 31, (g * 255) // 63, (b * 255) // 31))
        rows.append(bytes(row))

    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(b"".join(rows), 6))
    png += chunk(b"IEND", b"")
    with open(out_path, "wb") as f:
        f.write(png)


if __name__ == "__main__":
    for src in sys.argv[1:]:
        with open(src, "rb") as f:
            rgb565_to_png(f.read(), src.rsplit(".", 1)[0] + ".png")
        print("wrote", src.rsplit(".", 1)[0] + ".png")
