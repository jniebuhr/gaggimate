import { createContext } from 'preact';

function randomId() {
  return Math.random().toString(36).replace(/[^a-z]+/g, '').substr(2, 10);
}

export default class ApiService {
  socket = null;
  listeners = {};

  constructor() {
    this.socket = new WebSocket(((window.location.protocol === "https:") ? "wss://" : "ws://") + window.location.host + "/ws");
    this.socket.addEventListener("message", (e) => { this._onMessage(e); });
    console.log("Established websocket connection");
  }

  _onMessage(event) {
    const message = JSON.parse(event.data);
    if (message.tp.startsWith("evt")) {
      const listeners = Object.values(this.listeners[message.tp] || {});
      for (const listener of listeners) {
        listener(message);
      }
    }
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
}

export const ApiServiceContext = createContext(null);
