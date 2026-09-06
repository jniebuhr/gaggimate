#!/usr/bin/env python3
"""GitHub release-asset emulator with fault injection for the OTA download test bench.

Routes mirror github.com: /releases/latest/download/<asset> -> 302 -> /releases/download/v<n>/<asset>
-> 302 -> /cdn/<token>/v<n>/<asset> (time-limited token, Accept-Ranges, ETag, If-Range, 206/416).
Faults (drop, stall, 5xx, ignored Range, throttling) are injected on CDN responses from a seeded RNG.
"""
import argparse
import json
import random
import re
import socket
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ASSET_SIZES = {"small.bin": 256 * 1024, "display-firmware.bin": 1024 * 1024, "big.bin": 4 * 1024 * 1024}
CHUNK = 16 * 1024
VERBOSE = False


def fnv1a(text):
    h = 2166136261
    for c in text.encode():
        h ^= c
        h = (h * 16777619) & 0xFFFFFFFF
    return h


def generate_asset(name, version, size):
    """Same xorshift32 stream as test/ota_common/asset_gen.h."""
    state = (fnv1a(name) ^ ((version * 0x9E3779B1) & 0xFFFFFFFF) ^ (size & 0xFFFFFFFF)) & 0xFFFFFFFF
    if state == 0:
        state = 1
    out = bytearray(size)
    i = 0
    while i < size:
        state ^= (state << 13) & 0xFFFFFFFF
        state ^= state >> 17
        state ^= (state << 5) & 0xFFFFFFFF
        n = min(4, size - i)
        out[i : i + n] = state.to_bytes(4, "little")[:n]
        i += n
    return bytes(out)


class State:
    def __init__(self, seed, token_ttl):
        self.lock = threading.Lock()
        self.versions = {}
        self.assets = {}
        self.reset(seed=seed, token_ttl=token_ttl)

    def reset(self, **params):
        with self.lock:
            self.rng = random.Random(int(params.get("seed", 1)))
            self.chaos = {
                "drop": float(params.get("drop", 0.0)),
                "stall": float(params.get("stall", 0.0)),
                "err": float(params.get("err", 0.0)),
                "ignore_range": float(params.get("ignore_range", 0.0)),
            }
            self.bandwidth = int(params.get("bandwidth", 0))  # bytes/s, 0 = unlimited
            self.token_ttl = float(params.get("token_ttl", 3600.0))
            self.stall_seconds = float(params.get("stall_seconds", 2.5))
            self.stats = {"requests": 0, "drops": 0, "stalls": 0, "errors": 0, "ignored_ranges": 0, "expired_tokens": 0}

    def version(self, name):
        with self.lock:
            return self.versions.get(name, 1)

    def swap(self, name):
        with self.lock:
            self.versions[name] = self.versions.get(name, 1) + 1
            return self.versions[name]

    def asset(self, name, version):
        size = ASSET_SIZES.get(name)
        if size is None:
            return None
        key = (name, version)
        with self.lock:
            if key not in self.assets:
                self.assets[key] = generate_asset(name, version, size)
            return self.assets[key]

    def roll_fault(self):
        with self.lock:
            r = self.rng.random()
            frac = self.rng.random()
            acc = 0.0
            for kind in ("err", "drop", "stall", "ignore_range"):
                acc += self.chaos[kind]
                if r < acc:
                    return kind, frac
            return None, frac

    def count(self, key):
        with self.lock:
            self.stats[key] += 1


