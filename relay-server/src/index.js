'use strict';

export { RelaySession } from './relay.js';

const HTML = `<!DOCTYPE html>
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
  const wsBase = window.location.origin.replace(/^http/, 'ws');
  localStorage.setItem('gaggimate_relay_url', wsBase);
  localStorage.setItem('gaggimate_relay_token', token);
  const dest = uiUrl || (window.location.origin + '?relay=' + encodeURIComponent(wsBase) + '&token=' + encodeURIComponent(token));
  window.location.href = dest;
}
</script>
</body></html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response('ok', { headers: { 'Content-Type': 'text/plain' } });
    }

    if (url.pathname === '/connect') {
      const token = url.searchParams.get('token');
      const role = url.searchParams.get('role');

      if (!token || (role !== 'device' && role !== 'browser')) {
        return new Response('Missing token or invalid role', { status: 400 });
      }

      // Route to the Durable Object for this token — one DO instance per token
      // ensures device and browsers for the same token always end up in the same isolate
      const id = env.RELAY.idFromName(token);
      const stub = env.RELAY.get(id);
      return stub.fetch(request);
    }

    if (url.pathname === '/') {
      return new Response(HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    return new Response('Not Found', { status: 404 });
  },
};
