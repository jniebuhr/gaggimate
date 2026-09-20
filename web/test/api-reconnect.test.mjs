// Run: node --experimental-vm-modules --test web/test/api-reconnect.test.mjs
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

test('connecting stays exclusive; stale socket events cannot close or reschedule its replacement', async () => {
  const sockets = [];
  const timers = new Map();
  let nextTimer = 0;
  class Socket {
    static OPEN = 1;
    readyState = 0;
    listeners = {};
    constructor() {
      sockets.push(this);
    }
    addEventListener(type, fn) {
      this.listeners[type] = fn;
    }
    close() {
      this.readyState = 3;
    }
    emit(type) {
      this.listeners[type]?.({ currentTarget: this });
    }
  }
  const context = vm.createContext({
    WebSocket: Socket,
    console: { log() {}, error() {} },
    window: { location: { host: 'machine.test', protocol: 'http:' } },
    setTimeout: fn => {
      timers.set(++nextTimer, fn);
      return nextTimer;
    },
    clearTimeout: id => timers.delete(id),
  });
  const source = await readFile(new URL('../src/services/ApiService.js', import.meta.url), 'utf8');
  const module = new vm.SourceTextModule(source, { context });
  await module.link(specifier => {
    const exports =
      specifier === 'preact'
        ? { createContext: () => ({}) }
        : specifier === '@preact/signals'
          ? { signal: value => ({ value }) }
          : specifier.includes('warnings')
            ? { parseWarningStates: value => value }
            : { default: () => 'test-id' };
    return new vm.SyntheticModule(
      Object.keys(exports),
      function () {
        for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
      },
      { context },
    );
  });
  await module.evaluate();
  const api = new module.namespace.default();
  await api.connect();
  await api.connect();
  assert.equal(sockets.length, 1);
  sockets[0].readyState = 1;
  sockets[0].emit('open');
  await api.connect();
  assert.equal(sockets.length, 1);
  sockets[0].close();
  sockets[0].emit('close');
  assert.equal(timers.size, 1);
  const retry = [...timers.values()][0];
  timers.clear();
  retry();
  assert.equal(sockets.length, 2);
  sockets[1].readyState = 1;
  sockets[1].emit('open');
  sockets[0].emit('close');
  sockets[0].emit('error');
  assert.equal(timers.size, 0);
  assert.equal(sockets[1].readyState, 1);
  assert.equal(module.namespace.machine.value.connected, true);
});
