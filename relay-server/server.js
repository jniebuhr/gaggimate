'use strict';

const { WebSocketServer, WebSocket } = require('ws');
const http = require('http');

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>GaggiMate Relay</title>
<style>body{font-family:sans-serif;max-width:480px;margin:80px auto;padding:0 16px}
input{width:100%;padding:8px;margin:8px 0;box-sizing:border-box;border:1px solid #ccc;border-radius:4px}
button{padding:10px 24px;background:#1a1a1a;color:#fff;border:none;border-radius:4px;cursor:pointer}
.note{color:#666;font-size:0.85em}</style>
</head>
<body>
<h1>GaggiMate Relay</h1>
<p>Enter your token to connect to your machine:</p>
<input type="password" id="token" placeholder="Relay token" />
<br/>
<input type="url" id="uiUrl" placeholder="Web UI URL (e.g. http://gaggimate.local)" />
<br/>
<button onclick="connect()">Connect</button>
<p class="note">The Web UI URL is where your GaggiMate web interface is accessible.</p>
<script>
function connect() {
  const token = document.getElementById('token').value.trim();
  const uiUrl = document.getElementById('uiUrl').value.trim();
  if (!token) { alert('Enter a token'); return; }
  if (!uiUrl) { alert('Enter the Web UI URL'); return; }
  const wsBase = window.location.origin.replace(/^http/, 'ws');
  let dest;
  try {
    dest = new URL(uiUrl);
  } catch {
    alert('Enter a valid Web UI URL');
    return;
  }
  dest.searchParams.set('relay', wsBase);
  dest.searchParams.set('token', token);
  window.location.href = dest.toString();
}
</script>
</body></html>`);
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server, path: '/connect' });

// Map: token → { device: WebSocket | null, browsers: Set<WebSocket> }
const sessions = new Map();

function getSession(token) {
  if (!sessions.has(token)) {
    sessions.set(token, { device: null, browsers: new Set() });
  }
  return sessions.get(token);
}

function cleanupSession(token) {
  const session = sessions.get(token);
  if (session && !session.device && session.browsers.size === 0) {
    sessions.delete(token);
  }
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const token = url.searchParams.get('token');
  const role = url.searchParams.get('role');

  if (!token || (role !== 'device' && role !== 'browser')) {
    ws.close(1008, 'Missing token or invalid role');
    return;
  }

  const session = getSession(token);
  const shortToken = token.substring(0, 8) + '...';

  if (role === 'device') {
    if (session.device && session.device.readyState === WebSocket.OPEN) {
      session.device.close(1000, 'Replaced by new device connection');
    }
    session.device = ws;
    console.log(`[${new Date().toISOString()}] Device connected [${shortToken}]`);

    // Notify browsers that device is online
    const onlineMsg = JSON.stringify({ tp: 'evt:relay-status', deviceConnected: true });
    for (const browser of session.browsers) {
      if (browser.readyState === WebSocket.OPEN) browser.send(onlineMsg);
    }

    ws.on('message', (data) => {
      for (const browser of session.browsers) {
        if (browser.readyState === WebSocket.OPEN) browser.send(data);
      }
    });

    ws.on('close', () => {
      console.log(`[${new Date().toISOString()}] Device disconnected [${shortToken}]`);
      session.device = null;
      const offlineMsg = JSON.stringify({ tp: 'evt:relay-status', deviceConnected: false });
      for (const browser of session.browsers) {
        if (browser.readyState === WebSocket.OPEN) browser.send(offlineMsg);
      }
      cleanupSession(token);
    });

    ws.on('error', (err) => console.error(`Device WS error [${shortToken}]:`, err.message));

  } else {
    session.browsers.add(ws);
    console.log(`[${new Date().toISOString()}] Browser connected [${shortToken}] (${session.browsers.size} total)`);

    // Tell browser the current device status
    const statusMsg = JSON.stringify({
      tp: 'evt:relay-status',
      deviceConnected: !!(session.device && session.device.readyState === WebSocket.OPEN),
    });
    ws.send(statusMsg);

    ws.on('message', (data) => {
      if (session.device && session.device.readyState === WebSocket.OPEN) {
        session.device.send(data);
      }
    });

    ws.on('close', () => {
      session.browsers.delete(ws);
      console.log(`[${new Date().toISOString()}] Browser disconnected [${shortToken}] (${session.browsers.size} remaining)`);
      cleanupSession(token);
    });

    ws.on('error', (err) => console.error(`Browser WS error [${shortToken}]:`, err.message));
  }
});

server.listen(PORT, () => {
  console.log(`GaggiMate relay server listening on port ${PORT}`);
});