STATE = None


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        if VERBOSE:
            super().log_message(fmt, *args)

    def do_GET(self):
        try:
            self.route()
        except (BrokenPipeError, ConnectionResetError):
            pass

    def route(self):
        url = urlparse(self.path)
        parts = [p for p in url.path.split("/") if p]
        query = {k: v[0] for k, v in parse_qs(url.query).items()}
        if parts[:1] == ["control"]:
            return self.control(parts[1:], query)
        if len(parts) == 4 and parts[:3] == ["releases", "latest", "download"]:
            name = parts[3]
            return self.redirect(f"/releases/download/v{STATE.version(name)}/{name}")
        if len(parts) == 4 and parts[:2] == ["releases", "download"] and parts[2].startswith("v"):
            token = str(int(time.time() * 1000))
            return self.redirect(f"/cdn/{token}/{parts[2]}/{parts[3]}")
        if len(parts) == 4 and parts[0] == "cdn":
            age = time.time() - int(parts[1]) / 1000.0
            if age > STATE.token_ttl:
                STATE.count("expired_tokens")
                return self.text(403, "token expired")
            return self.serve(parts[3], int(parts[2][1:]), chaos=True)
        if len(parts) == 2 and parts[0] == "plain":
            return self.serve(parts[1], STATE.version(parts[1]), chaos=False)
        if len(parts) == 2 and parts[0] == "never":
            return self.serve(parts[1], STATE.version(parts[1]), chaos=False, force_fault="drop")
        if len(parts) == 2 and parts[0] == "stall":
            return self.serve(parts[1], STATE.version(parts[1]), chaos=False, force_fault="stall")
        return self.text(404, "not found")

    def control(self, parts, query):
        if parts == ["ping"]:
            return self.text(200, "ok")
        if parts == ["reset"]:
            STATE.reset(**query)
            return self.json({"ok": True, "chaos": STATE.chaos, "bandwidth": STATE.bandwidth})
        if len(parts) == 2 and parts[0] == "swap":
            return self.json({"version": STATE.swap(parts[1])})
        if len(parts) == 2 and parts[0] == "version":
            return self.json({"version": STATE.version(parts[1])})
        if parts == ["stats"]:
            with STATE.lock:
                return self.json(dict(STATE.stats))
        return self.text(404, "unknown control")

    def redirect(self, location):
        self.send_response(302)
        self.send_header("Location", location)
        self.send_header("Content-Length", "0")
        self.send_header("Connection", "close")
        self.end_headers()

    def text(self, status, body):
        data = body.encode()
        self.send_response(status)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(data)

    def json(self, obj):
        self.text(200, json.dumps(obj))

    def serve(self, name, version, chaos, force_fault=None):
        data = STATE.asset(name, version)
        if data is None:
            return self.text(404, "unknown asset")
        STATE.count("requests")
        fault, frac = STATE.roll_fault() if chaos else (None, 0.0)
        if force_fault:
            fault = force_fault  # forced faults deliver no body bytes at all
        if fault == "err":
            STATE.count("errors")
            return self.text(503, "service unavailable")
        etag = f'"{name}-v{version}"'
        total = len(data)
        start = 0
        partial = False
        range_header = self.headers.get("Range")
        if range_header and fault == "ignore_range":
            STATE.count("ignored_ranges")
        elif range_header:
            m = re.match(r"bytes=(\d+)-(\d*)$", range_header)
            if_range = self.headers.get("If-Range")
            if m and (if_range is None or if_range == etag):
                start = int(m.group(1))
                if start >= total:
                    self.send_response(416)
                    self.send_header("Content-Range", f"bytes */{total}")
                    self.send_header("Content-Length", "0")
                    self.send_header("Connection", "close")
                    self.end_headers()
                    return
                partial = True
        body = data[start:]
        self.send_response(206 if partial else 200)
        self.send_header("Content-Type", "application/octet-stream")
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("ETag", etag)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Connection", "close")
        if partial:
            self.send_header("Content-Range", f"bytes {start}-{total - 1}/{total}")
        self.end_headers()
        cut = int(len(body) * frac) if fault in ("drop", "stall") else None
        self.stream(body if cut is None else body[:cut])
        if fault == "drop":
            STATE.count("drops")
            self.abort()
        elif fault == "stall":
            STATE.count("stalls")
            time.sleep(STATE.stall_seconds)
            self.abort()

    def stream(self, body):
        offset = 0
        while offset < len(body):
            chunk = body[offset : offset + CHUNK]
            self.wfile.write(chunk)
            self.wfile.flush()
            offset += len(chunk)
            if STATE.bandwidth > 0:
                time.sleep(len(chunk) / STATE.bandwidth)

    def abort(self):
        self.close_connection = True
        try:
            self.connection.shutdown(socket.SHUT_RDWR)
        except OSError:
            pass


def main():
    global STATE, VERBOSE
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--seed", type=int, default=1)
    parser.add_argument("--token-ttl", type=float, default=3600.0)
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()
    VERBOSE = args.verbose
    STATE = State(args.seed, args.token_ttl)
    ThreadingHTTPServer.allow_reuse_address = True
    ThreadingHTTPServer.daemon_threads = True
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"chaos server listening on http://127.0.0.1:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
