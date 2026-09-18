"""Mock GaggiMate WebSocket server for developing the web UI without a device.

Speaks the subset of the /ws protocol the Beans page (and the dashboard shell)
need: evt:status, req:profiles:list, req:beans:{list,save,delete,select}, plus
a permissive fallback that answers any other req:* with an empty res:*.

Run (from repo root):
    pip install websockets   (or use a python:3.12 container)
    python scripts/mock_gaggimate_ws.py            # listens on :80 at /ws
    MOCK_PORT=8765 python scripts/mock_gaggimate_ws.py

Then start vite in a container on the same docker network with this container
aliased as `gaggimate.local`, so vite.config.js's proxy hits the mock.
"""

import asyncio
import json
import os
import random
import string
import time

import websockets

PORT = int(os.environ.get("MOCK_PORT", "80"))
MAX_BEANS = 4

PROFILES = [
    {"id": "9bar", "label": "9 Bar Espresso", "type": "standard", "favorite": True, "selected": True},
    {"id": "adapt", "label": "Adaptive v2", "type": "pro", "favorite": True},
    {"id": "LPtVV8nKXg", "label": "Sems LightRoast Special", "type": "pro", "favorite": False},
    {"id": "flush", "label": "[Utility] Backflush", "type": "standard", "utility": True},
]
state = {
    "beans": [
        {"id": "b1", "name": "Honduras", "profileId": "9bar", "lastGrind": 14.0},
        {"id": "b2", "name": "Ethiopie", "profileId": "adapt", "lastGrind": 0.0},
    ],
    "active": None,   # {"id", "name", "grind"}
    "selected": "9bar",
    "mode": 1,
}


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


def short_id():
    return "".join(random.choices(string.ascii_letters + string.digits, k=6))


def bean_response(rtype, request):
    resp = {"tp": "res:" + rtype[4:], "rid": request.get("rid")}
    beans = state["beans"]
    if rtype == "req:beans:list":
        resp["beans"] = beans
    elif rtype == "req:beans:save":
        b = request.get("bean") or {}
        bid = b.get("id")
        name = (b.get("name") or "").strip()
        pid = b.get("profileId") or ""
        if not name or not pid:
            resp["error"] = "Name and profile are required"
        elif bid and any(x["id"] == bid for x in beans):
            for x in beans:
                if x["id"] == bid:
                    x["name"], x["profileId"] = name, pid
                    resp["bean"] = x
        elif len(beans) >= MAX_BEANS:
            resp["error"] = f"Max {MAX_BEANS} beans"
        else:
            nb = {"id": short_id(), "name": name, "profileId": pid, "lastGrind": 0.0}
            beans.append(nb)
            resp["bean"] = nb
    elif rtype == "req:beans:delete":
        bid = request.get("id")
        before = len(beans)
        state["beans"] = [x for x in beans if x["id"] != bid]
        if len(state["beans"]) == before:
            resp["error"] = "Bean not found"
    elif rtype == "req:beans:select":
        bid = request.get("id")
        grind = float(request.get("grind") or 0)
        bean = next((x for x in beans if x["id"] == bid), None)
        if not bean:
            resp["error"] = "Bean not found"
        else:
            bean["lastGrind"] = grind
            state["active"] = {"id": bid, "name": bean["name"], "grind": grind}
            state["selected"] = bean["profileId"]
            state["mode"] = 1
            log(f"!! bean select -> profile {bean['profileId']} grind {grind} (would start shot)")
    return resp


async def status_loop(ws):
    while True:
        sel = next((p for p in PROFILES if p["id"] == state["selected"]), PROFILES[0])
        doc = {
            "tp": "evt:status", "ct": 92.4, "tt": 93, "pr": 0.0, "fl": 0.0, "pt": 9,
            "m": state["mode"], "p": sel["label"], "puid": sel["id"], "cp": True, "cd": True,
            "tw": 36, "bta": 0, "bt": 0, "btd": 30, "gtd": 25000, "gtv": 18, "gt": 0, "gact": 0,
            "wl": 100, "tof": 0, "rssi": -50, "process": None,
        }
        a = state["active"]
        doc["bean"] = a["name"] if a else ""
        doc["beanid"] = a["id"] if a else ""
        doc["grind"] = a["grind"] if a else 0
        await ws.send(json.dumps(doc))
        await asyncio.sleep(2)


async def handler(ws):
    log("client connected")
    st = asyncio.create_task(status_loop(ws))
    try:
        async for raw in ws:
            try:
                req = json.loads(raw)
            except ValueError:
                continue
            tp = req.get("tp", "")
            log("recv", tp)
            if tp == "req:profiles:list":
                profiles = PROFILES
                if req.get("minimal"):
                    profiles = [{"id": p["id"], "label": p["label"]} for p in PROFILES]
                await ws.send(json.dumps({"tp": "res:profiles:list", "rid": req.get("rid"), "profiles": profiles}))
            elif tp.startswith("req:beans:"):
                await ws.send(json.dumps(bean_response(tp, req)))
            elif tp == "req:profiles:select":
                state["selected"] = req.get("id")
                await ws.send(json.dumps({"tp": "res:profiles:select", "rid": req.get("rid")}))
            elif tp.startswith("req:"):
                await ws.send(json.dumps({"tp": "res:" + tp[4:], "rid": req.get("rid")}))
    except websockets.ConnectionClosed:
        pass
    finally:
        st.cancel()
        log("client disconnected")


async def main():
    async with websockets.serve(handler, "0.0.0.0", PORT):
        log(f"mock gaggimate ws listening on :{PORT}/ws")
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
