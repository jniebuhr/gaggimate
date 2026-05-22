import { libraryService } from '../pages/ShotAnalyzer/services/LibraryService.js';

const DEFAULT_INTERVALS = Object.freeze({
  shots: 15000,
  profiles: 45000,
});

class RefreshCoordinator {
  constructor() {
    this.apiService = null;
    this.started = false;
    this.timers = new Map();
    this.inFlight = new Set();
    this.lastRefresh = new Map();
    this.listeners = new Set();
    this.intervals = DEFAULT_INTERVALS;
    this.onVisibilityChange = this.handleVisibilityChange.bind(this);
  }

  setApiService(apiService) {
    this.apiService = apiService;
    libraryService.setApiService(apiService);
  }

  isConnected() {
    return Boolean(
      this.apiService &&
        this.apiService.socket &&
        this.apiService.socket.readyState === WebSocket.OPEN,
    );
  }

  isVisible() {
    if (typeof document === 'undefined') return true;
    return document.visibilityState !== 'hidden';
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(event) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.warn('Refresh listener failed:', error);
      }
    }
  }

  canRefresh(domain, minIntervalMs) {
    if (this.inFlight.has(domain)) return false;
    const last = this.lastRefresh.get(domain) || 0;
    return Date.now() - last >= minIntervalMs;
  }

  async refreshDomain(domain, refreshFn, { reason = 'manual', minIntervalMs = 0 } = {}) {
    if (!this.isConnected()) return { skipped: true, reason: 'disconnected', domain };
    if (!this.canRefresh(domain, minIntervalMs)) return { skipped: true, reason: 'throttled', domain };

    this.inFlight.add(domain);
    const startedAt = new Date().toISOString();

    try {
      const result = await refreshFn();
      const event = {
        domain,
        reason,
        refreshedAt: new Date().toISOString(),
        startedAt,
        count: Array.isArray(result) ? result.length : null,
        error: null,
      };
      this.lastRefresh.set(domain, Date.now());
      this.notify(event);
      return event;
    } catch (error) {
      const event = {
        domain,
        reason,
        refreshedAt: new Date().toISOString(),
        startedAt,
        count: null,
        error,
      };
      this.notify(event);
      return event;
    } finally {
      this.inFlight.delete(domain);
    }
  }

  refreshShots(options = {}) {
    return this.refreshDomain('shots', () => libraryService.getGaggiMateShots(), {
      minIntervalMs: this.intervals.shots,
      ...options,
    });
  }

  refreshProfiles(options = {}) {
    return this.refreshDomain('profiles', () => libraryService.getGaggiMateProfiles(), {
      minIntervalMs: this.intervals.profiles,
      ...options,
    });
  }

  start(apiService = this.apiService) {
    if (apiService) this.setApiService(apiService);
    if (this.started) return;
    this.started = true;

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }

    this.timers.set(
      'shots',
      window.setInterval(() => {
        if (this.isVisible()) this.refreshShots({ reason: 'timer' });
      }, this.intervals.shots),
    );

    this.timers.set(
      'profiles',
      window.setInterval(() => {
        if (this.isVisible()) this.refreshProfiles({ reason: 'timer' });
      }, this.intervals.profiles),
    );

    this.refreshShots({ reason: 'start', minIntervalMs: 0 });
    this.refreshProfiles({ reason: 'start', minIntervalMs: 0 });
  }

  stop() {
    for (const timer of this.timers.values()) {
      window.clearInterval(timer);
    }
    this.timers.clear();
    this.started = false;

    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
  }

  handleVisibilityChange() {
    if (!this.isVisible()) return;
    this.refreshShots({ reason: 'visible' });
    this.refreshProfiles({ reason: 'visible' });
  }
}

export const refreshCoordinator = new RefreshCoordinator();
