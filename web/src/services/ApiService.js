import { createContext } from 'preact';
import { signal } from '@preact/signals';
import uuidv4 from '../utils/uuid.js';

function randomId() {
  return Math.random().toString(36).replace(/[^a-z]+/g, '').substr(2, 10);
}

export default class ApiService {
  socket = null;
  listeners = {};

  constructor() {
    console.log("Established websocket connection");
    this.connect();
  }

  connect() {
    const apiHost = window.location.host;
    this.socket = new WebSocket(((window.location.protocol === "https:") ? "wss://" : "ws://") + apiHost + "/ws");
    this.socket.addEventListener("message", (e) => { this._onMessage(e); });
    this.socket.addEventListener("close", () => {
      setTimeout(() => {
        this.connect();
      }, 1000);
    });
    this.socket.addEventListener("error", () => {
      this.socket.close();
      setTimeout(() => {
        this.connect();
      }, 1000);
    });
  }

  _onMessage(event) {
    const message = JSON.parse(event.data);
    const listeners = Object.values(this.listeners[message.tp] || {});
    if (message.tp === 'evt:status') {
      this._onStatus(message);
    }
    for (const listener of listeners) {
      listener(message);
    }
  }

  send(event) {
    this.socket.send(JSON.stringify(event));
  }

  async request(data = {}) {
    const returnType = 'res:' + data.tp.substring(4);
    const rid = uuidv4();
    const message = { ...data, rid };
    return new Promise((resolve, reject) => {

      // Create a listener for the response with matching rid
      const listenerId = this.on(returnType, (response) => {
        if (response.rid === rid) {
          // Clean up the listener
          this.off(returnType, listenerId);
          resolve(response);
        }
      });

      // Send the request
      this.send(message);

      // Optional: Add timeout
      setTimeout(() => {
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
    this.listeners[type][randomId()] = listener;
    return randomId();
  }

  off(type, id) {
    delete this.listeners[type][id];
  }

  _onStatus(message) {
    const newStatus = {
      currentTemperature: message.ct,
      targetTemperature: message.tt,
      mode: message.m,
      selectedProfile: message.p,
      timestamp: new Date(),
    };
    const newValue = {
      ...machine.value,
      connected: true,
      status: {
        ...machine.value.status,
        ...newStatus,
      },
      capabilities: {
        ...machine.value.capabilities,
        dimming: message.cd,
        pressure: message.cp,
      },
      history: [
        ...machine.value.history,
        newStatus,
      ]
    };
    newValue.history = newValue.history.slice(-600);
    machine.value = newValue;
  }
}

export const ApiServiceContext = createContext(null);

export const machine = signal({
  connected: false,
  status: {
    currentTemperature: 0,
    targetTemperature: 0,
    mode: 0,
    selectedProfile: ''
  },
  capabilities: {
    pressure: false,
    dimming: false,
  },
  history: []
});
