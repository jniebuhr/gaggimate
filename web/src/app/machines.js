import { computed, signal } from '@preact/signals';
import { t } from '@lingui/core/macro';
import { isApp } from './platform.js';

// Saved machines for the native app; the web UI served by a machine always talks to its own origin.
const STORAGE_KEY = 'gaggimate.machines';
const PROBE_TIMEOUT_MS = 5000;
const VERSION_TIMEOUT_MS = 3000;

// PURE annotations let the firmware (non-app) build drop this module entirely.
export const machines = /* @__PURE__ */ signal([]);
export const activeMachineId = /* @__PURE__ */ signal(null);
export const activeMachine = /* @__PURE__ */ computed(
  () => machines.value.find(m => m.id === activeMachineId.value) ?? null,
);
// Opens the setup screen on top of the app (adding a machine while one is connected).
export const showMachineSetup = /* @__PURE__ */ signal(false);

// Never return the Preferences plugin from an async function: resolving it calls the proxy's nonexistent then().
export async function loadMachines() {
  if (!isApp) return;
  const { Preferences } = await import('@capacitor/preferences');
  const { value } = await Preferences.get({ key: STORAGE_KEY });
  try {
    const stored = JSON.parse(value ?? 'null');
    machines.value = Array.isArray(stored?.machines) ? stored.machines : [];
    activeMachineId.value = stored?.activeId ?? null;
  } catch {
    machines.value = [];
    activeMachineId.value = null;
  }
}

// Persists the new state, then reloads so the UI only ever reflects what's actually stored.
async function commit(nextMachines, nextActiveId) {
  const { Preferences } = await import('@capacitor/preferences');
  await Preferences.set({
    key: STORAGE_KEY,
    value: JSON.stringify({ machines: nextMachines, activeId: nextActiveId }),
  });
  machines.value = nextMachines;
  activeMachineId.value = nextActiveId;
}

// Reloading drops every cache and signal that belonged to the previous machine.
const restartUi = () => window.location.assign('/');

// Accepts "gaggimate.local", "192.168.1.20:8080" or a pasted URL and returns "host[:port]".
export function normalizeHost(input) {
  const trimmed = input.trim();
  if (!trimmed) return '';
  try {
    return new URL(
      /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`,
    ).host.toLowerCase();
  } catch {
    return '';
  }
}

// Resolves with the machine's settings and firmware version once both the HTTP API and the live WebSocket answer.
export async function probeMachine(host) {
  const settings = await probeHttp(host);
  const version = await probeSocket(host);
  return { settings, version };
}

async function probeHttp(host) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(`http://${host}/api/settings`, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const settings = await response.json();
    if (typeof settings !== 'object' || settings === null || !('mdnsName' in settings)) {
      throw new Error(t`this address is not a GaggiMate`);
    }
    return settings;
  } catch (err) {
    throw new Error(
      err?.name === 'AbortError' ? t`no answer (timed out)` : err?.message || String(err),
    );
  } finally {
    clearTimeout(timeout);
  }
}

function probeSocket(host) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://${host}/ws`);
    const fail = reason => {
      clearTimeout(timeout);
      socket.onopen = socket.onclose = socket.onerror = null;
      socket.close();
      reject(new Error(t`live connection failed (${reason})`));
    };
    const timeout = setTimeout(
      () => fail(t({ message: 'timed out', context: 'connection failure' })),
      PROBE_TIMEOUT_MS,
    );
    const done = version => {
      clearTimeout(versionTimeout);
      socket.onmessage = socket.onclose = socket.onerror = null;
      socket.close();
      resolve(version);
    };
    let versionTimeout;
    // Connected; also ask for the firmware version (read-only), but don't fail if it never answers.
    socket.onopen = () => {
      clearTimeout(timeout);
      socket.onclose = socket.onerror = null;
      versionTimeout = setTimeout(() => done(null), VERSION_TIMEOUT_MS);
      socket.onmessage = event => {
        try {
          const message = JSON.parse(event.data);
          if (message.tp === 'res:ota-settings') done(message.displayVersion ?? null);
        } catch {
          // Ignore unrelated or malformed frames.
        }
      };
      socket.send(JSON.stringify({ tp: 'req:ota-settings' }));
    };
    socket.onerror = () => fail(t({ message: 'error', context: 'connection failure' }));
    socket.onclose = event => {
      const code = event.code;
      fail(t`closed, code ${code}`);
    };
  });
}

export async function addMachine({ host, name, version = null }) {
  const existing = machines.value.find(m => m.host === host);
  const id = existing?.id ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const machine = { id, host, name: name || host, version: version ?? existing?.version ?? null };
  const next = existing
    ? machines.value.map(m => (m.id === id ? machine : m))
    : [...machines.value, machine];
  await commit(next, id);
  restartUi();
}

export async function selectMachine(id) {
  // Picking the machine that's already active just returns to it.
  if (id === activeMachineId.value) {
    showMachineSetup.value = false;
    return;
  }
  await commit(machines.value, id);
  restartUi();
}

export async function renameMachine(id, name) {
  const trimmed = name.trim();
  if (!trimmed) return;
  await commit(
    machines.value.map(m => (m.id === id ? { ...m, name: trimmed } : m)),
    activeMachineId.value,
  );
}

// Remembers a machine's firmware version so the selector can warn about outdated machines.
export async function updateMachineVersion(id, version) {
  const current = machines.value.find(m => m.id === id);
  if (!current || !version || current.version === version) return;
  await commit(
    machines.value.map(m => (m.id === id ? { ...m, version } : m)),
    activeMachineId.value,
  );
}

export async function removeMachine(id) {
  const wasActive = id === activeMachineId.value;
  await commit(
    machines.value.filter(m => m.id !== id),
    wasActive ? null : activeMachineId.value,
  );
  if (wasActive) restartUi();
}

export async function disconnectMachine() {
  await commit(machines.value, null);
  restartUi();
}

// WebSocket URL of the active machine, or null while none is selected.
export function machineSocketUrl() {
  const host = activeMachine.value?.host;
  return host ? `ws://${host}/ws` : null;
}

// Routes same-origin "/api/..." requests (fetch and form actions) to the active machine in the app.
export function installMachineApiRewrite() {
  if (!isApp) return;
  const baseFetch = window.fetch;
  const rewrite = url => {
    const host = activeMachine.value?.host;
    const resolved = new URL(url, window.location.href);
    if (
      !host ||
      resolved.origin !== window.location.origin ||
      !resolved.pathname.startsWith('/api/')
    ) {
      return null;
    }
    return `http://${host}${resolved.pathname}${resolved.search}`;
  };
  window.fetch = (resource, options) => {
    if (resource instanceof Request) {
      const target = rewrite(resource.url);
      return baseFetch(target ? new Request(target, resource) : resource, options);
    }
    return baseFetch(rewrite(String(resource)) ?? resource, options);
  };
}
