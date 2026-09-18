# Native (x86) build environment for the offscreen LVGL simulator of the
# on-device UI. No SDL/X11: frames are rendered into memory and dumped as PNG.
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends gcc g++ make python3 ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /w
