import { createContext } from 'preact';

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
    this.socket = new WebSocket(((window.location.protocol === "https:") ? "wss://" : "ws://") + window.location.host + "/ws");
    this.socket.addEventListener("message", (e) => { this._onMessage(e); });
    this.socket.addEventListener("close", () => {
      setTimeout(() => {
        this.connect();
      }, 1000);
    });
    this.socket.addEventListener("error", () => {
      this.socket.close();
    });
  }

  _onMessage(event) {
    const message = JSON.parse(event.data);
    const listeners = Object.values(this.listeners[message.tp] || {});
    for (const listener of listeners) {
      listener(message);
    }
  }

  send(event) {
    this.socket.send(JSON.stringify(event));
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
