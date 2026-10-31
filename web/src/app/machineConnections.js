import { useEffect, useState } from 'preact/hooks';
import ApiService, { createMachineState } from '../services/ApiService.js';
import { activeMachineId } from './machines.js';

// One shared, ref-counted live connection per non-active machine (notifications + setup screen).
const connections = new Map();
let suspended = false;

export function acquireConnection(machine) {
  let entry = connections.get(machine.host);
  if (!entry) {
    const state = createMachineState();
    const api = new ApiService({ socketUrl: `ws://${machine.host}/ws`, state });
    if (suspended) api.close();
    entry = { api, refs: 0 };
    connections.set(machine.host, entry);
  }
  entry.refs++;
  let released = false;
  return {
    api: entry.api,
    release() {
      if (released) return;
      released = true;
      if (--entry.refs > 0) return;
      entry.api.close();
      connections.delete(machine.host);
    },
  };
}

// Frees the machines' websocket slots while the app is in the background.
export function suspendConnections() {
  suspended = true;
  connections.forEach(({ api }) => api.close());
}

export function resumeConnections() {
  suspended = false;
  connections.forEach(({ api }) => api.reopen());
}

// Live state signals of the non-active saved machines, by id, held only while enabled.
export function useMachinePeeks(saved, enabled = true) {
  const [states, setStates] = useState({});
  const key = enabled ? saved.map(m => `${m.id}@${m.host}`).join(',') : '';

  useEffect(() => {
    if (!key) {
      setStates({});
      return undefined;
    }
    const peeks = saved
      .filter(m => m.id !== activeMachineId.value)
      .map(m => ({ id: m.id, connection: acquireConnection(m) }));
    setStates(Object.fromEntries(peeks.map(p => [p.id, p.connection.api.state])));
    return () => peeks.forEach(p => p.connection.release());
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return states;
}
