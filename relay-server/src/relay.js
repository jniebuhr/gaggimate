'use strict';

// RelaySession — Durable Object, one instance per relay token.
// Holds the device WebSocket and all connected browser WebSockets for that token.
export class RelaySession {
  constructor(state) {
    this.state = state;
    this.device = null;
    this.browsers = new Set();
  }

  async fetch(request) {
    const upgrade = request.headers.get('Upgrade');
    if (!upgrade || upgrade.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    const url = new URL(request.url);
    const role = url.searchParams.get('role');

    const { 0: client, 1: server } = new WebSocketPair();
    server.accept();

    if (role === 'device') {
      this._handleDevice(server);
    } else {
      this._handleBrowser(server);
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  _handleDevice(ws) {
    // Replace any existing device connection
    if (this.device && this.device.readyState === WebSocket.OPEN) {
      this.device.close(1000, 'Replaced by new device connection');
    }
    this.device = ws;

    // Notify all connected browsers that the device is online
    const onlineMsg = JSON.stringify({ tp: 'evt:relay-status', deviceConnected: true });
    for (const browser of this.browsers) {
      if (browser.readyState === WebSocket.OPEN) browser.send(onlineMsg);
    }

    ws.addEventListener('message', ({ data }) => {
      for (const browser of this.browsers) {
        if (browser.readyState === WebSocket.OPEN) browser.send(data);
      }
    });

    ws.addEventListener('close', () => {
      if (this.device === ws) this.device = null;
      const offlineMsg = JSON.stringify({ tp: 'evt:relay-status', deviceConnected: false });
      for (const browser of this.browsers) {
        if (browser.readyState === WebSocket.OPEN) browser.send(offlineMsg);
      }
    });

    ws.addEventListener('error', () => {
      if (this.device === ws) this.device = null;
    });
  }

  _handleBrowser(ws) {
    this.browsers.add(ws);

    // Tell the browser immediately whether the device is currently connected
    const statusMsg = JSON.stringify({
      tp: 'evt:relay-status',
      deviceConnected: !!(this.device && this.device.readyState === WebSocket.OPEN),
    });
    ws.send(statusMsg);

    ws.addEventListener('message', ({ data }) => {
      if (this.device && this.device.readyState === WebSocket.OPEN) {
        this.device.send(data);
      }
    });

    ws.addEventListener('close', () => {
      this.browsers.delete(ws);
    });

    ws.addEventListener('error', () => {
      this.browsers.delete(ws);
    });
  }
}
