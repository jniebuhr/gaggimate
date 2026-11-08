import { effect } from '@preact/signals';
import { t } from '@lingui/core/macro';
import { WARNING_LEVEL, warningByKey } from '../utils/warnings.js';
import { appSettings } from './appSettings.js';
import { acquireConnection } from './machineConnections.js';
import { activeMachine, machines } from './machines.js';
import { nativePlatform } from './platform.js';

// Must match CHANNEL_EVENTS in MachineMonitorService.java.
const EVENTS_CHANNEL = 'machine-events';
const MODE_BREW = 1;
const MODE_STEAM = 2;
const STEAM_LEFT_ON_MS = 5 * 60 * 1000;
// Below target by this much counts as heating; within READY_BAND of target counts as preheated.
const HEATING_BAND = 3;
const READY_BAND = 1;

// Watches one machine's ApiService and reports state transitions as notification events.
export class MachineMonitor {
  constructor(machineInfo, api, onEvent) {
    this.machineInfo = machineInfo;
    this.api = api;
    this.onEvent = onEvent;
    this.previous = null;
    this.heating = false;
    this.steamSince = null;
    this.steamNotified = false;
    this.listenerId = api.on('evt:status', () => this.check(api.state.value.status));
  }

  dispose() {
    this.api.off('evt:status', this.listenerId);
  }

  check(status) {
    const current = {
      brewMode: status.mode === MODE_BREW,
      steamMode: status.mode === MODE_STEAM,
      temperature: status.currentTemperature,
      target: status.targetTemperature,
      shotActive: isShot(status.process) && !!status.process.a,
      process: status.process,
      weight: status.currentWeight,
      systemError: status.system?.state === 'error',
      systemMessage: status.system?.message,
      warnings: new Set(
        (status.warnings ?? [])
          .filter(w => w.active && w.level > WARNING_LEVEL.IGNORE)
          .map(w => w.key),
      ),
      warningLevels: Object.fromEntries((status.warnings ?? []).map(w => [w.key, w.level])),
    };
    const previous = this.previous;
    this.previous = current;
    this.trackPreheat(current, previous !== null);
    this.trackSteam(current);
    // The first frame is a snapshot of whatever state the machine is already in, not a change.
    if (!previous) return;

    if (current.shotActive && !previous.shotActive) {
      this.emit('shotStarted', t`Shot started`, current.process?.l || t`Brewing…`);
    }
    if (!current.shotActive && previous.shotActive) {
      // The finished frame carries the final duration; fall back to the last running frame.
      const seconds = Math.round(((current.process ?? previous.process)?.e ?? 0) / 1000);
      const weight = current.weight > 0 ? `, ${current.weight.toFixed(1)} g` : '';
      this.emit('shotFinished', t`Shot finished`, `${seconds} s${weight}`);
    }
    if (current.systemError && !previous.systemError) {
      this.emit(
        'errors',
        t`Machine error`,
        current.systemMessage || t`The controller reported an error.`,
      );
    }
    for (const key of current.warnings) {
      if (previous.warnings.has(key)) continue;
      const label = warningByKey(key)?.label ?? key;
      const isError = current.warningLevels[key] >= WARNING_LEVEL.ERROR;
      this.emit(isError ? 'errors' : 'warnings', isError ? t`Error` : t`Warning`, label);
    }
  }

  // Preheated fires once the boiler climbs from clearly cold to target while in brew mode.
  trackPreheat(current, notify) {
    if (!current.brewMode || current.target <= 0) {
      this.heating = false;
      return;
    }
    if (current.temperature < current.target - HEATING_BAND) {
      this.heating = true;
    } else if (this.heating && current.temperature >= current.target - READY_BAND) {
      this.heating = false;
      if (notify) {
        const temperature = Math.round(current.temperature);
        this.emit('preheated', t`Ready to brew`, t`Boiler at ${temperature} °C`);
      }
    }
  }

  // Fires once per steam session; a session already running on connect counts from then.
  trackSteam(current) {
    if (!current.steamMode) {
      this.steamSince = null;
      this.steamNotified = false;
      return;
    }
    this.steamSince ??= Date.now();
    if (!this.steamNotified && Date.now() - this.steamSince >= STEAM_LEFT_ON_MS) {
      this.steamNotified = true;
      this.emit('steamLeftOn', t`Still in steam mode`, t`Steam has been on for 5 minutes.`);
    }
  }

  emit(event, title, body) {
    this.onEvent({ event, title, body, machine: this.machineInfo });
  }
}

// Brews only: flushes, backflushes and descaling run as utility brews, grinding isn't a shot.
const isShot = process =>
  !!process && (process.s === 'brew' || process.s === 'infusion') && !process.u;

// Owns one monitor per saved machine; non-active machines use the shared background connections.
export class NotificationService {
  constructor(mainApi) {
    this.mainApi = mainApi;
    this.monitors = [];
    this.connections = [];
    this.suspended = false;
    this.nextId = Date.now() % 1_000_000;
    // Restart whenever notifications are switched on/off or the machine list changes.
    this.disposeEffect = effect(() => {
      const enabled = appSettings.value.notifications.enabled;
      const saved = machines.value;
      const active = activeMachine.value;
      this.restart(enabled, saved, active);
    });
  }

  restart(enabled, saved, active) {
    this.stop();
    this.current = { enabled, saved, active };
    if (!enabled || this.suspended) return;
    if (active) this.monitors.push(new MachineMonitor(active, this.mainApi, e => this.notify(e)));
    for (const other of saved) {
      if (other.id === active?.id) continue;
      const connection = acquireConnection(other);
      this.connections.push(connection);
      this.monitors.push(new MachineMonitor(other, connection.api, e => this.notify(e)));
    }
  }

  // While the app is in the background its sockets are closed (Android hands over to a native service).
  suspend() {
    this.suspended = true;
    this.stop();
  }

  resume() {
    this.suspended = false;
    const { enabled, saved, active } = this.current;
    this.restart(enabled, saved, active);
  }

  stop() {
    this.monitors.forEach(monitor => monitor.dispose());
    this.connections.forEach(connection => connection.release());
    this.monitors = [];
    this.connections = [];
  }

  async notify({ event, title, body, machine }) {
    const settings = appSettings.value.notifications;
    if (!settings.enabled || !settings[event]) return;
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const android = nativePlatform() === 'android';
    if (android && !this.channelCreated) {
      // Same high-importance channel as MachineMonitorService, so events pop up as banners.
      await LocalNotifications.createChannel({
        id: EVENTS_CHANNEL,
        name: t`Machine events`,
        importance: 5,
      });
      this.channelCreated = true;
    }
    await LocalNotifications.schedule({
      notifications: [
        {
          id: this.nextId++,
          title: `${machine.name}: ${title}`,
          body,
          // Show as a banner even while the app is open.
          foreground: true,
          // Fires immediately; an exact alarm would make Android open the "Alarms & reminders" settings page.
          isExactNotification: false,
          ...(android ? { channelId: EVENTS_CHANNEL } : {}),
        },
      ],
    });
  }
}

// Asks for permission; resolves true when notifications may be shown.
export async function requestNotificationPermission() {
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const { display } = await LocalNotifications.requestPermissions();
  return display === 'granted';
}
