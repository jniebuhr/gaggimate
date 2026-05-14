import { createContext } from 'preact';
import { signal } from '@preact/signals';
import uuidv4 from '../utils/uuid.js';

function randomId() {
  return Math.random()
    .toString(36)
    .replace(/[^a-z]+/g, '')
    .substr(2, 10);
}

export default class ApiService {
  static HISTORY_MAX_SIZE = 600;
  
  socket = null;
  listeners = {};
  reconnectAttempts = 0;
  maxReconnectDelay = 30000; // Maximum delay of 30 seconds
  baseReconnectDelay = 1000; // Start with 1 second delay
  reconnectTimeout = null;
  isConnecting = false;

  constructor() {
    // Bind methods once to avoid creating new function references on each reconnect
    this._boundOnMessage = this._onMessage.bind(this);
    this._boundOnClose = this._onClose.bind(this);
    this._boundOnError = this._onError.bind(this);
    this._boundOnOpen = this._onOpen.bind(this);

    console.log('Established websocket connection');
    this.connect();
  }

  _resolveWsUrl() {
    // Check URL params for relay configuration (one-time setup link)
    const params = new URLSearchParams(window.location.search);
    const relayParam = params.get('relay');
    const tokenParam = params.get('token');
    if (relayParam && tokenParam) {
      localStorage.setItem('gaggimate_relay_url', relayParam);
      localStorage.setItem('gaggimate_relay_token', tokenParam);
      // Clean params from URL without reload
      const url = new URL(window.location.href);
      url.searchParams.delete('relay');
      url.searchParams.delete('token');
      history.replaceState(null, '', url.toString());
    }

    const relayUrl = localStorage.getItem('gaggimate_relay_url');
    const relayToken = localStorage.getItem('gaggimate_relay_token');
    if (relayUrl && relayToken) {
      return `${relayUrl}/connect?token=${encodeURIComponent(relayToken)}&role=browser`;
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    return `${wsProtocol}${window.location.host}/ws`;
  }

  async connect() {
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      if (this.socket) {
        // Remove old listeners before closing to prevent memory leaks
        this.socket.removeEventListener('message', this._boundOnMessage);
        this.socket.removeEventListener('close', this._boundOnClose);
        this.socket.removeEventListener('error', this._boundOnError);
        this.socket.removeEventListener('open', this._boundOnOpen);
        this.socket.close();
      }

      this.socket = new WebSocket(this._resolveWsUrl());

      // Use bound references to enable proper cleanup
      this.socket.addEventListener('message', this._boundOnMessage);
      this.socket.addEventListener('close', this._boundOnClose);
      this.socket.addEventListener('error', this._boundOnError);
      this.socket.addEventListener('open', this._boundOnOpen);
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.isConnecting = false;
      this._scheduleReconnect();
    }
  }

  _onOpen() {
    console.log('WebSocket connected successfully');
    this.reconnectAttempts = 0;
    this.isConnecting = false;
    machine.value = {
      ...machine.value,
      connected: true,
    };
  }

  _onClose() {
    console.log('WebSocket connection closed');
    this.isConnecting = false; // Reset flag to allow reconnection
    machine.value = {
      ...machine.value,
      connected: false,
    };
    this._scheduleReconnect();
  }

  _onError(error) {
    console.error('WebSocket error:', error);
    this.isConnecting = false; // Reset flag to allow reconnection
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
    } catch (error) {
      console.warn('Failed to parse WebSocket message:', error);
      return; // Discard malformed messages to avoid crashing the WS handler.
    }
    
    // Validate message structure
    if (!message || typeof message !== 'object' || !message.tp) {
      console.warn('Invalid message structure:', message);
      return;
    }
    
