import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { beforeEach, mock } from 'node:test';

// ApiService's Vite-only imports (?raw assets, import.meta.env, Lingui macros) are stubbed for plain Node.
const stubs = {
  '/utils/warnings.js': 'export const parseWarningStates = () => ({});',
  '/app/platform.js': "export const isApp = false; export const nativePlatform = () => 'web';",
  '/app/machines.js': 'export const machineSocketUrl = () => null;',
};
registerHooks({
  resolve(specifier, context, next) {
    const stub = Object.keys(stubs).find(suffix => specifier.endsWith(suffix));
    if (stub)
      return { url: `data:text/javascript,${encodeURIComponent(stubs[stub])}`, shortCircuit: true };
    return next(specifier, context);
  },
});

class FakeWebSocket {
  static OPEN = 1;
  static instances = [];
  listeners = {};
  readyState = 0;
  constructor(url) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }
  addEventListener(type, listener) {
    (this.listeners[type] ??= []).push(listener);
  }
  // Like the browser, close() only queues the close event; the test delivers it with fire().
  close() {
    this.readyState = 3;
  }
  fire(type, event = {}) {
    if (type === 'open') this.readyState = FakeWebSocket.OPEN;
    for (const listener of this.listeners[type] ?? []) listener(event);
  }
}
globalThis.WebSocket = FakeWebSocket;
globalThis.window = { location: { protocol: 'http:', host: 'localhost' } };

const { default: ApiService, createMachineState } = await import('../src/services/ApiService.js');

let api;
beforeEach(() => {
  mock.timers.reset();
  mock.timers.enable({ apis: ['setTimeout'] });
  mock.method(console, 'log', () => {});
  FakeWebSocket.instances = [];
  api = new ApiService({ socketUrl: 'ws://machine/ws', state: createMachineState() });
});

const sockets = () => FakeWebSocket.instances;
const connected = () => api.state.value.connected;

test('a close queued before a background suspend does not start a reconnect loop on resume', () => {
  api.connect();
  sockets()[0].fire('open');
  api.close();
  assert.equal(connected(), false);

  api.reopen();
  sockets()[1].fire('open');
  sockets()[0].fire('close');

  assert.equal(connected(), true);
  mock.timers.tick(60_000);
  assert.equal(sockets().length, 2, 'no further sockets were opened');
});

test('a replaced socket closing late leaves the new connection alone', () => {
  api.connect();
  sockets()[0].fire('open');
  api.connect();
  sockets()[1].fire('open');
  sockets()[0].fire('close');

  assert.equal(connected(), true);
  mock.timers.tick(60_000);
  assert.equal(sockets().length, 2);
});

test('stale messages and errors from a replaced socket are ignored', () => {
  api.connect();
  api.connect();
  sockets()[1].fire('open');
  sockets()[0].fire('error');
  assert.equal(sockets()[1].readyState, FakeWebSocket.OPEN, 'the current socket was not closed');
});

test('losing the current connection still reconnects with backoff', () => {
  api.connect();
  sockets()[0].fire('open');
  sockets()[0].fire('close');
  assert.equal(connected(), false);

  mock.timers.tick(999);
  assert.equal(sockets().length, 1);
  mock.timers.tick(1);
  assert.equal(sockets().length, 2);

  sockets()[1].fire('close');
  mock.timers.tick(1_999);
  assert.equal(sockets().length, 2, 'second attempt waits 2 s');
  mock.timers.tick(1);
  assert.equal(sockets().length, 3);
});

test('close() marks the machine disconnected and schedules nothing', () => {
  api.connect();
  sockets()[0].fire('open');
  api.close();
  sockets()[0].fire('close');

  assert.equal(connected(), false);
  mock.timers.tick(60_000);
  assert.equal(sockets().length, 1);
});
