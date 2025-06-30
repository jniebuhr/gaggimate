import { createContext } from 'preact';
import { signal } from '@preact/signals';
import uuidv4 from '../utils/uuid.js';

function randomId() {
  return Math.random().toString(36).replace(/[^a-z]+/g, '').substr(2, 10);
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
    console.log("Established websocket connection");
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
      const wsProtocol = window.location.protocol === "https:" ? "wss://" : "ws://";
      this.socket = new WebSocket(`${wsProtocol}${apiHost}/ws`);

      this.socket.addEventListener("message", this._onMessage.bind(this));
      this.socket.addEventListener("close", this._onClose.bind(this));
      this.socket.addEventListener("error", this._onError.bind(this));
      this.socket.addEventListener("open", this._onOpen.bind(this));

    } catch (error) {
      console.error("WebSocket connection error:", error);
      this._scheduleReconnect();
    } finally {
      this.isConnecting = false;
    }
  }

  _onOpen() {
    console.log("WebSocket connected successfully");
    this.reconnectAttempts = 0;
    machine.value = {
      ...machine.value,
      connected: true
    };
  }

  _onClose() {
    console.log("WebSocket connection closed");
    machine.value = {
      ...machine.value,
      connected: false
    };
    this._scheduleReconnect();
  }

  _onError(error) {
    console.error("WebSocket error:", error);
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
      this.maxReconnectDelay
    );

    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts + 1} in ${delay}ms`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
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
      currentPressure: message.pr,
      targetPressure: message.pt,
      currentFlow: message.fl,
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
