import { createContext } from 'preact';
import { parseWarningStates } from '../utils/warnings.js';
import { signal } from '@preact/signals';
import uuidv4 from '../utils/uuid.js';

function randomId() {
  return Math.random()
    .toString(36)
    .replace(/[^a-z]+/g, '')
    .substr(2, 10);
}

export default class ApiService {
  socket = null;
  listeners = {};
  reconnectAttempts = 0;
  maxReconnectDelay = 30000; // Maximum delay of 30 seconds
  baseReconnectDelay = 1000; // Start with 1 second delay
  reconnectTimeout = null;
  isConnecting = false;

  constructor() {
    console.log('Established websocket connection');
    this.connect();
  }

  async connect() {
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      if (this.socket) {
        this.socket.close();
      }

      const apiHost = window.location.host;
      const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
      this.socket = new WebSocket(`${wsProtocol}${apiHost}/ws`);

      this.socket.addEventListener('message', this._onMessage.bind(this));
      this.socket.addEventListener('close', this._onClose.bind(this));
      this.socket.addEventListener('error', this._onError.bind(this));
      this.socket.addEventListener('open', this._onOpen.bind(this));
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this._scheduleReconnect();
    } finally {
      this.isConnecting = false;
    }
  }

  _onOpen() {
    console.log('WebSocket connected successfully');
    this.reconnectAttempts = 0;
    machine.value = {
      ...machine.value,
      connected: true,
    };
  }

  _onClose() {
    console.log('WebSocket connection closed');
    machine.value = {
      ...machine.value,
      connected: false,
    };
    this._scheduleReconnect();
  }

  _onError(error) {
    console.error('WebSocket error:', error);
    if (this.socket) {
      this.socket.close();
    }
  }

  _scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay,
    );

    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts + 1} in ${delay}ms`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  _onMessage(event) {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return; // Discard malformed messages to avoid crashing the WS handler.
    }
    const listeners = Object.values(this.listeners[message.tp] || {});
    if (message.tp === 'evt:status') {
      this._onStatus(message);
    }
    for (const listener of listeners) {
      listener(message);
    }
  }

  send(event) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(event));
    } else {
      throw new Error('WebSocket is not connected');
    }
  }

  async request(data = {}) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    const returnType = `res:${data.tp.substring(4)}`;
    const rid = uuidv4();
    const message = { ...data, rid };
    return new Promise((resolve, reject) => {
      let timeoutId;

      // Create a listener for the response with matching rid
      const listenerId = this.on(returnType, response => {
        if (response.rid === rid) {
          // Clean up the listener and cancel the timeout to free the closure.
          clearTimeout(timeoutId);
          this.off(returnType, listenerId);
          resolve(response);
        }
      });

      // Send the request
      this.send(message);

      // Timeout: reject if no matching response arrives within 30 seconds
      timeoutId = setTimeout(() => {
        this.off(returnType, listenerId);
        reject(new Error(`Request ${data.tp} timed out`));
      }, 30000); // 30 second timeout
    });
  }

  on(type, listener) {
    const id = randomId();
    if (!this.listeners[type]) {
      this.listeners[type] = {};
    }
    this.listeners[type][id] = listener;
    return id;
  }

  off(type, id) {
    delete this.listeners[type][id];
  }

  // evt:status frames are partial: fast telemetry every tick, slow state only when it changes
  // (plus a full snapshot on connect and every 10 s). Merge onto the last known status.
  _onStatus(message) {
    const has = key => Object.prototype.hasOwnProperty.call(message, key);
    const status = { ...machine.value.status };
    const map = (key, name, convert = v => v) => {
      if (has(key)) status[name] = convert(message[key]);
    };
    map('ct', 'currentTemperature');
    map('tt', 'targetTemperature');
    map('pr', 'currentPressure');
    map('pt', 'targetPressure');
    map('tw', 'targetWeight', v => v || 0);
    map('fl', 'currentFlow');
    map('tf', 'targetFlow', v => v || 0);
    map('m', 'mode');
    map('p', 'selectedProfile');
    map('puid', 'selectedProfileId');
    map('bt', 'brewTarget', v => !!v);
    map('btd', 'brewTargetDuration', v => v || 0);
    map('bta', 'volumetricAvailable', v => v || false);
    map('gtd', 'grindTargetDuration', v => v || 0);
    map('gtv', 'grindTargetVolume', v => v || 0);
    map('gt', 'grindTarget', v => v || 0);
    map('gact', 'grindActive', v => v || false);
    map('cw', 'currentWeight', v => v || 0);
    map('bc', 'bluetoothConnected', v => v || false);
    map('sbat', 'scaleBattery', v => v ?? null);
    map('process', 'process', v => v || null);
    map('rssi', 'rssi', v => v || 0);
    map('lat', 'lat', v => v || 0);
    map('tof', 'tofDistance', v => v || 0);
    map('pw', 'currentPumpPower', v => v ?? 0);
    map('hp', 'currentBoilerPower', v => v ?? 0);
    map('pkr', 'currentPuckResistance', v => v ?? 0);
    map('pf', 'currentPuckFlow', v => v ?? 0);
    map('cv', 'currentCoffeeVolume', v => v ?? 0);
    map('up', 'update', v => !!v);
    map('warn', 'warnings', parseWarningStates);
    status.activeTargetWeight = (status.process?.a && status.targetWeight) || 0;
    status.timestamp = new Date();

    const capabilities = { ...machine.value.capabilities };
    if (has('cd')) capabilities.dimming = message.cd;
    if (has('cp')) capabilities.pressure = message.cp;
    if (has('led')) capabilities.ledControl = message.led;
    if (has('gp')) capabilities.gearpumpAddon = !!message.gp;

    // Only telemetry frames extend the chart history; state-only frames would duplicate points.
    let history = machine.value.history;
    if (has('ct')) {
      const historyEntry = { ...status };
      delete historyEntry.process;
      delete historyEntry.warnings;
      history = [...history, historyEntry].slice(-600);
    }

    machine.value = { ...machine.value, connected: true, status, capabilities, history };
  }
}

export const ApiServiceContext = createContext(null);

export const machine = signal({
  connected: false,
  status: {
    currentTemperature: 0,
    targetTemperature: 0,
    currentFlow: 0,
    targetFlow: 0,
    mode: 0,
    selectedProfile: '',
    selectedProfileId: null,
    brewTargetDuration: 0,
    brewTargetVolume: 0,
    grindTargetDuration: 0,
    grindTargetVolume: 0,
    grindTarget: 0,
    grindActive: false,
    process: null,
    update: false,
    warnings: [],
  },
  capabilities: {
    pressure: false,
    dimming: false,
  },
  history: [],
});

let settingsCache = null;
let settingsData = null;

export const prefetchSettings = () => {
  if (!settingsCache) {
    settingsCache = fetch('/api/settings')
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        settingsData = data;
        return data;
      })
      .catch(err => {
        settingsCache = null;
        throw err;
      });
  }
  return settingsCache;
};

export const getCachedSettings = () => settingsData;

export const updateSettingsCache = data => {
  settingsData = data;
  settingsCache = Promise.resolve(data);
};

export const invalidateSettingsCache = () => {
  settingsData = null;
  settingsCache = null;
};
