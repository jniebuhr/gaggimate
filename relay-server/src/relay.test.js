import assert from 'node:assert/strict';
import test from 'node:test';

import worker from './index.js';
import { RelaySession } from './relay.js';

const OPEN = globalThis.WebSocket?.OPEN ?? 1;
const CLOSED = globalThis.WebSocket?.CLOSED ?? 3;

class FakeSocket {
  constructor() {
    this.readyState = OPEN;
    this.sent = [];
    this.closeEvents = [];
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  send(data) {
    this.sent.push(data);
  }

  close(code, reason) {
    this.readyState = CLOSED;
    this.closeEvents.push({ code, reason });
    this.emit('close', {});
  }

  emit(type, event) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

function createRelayEnv() {
  const fetchCalls = [];
  const stubs = new Map();

  return {
    fetchCalls,
    env: {
      RELAY: {
        idFromName(name) {
          return `id:${name}`;
        },
        get(id) {
          if (!stubs.has(id)) {
            stubs.set(id, {
              fetch(request) {
                fetchCalls.push({ id, url: request.url });
                return new Response(id, { status: 209 });
              },
            });
          }
          return stubs.get(id);
        },
      },
    },
  };
}

test('worker rejects connect requests without a valid token and role', async () => {
  const missingToken = await worker.fetch(
    new Request('https://relay.example/connect?role=device'),
    createRelayEnv().env,
  );
  const invalidRole = await worker.fetch(
    new Request('https://relay.example/connect?token=abc&role=admin'),
    createRelayEnv().env,
  );

  assert.equal(missingToken.status, 400);
  assert.equal(invalidRole.status, 400);
});

test('worker routes each token to an isolated Durable Object instance', async () => {
  const { env, fetchCalls } = createRelayEnv();

  const alphaDevice = await worker.fetch(
    new Request('https://relay.example/connect?token=alpha&role=device'),
    env,
  );
  const alphaBrowser = await worker.fetch(
    new Request('https://relay.example/connect?token=alpha&role=browser'),
    env,
  );
  const betaDevice = await worker.fetch(
    new Request('https://relay.example/connect?token=beta&role=device'),
    env,
  );

  assert.equal(await alphaDevice.text(), 'id:alpha');
  assert.equal(await alphaBrowser.text(), 'id:alpha');
  assert.equal(await betaDevice.text(), 'id:beta');
  assert.deepEqual(
    fetchCalls.map(call => call.id),
    ['id:alpha', 'id:alpha', 'id:beta'],
  );
});

test('relay forwards device messages to all browsers for the same session', () => {
  const session = new RelaySession({});
  const browserA = new FakeSocket();
  const browserB = new FakeSocket();
  const device = new FakeSocket();

  session._handleBrowser(browserA);
  session._handleBrowser(browserB);
  session._handleDevice(device);
  device.emit('message', { data: 'status-update' });

  assert.deepEqual(JSON.parse(browserA.sent[0]), {
    tp: 'evt:relay-status',
    deviceConnected: false,
  });
  assert.deepEqual(JSON.parse(browserA.sent[1]), {
    tp: 'evt:relay-status',
    deviceConnected: true,
  });
  assert.equal(browserA.sent[2], 'status-update');
  assert.equal(browserB.sent[2], 'status-update');
});

test('relay forwards browser messages to the connected device', () => {
  const session = new RelaySession({});
  const browser = new FakeSocket();
  const device = new FakeSocket();

  session._handleDevice(device);
  session._handleBrowser(browser);
  browser.emit('message', { data: 'brew-command' });

  assert.equal(device.sent[0], 'brew-command');
});

test('relay replaces an existing device connection and reports offline on close', () => {
  const session = new RelaySession({});
  const browser = new FakeSocket();
  const firstDevice = new FakeSocket();
  const secondDevice = new FakeSocket();

  session._handleBrowser(browser);
  session._handleDevice(firstDevice);
  session._handleDevice(secondDevice);
  secondDevice.close(1000, 'done');

  assert.deepEqual(firstDevice.closeEvents, [
    { code: 1000, reason: 'Replaced by new device connection' },
  ]);
  assert.deepEqual(JSON.parse(browser.sent.at(-1)), {
    tp: 'evt:relay-status',
    deviceConnected: false,
  });
});
