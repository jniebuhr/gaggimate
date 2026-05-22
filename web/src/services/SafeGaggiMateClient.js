class SafeGaggiMateClient {
  constructor() {
    this.apiService = null;
  }

  setApiService(apiService) {
    this.apiService = apiService;
  }

  isConnected() {
    return Boolean(
      this.apiService &&
        this.apiService.socket &&
        this.apiService.socket.readyState === WebSocket.OPEN,
    );
  }

  getConnectionStatus() {
    return {
      connected: this.isConnected(),
    };
  }

  async requestRead(data) {
    if (!this.isConnected()) {
      throw new Error('GaggiMate websocket is not connected');
    }

    return this.apiService.request(data);
  }

  async listProfiles() {
    return this.requestRead({
      tp: 'req:profiles:list',
    });
  }

  async loadProfile(id) {
    return this.requestRead({
      tp: 'req:profiles:load',
      id,
    });
  }

  async deleteRemoteShot(id) {
    if (!this.isConnected()) {
      throw new Error('GaggiMate websocket is not connected');
    }

    return this.apiService.request({
      tp: 'req:history:delete',
      id,
    });
  }

  async deleteRemoteProfile(id) {
    if (!this.isConnected()) {
      throw new Error('GaggiMate websocket is not connected');
    }

    return this.apiService.request({
      tp: 'req:profiles:delete',
      id,
    });
  }
}

export const safeGaggiMateClient = new SafeGaggiMateClient();
