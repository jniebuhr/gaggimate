#!/usr/bin/env python3
"""Pull profiles and shot history off a running GaggiMate into data/ so that
`build_spiffs.sh` + `pio run -t buildfs` bake them into the new filesystem
image. Needed before `uploadfs`, which wipes SPIFFS (/p and /h) - same as
upstream OTA does.

Usage:  python3 scripts/backup_device_fs.py 192.168.2.27 [data_dir]
Needs:  pip install websocket-client   (the grind-dialer container has it:
        docker exec -it grind-dialer python3 - < scripts/backup_device_fs.py 192.168.2.27)
"""
import json
import os
import sys
import time
import urllib.request
import uuid

import websocket

host = sys.argv[1] if len(sys.argv) > 1 else "192.168.2.27"
data_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), "..", "data")
p_dir = os.path.join(data_dir, "p")
h_dir = os.path.join(data_dir, "h")
os.makedirs(p_dir, exist_ok=True)
os.makedirs(h_dir, exist_ok=True)


def ws_request(ws, payload, timeout=30):
    rid = str(uuid.uuid4())
    payload = {**payload, "rid": rid}
    ws.send(json.dumps(payload))
    want = "res:" + payload["tp"][4:]
    deadline = time.time() + timeout
    while time.time() < deadline:
        msg = json.loads(ws.recv())
        if msg.get("tp") == want and msg.get("rid") == rid:
            return msg
    raise TimeoutError(payload["tp"])


def http_get(path, retries=6):
    """GET with retries/backoff: the ESP32's async web server occasionally
    stalls a request when serving many files from SPIFFS back to back."""
    last = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(f"http://{host}{path}", timeout=20) as r:
                return r.read()
        except urllib.error.HTTPError:
            raise
        except Exception as e:  # timeouts, resets
            last = e
            time.sleep(1.5 * (attempt + 1))
    raise last


def fetch_to(path, dest):
    """Skip files already backed up (resume), pace requests a little."""
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return "cached"
    data = http_get(path)
    with open(dest, "wb") as f:
        f.write(data)
    time.sleep(0.15)
    return "ok"


ws = websocket.create_connection(f"ws://{host}/ws", timeout=30)

# --- profiles -----------------------------------------------------------------
profiles = ws_request(ws, {"tp": "req:profiles:list"})["profiles"]
for p in profiles:
    with open(os.path.join(p_dir, f"{p['id']}.json"), "w") as f:
        json.dump(p, f)
print(f"profiles: {len(profiles)} -> {p_dir}")

# --- history ------------------------------------------------------------------
shots = ws_request(ws, {"tp": "req:history:list"}, timeout=60)["history"]
ws.close()
ids = sorted(s["id"] for s in shots)
print(f"history: {len(ids)} shots listed by the device")
ok_slog = ok_notes = 0
for i, sid in enumerate(ids, 1):
    fetch_to(f"/api/history/{sid}.slog", os.path.join(h_dir, f"{sid}.slog"))
    ok_slog += 1
    try:
        fetch_to(f"/api/history/{sid}.json", os.path.join(h_dir, f"{sid}.json"))
        ok_notes += 1
    except urllib.error.HTTPError as e:
        if e.code != 404:
            raise
    if i % 25 == 0:
        print(f"  {i}/{len(ids)}", flush=True)
try:
    with open(os.path.join(h_dir, "index.bin"), "wb") as f:
        f.write(http_get("/api/history/index.bin"))
    print("history: index.bin saved")
except urllib.error.HTTPError as e:
    print(f"history: no index.bin ({e.code}) - the device will rebuild it")
print(f"history: {ok_slog} .slog + {ok_notes} notes -> {h_dir}")

# --- sanity --------------------------------------------------------------------
missing = [sid for sid in ids if not os.path.exists(os.path.join(h_dir, f"{sid}.slog"))]
if missing:
    print("MISSING:", missing)
    sys.exit(1)
print("OK - counts match; now run scripts/build_spiffs.sh and pio run -e display -t buildfs")
