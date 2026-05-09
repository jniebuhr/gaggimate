# GaggiMate Relay Server

WebSocket relay that lets you access your GaggiMate from anywhere in the world without port forwarding.

## How it works

```
Browser (anywhere) ←→ Relay Server (cloud) ←→ ESP32 (home)
```

The ESP32 connects **outbound** to the relay, so no port forwarding or public IP is needed.

## Deploy to Fly.io (free)

```bash
cd relay-server
npm install
fly launch          # creates app, generates fly.toml
fly deploy
```

Set your Fly.io app name in `fly.toml` first. Free tier works fine — 1 shared CPU, 256 MB RAM.

## Configure in GaggiMate

1. Open **Settings** in the GaggiMate web UI (on your local network)
2. Scroll to **Remote Access**
3. Enter your relay URL: `wss://your-app-name.fly.dev`
4. Enter a secret token (any random string, keep it private)
5. Save settings
6. Copy the **Remote Access Link** and bookmark it

## Local development

```bash
npm install
npm run dev       # starts on port 8080
```

## Protocol

- `GET /` — landing page (enter token manually)
- `GET /health` — health check
- `WS /connect?token=TOKEN&role=device` — ESP32 connection
- `WS /connect?token=TOKEN&role=browser` — browser connection

All messages are forwarded unchanged between device and browsers.
