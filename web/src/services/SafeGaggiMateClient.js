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

  async requestDataWrite(data) {
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

  async saveProfile(profile) {
    return this.requestDataWrite({
      tp: 'req:profiles:save',
      profile,
    });
  }

  async reorderProfiles(order) {
    return this.requestDataWrite({
      tp: 'req:profiles:reorder',
      order,
    });
  }

  async selectProfile(id) {
    return this.requestDataWrite({
      tp: 'req:profiles:select',
      id,
    });
  }

  async favoriteProfile(id) {
    return this.requestDataWrite({
      tp: 'req:profiles:favorite',
      id,
    });
  }

  async unfavoriteProfile(id) {
    return this.requestDataWrite({
      tp: 'req:profiles:unfavorite',
      id,
    });
  }

  async deleteRemoteShot(id) {
    return this.requestDataWrite({
      tp: 'req:history:delete',
      id,
    });
  }

  async deleteRemoteProfile(id) {
    return this.requestDataWrite({
      tp: 'req:profiles:delete',
      id,
    });
  }
}

export const safeGaggiMateClient = new SafeGaggiMateClient();