    const listeners = Object.values(this.listeners[message.tp] || {});
    if (message.tp === 'evt:status') {
      this._onStatus(message);
    } else if (message.tp === 'evt:relay-status') {
      machine.value = { ...machine.value, deviceConnected: message.deviceConnected ?? true };
      return;
    }
    for (const listener of listeners) {
      try {
        listener(message);
      } catch (error) {
        console.error('Error in message listener:', error);
      }
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
      let listenerId;
      let cleaned = false;

      // Centralized cleanup to prevent memory leaks
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        clearTimeout(timeoutId);
        if (listenerId) {
          this.off(returnType, listenerId);
        }
      };

      // Create a listener for the response with matching rid
      listenerId = this.on(returnType, response => {
        if (response.rid === rid) {
          cleanup();
          resolve(response);
        }
      });

      // Send the request
      try {
        this.send(message);
      } catch (error) {
        cleanup();
        reject(error);
        return;
      }

      // Timeout: reject if no matching response arrives within 30 seconds
      timeoutId = setTimeout(() => {
        cleanup();
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

  /**
   * Adds an entry to history with a fixed maximum size.
   * Uses slice instead of shift to avoid O(n) re-indexing on every status update.
   * @param {Array} history - The current history array
   * @param {Object} entry - The new entry to add
   * @returns {Array} The updated history array
   */
  _addToHistory(history, entry) {
    if (history.length >= ApiService.HISTORY_MAX_SIZE) {
      // Trim the oldest 10% in one slice to amortize the copy cost
      const trimCount = Math.max(1, Math.floor(ApiService.HISTORY_MAX_SIZE * 0.1));
      const trimmed = history.slice(trimCount);
      trimmed.push(entry);
      return trimmed;
    }
    // Under the limit: append without copying the full array
    return [...history, entry];
  }

  _onStatus(message) {
    const newStatus = {
      currentTemperature: message.ct,
      targetTemperature: message.tt,
      currentPressure: message.pr,
      targetPressure: message.pt,
      targetFlow: message.tf ?? null,
      targetWeight: message.tw || 0,
      activeTargetWeight: (message?.process?.a && message.tw) || 0,
      currentFlow: message.fl,
      mode: message.m,
      selectedProfile: message.p,
      selectedProfileId: message.puid,
      selectedBean: message.bn || '',
      brewTarget: !!message.bt,
      brewTargetDuration: message.btd || 0,
      brewTargetVolume: message.btv || 0,
      volumetricAvailable: message.bta || false,
      grindTargetDuration: message.gtd || 0,
      grindTargetVolume: message.gtv || 0,
      grindTarget: message.gt || 0,
      grindActive: message.gact || false,
      manualTargetType: message.mtp || 'pressure',
      manualPressure: Number.isFinite(message.mp) ? message.mp : 9,
      manualFlow: Number.isFinite(message.mf) ? message.mf : 2,
      manualTemperature: Number.isFinite(message.mt) ? message.mt : 93,
      currentWeight: message.cw || 0,
      bluetoothConnected: message.bc || false,
      process: message.process || null,
      timestamp: new Date(),
      rssi: message.rssi || 0,
    };
    const historyEntry = { ...newStatus };
    delete historyEntry.process;
    
    // Efficient history management using circular buffer approach
    const newHistory = this._addToHistory(machine.value.history, historyEntry);
    
    machine.value = {
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
        ledControl: message.led,
      },
      history: newHistory,
    };
  }
}

export const ApiServiceContext = createContext(null);

export const machine = signal({
  connected: false,
  status: {
    currentTemperature: 0,
    targetTemperature: 0,
    mode: 0,
    selectedProfile: '',
    selectedProfileId: null,
    selectedBean: '',
    brewTargetDuration: 0,
    brewTargetVolume: 0,
    grindTargetDuration: 0,
    grindTargetVolume: 0,
    grindTarget: 0,
    grindActive: false,
    manualTargetType: 'pressure',
    manualPressure: 9,
    manualFlow: 2,
    manualTemperature: 93,
    process: null,
  },
  capabilities: {
    pressure: false,
    dimming: false,
  },
  history: [],
});
