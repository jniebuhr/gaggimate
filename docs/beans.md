# Beans (custom fork feature)

Fork of GaggiMate **v1.8.1** (branch `beans`) adding a bean picker: up to 4 beans, each bound
to one brew profile, selectable on the touchscreen with a grind-size prompt.

## What it does

- **Web UI → Beans** (`/beans`): create/rename/delete up to 4 beans and pick each bean's
  profile. Shows the last grind size used per bean.
- **Touchscreen → menu → bean icon** (the former Grind slot): lists the beans. Tapping one
  opens a grind-size prompt (±0.5, defaults to that bean's last grind). Confirm (✓):
  remembers the grind, selects the bean's profile, switches to Brew mode and **starts the
  shot immediately**. Back arrow / swipe-up returns to the menu.
- The shot's notes (`/h/<id>.json`, visible in Shot History) get `beanType`, `beanId`,
  `grindSetting` and `source: "bean-picker"` once the shot is kept (> 7.5 s, like upstream).
- `evt:status` carries `bean`, `beanid`, `grind` of the last picked bean.

## WebSocket API

| Request | Fields | Response |
|---|---|---|
| `req:beans:list` | – | `{beans:[{id,name,profileId,lastGrind}]}` |
| `req:beans:save` | `bean:{id?,name,profileId}` | `{bean}` or `{error}` (`Max 4 beans`, `Profile not found`, …) |
| `req:beans:delete` | `id` | `{}` or `{error}` |
| `req:beans:select` | `id`, `grind` | starts the shot like the touchscreen; `{}` or `{error}` |

Beans live in **NVS** (`Preferences` namespace `beans`), so they survive filesystem
re-flashes and OTA updates (which wipe `/p` and `/h` on SPIFFS).

## Building (Docker, no host toolchain needed)

```bash
# firmware image (PlatformIO)            -> .pio/build/display/{bootloader,partitions,firmware}.bin
docker run --rm -u $(id -u):$(id -g) -e HOME=/tmp -v $PWD:/w -v ~/.pio-cache:/tmp/.platformio -w /w gm-pio pio run -e display
# web bundle into data/w + SPIFFS image  -> .pio/build/display/spiffs.bin
docker run --rm -u $(id -u):$(id -g) -e HOME=/tmp -e npm_config_cache=/tmp/.npm -v $PWD:/w -w /w node:22 bash scripts/build_spiffs.sh
docker run --rm -u $(id -u):$(id -g) -e HOME=/tmp -v $PWD:/w -v ~/.pio-cache:/tmp/.platformio -w /w gm-pio pio run -e display -t buildfs
```
`gm-pio` = `python:3.11-slim` + `git` + `pip install platformio` (see the session notes in
`~/CLAUDE.md`). The scales library is pinned to `#v1.0.2` in `platformio.ini` — unpinned
HEAD moved to NimBLE 2.x and no longer compiles against this release.

## Simulator (no hardware)

`sim/build.sh` compiles LVGL + the real generated screens + `BeanScreens.cpp` natively in a
Docker image, drives them with synthetic touches through the whole picker flow, asserts the
calls made into a stubbed controller, and writes `sim/out/*.png` frames to look at.

## Flashing (USB-C on the display board, LilyGo T-RGB)

Partition table (`default_16MB.csv`): app0 `0x10000`, otadata `0xE000`, SPIFFS `0xC90000`.

1. **Back up profiles + history** — they are on SPIFFS and `uploadfs` wipes them:
   `python3 scripts/backup_device_fs.py 192.168.2.27` → `data/p/*.json`, `data/h/*`
   (then `build_spiffs.sh` + `buildfs` bake them into the new image).
2. Plug the display in (`303a:1001`, appears as `/dev/ttyACM0`; your user needs `dialout`,
   or hold BOOT/SW1 while pressing RST if it doesn't auto-reset):
   ```bash
   docker run --rm --device /dev/ttyACM0 --group-add dialout -v $PWD:/w -v ~/.pio-cache:/tmp/.platformio -e HOME=/tmp -w /w gm-pio \
     pio run -e display -t upload --upload-port /dev/ttyACM0          # app only (keeps SPIFFS)
   docker run --rm --device /dev/ttyACM0 --group-add dialout -v $PWD:/w -v ~/.pio-cache:/tmp/.platformio -e HOME=/tmp -w /w gm-pio \
     pio run -e display -t uploadfs --upload-port /dev/ttyACM0        # SPIFFS (web UI + restored data)
   ```
   The app-only upload is enough to test the WebSocket API and the on-screen flow (use the
   web UI via `npm run dev`, which proxies to `gaggimate.local`).

## Rollback

Flash the official v1.8.1 release assets from
`https://github.com/jniebuhr/gaggimate/releases/tag/v1.8.1` with esptool at the same
offsets: `display-bootloader.bin` @ `0x0`, `display-partitions.bin` @ `0x8000`,
`docs/boot_app0.bin` @ `0xE000`, `display-firmware.bin` @ `0x10000`,
`display-filesystem.bin` @ `0xC90000`. NVS (settings, beans) is untouched.

## Grind Dialer sync (planned, not built)

Poll `req:history:list` for new ids, then `req:history:notes:get {id}`; import when
`notes.beanId` is present: `grind_size ← grindSetting`, `weight_g ← volume`,
`duration_ms ← duration`, `gaggimate_shot_id ← id`, `profile_id ← profileId`; match the
bean by `beanId` (store GaggiMate bean ids in the Grind Dialer's beans table).
