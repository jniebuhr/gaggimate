import { grindAvailable } from '../../utils/grind.js';
import { computed } from '@preact/signals';
import { useContext, useEffect, useState } from 'preact/hooks';
import { useQuery } from 'preact-fetching';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { MODES } from './utils.js';
import { t } from '@lingui/core/macro';
import { computeWaterLevel } from '../../utils/waterLevel.js';

// A flush reports running within a status frame or two; past this it is assumed it never started.
const FLUSH_PENDING_TIMEOUT_MS = 5000;

const status = computed(() => machine.value.status);
const capabilities = computed(() => machine.value.capabilities);
const connected = computed(() => machine.value.connected);

export function useDashboardState() {
  const apiService = useContext(ApiServiceContext);
  const [flushPending, setFlushPending] = useState(false); // flush requested, status not caught up yet

  const s = status.value;
  const caps = capabilities.value;
  const p = s.process;

  // Anything but a ready controller locks the dashboard into standby, exactly like the touch UI.
  const systemReady = connected.value && (!s.system || s.system.state === 'ready');
  // Only a not-ready state carries a message; ready leaves the default standby text in place.
  const systemMessage = !connected.value
    ? t`Connecting to the machine...`
    : systemReady
      ? ''
      : s.system.message || s.system.state;
  const mode = systemReady ? s.mode : 0;

  const { data: settings } = useQuery(
    'settings-cache',
    async () => (await fetch('/api/settings')).json(),
    { staleTime: 30000, refetchOnWindowFocus: false },
  );

  // ── derived ──────────────────────────────────────────────
  const isActive = !!p?.a;
  const isFinished = !!p?.e && !isActive;
  const isBrewing = mode === 1;
  const isGrinding = mode === 4;
  // The firmware flags a flush so this state survives re-renders and reloads.
  const isFlushRunning = !!p?.f && isActive;
  const isFlushFinished = !!p?.f && isFinished;
  const isFlushing = flushPending || isFlushRunning;
  const isFlushPending = flushPending && !isFlushRunning;

  const isSmartGrindEnabled = settings?.smartGrindActive || false;
  const altRelayFunction = settings?.altRelayFunction ?? 1;
  const isGrindAvailable = grindAvailable(settings, caps);
  const showGrindTab = isGrindAvailable || isGrinding;
  // Dual boilers steam and dispense water from brew mode; keep a hidden tab while it is the current mode.
  const steamWaterAvailable = !caps?.dualBoiler;
  const visibleModes = MODES.filter(m => {
    if (m.id === mode) return true;
    if (m.id === 4) return showGrindTab;
    if (m.id === 2 || m.id === 3) return steamWaterAvailable;
    return true;
  });

  // ── water level (Alba) ────────────────────────────────────
  // The tank card follows an Alba with its percentage sensor; null means "attached but not calibrated".
  const ledControl = caps?.ledControl || false;
  const albaWaterLevelAvailable = !!s.albaWaterLevelAvailable;
  const waterLevelPercent = albaWaterLevelAvailable
    ? computeWaterLevel({
        empty: settings?.emptyTankDistance,
        full: settings?.fullTankDistance,
        distance: s.tofDistance,
      })
    : null;

  // ── handlers ─────────────────────────────────────────────
  const send = tp => apiService.send({ tp });

  const toggleSteam = () => {
    if (systemReady && caps.dualBoiler && mode !== 0 && s.steamControlsAvailable !== false)
      send('req:steam:toggle');
  };

  const changeMode = newMode => {
    if (!systemReady) return; // locked in standby until the controller is ready
    if (caps.dualBoiler && newMode === 2) {
      toggleSteam();
      return;
    }
    apiService.send({ tp: 'req:change-mode', mode: newMode });
  };

  const activate = () => send(isGrinding ? 'req:grind:activate' : 'req:process:activate');
  const deactivate = () => {
    send(isGrinding ? 'req:grind:deactivate' : 'req:process:deactivate');
    if (isFlushing) {
      send('req:process:clear');
      setFlushPending(false);
    }
  };
  const clear = () => {
    send('req:process:clear');
    setFlushPending(false);
  };

  const startFlush = () => {
    if (isFlushing) return;
    setFlushPending(true);
    apiService
      .request({ tp: 'req:flush:start' })
      .then(res => {
        if (!res?.success) setFlushPending(false);
      })
      .catch(() => setFlushPending(false));
  };
  // Ends a hold-to-flush (flush duration 0). Always sent, even when isFlushing already reads false
  // (status lagging, pending cleared): the firmware ignores it unless a hold-to-flush runs.
  const stopFlush = () => send('req:flush:stop');

  useEffect(() => {
    if (isFlushRunning) setFlushPending(false);
  }, [isFlushRunning]);
  // Never stay pending on a flush that isn't coming.
  useEffect(() => {
    if (!isFlushPending) return;
    const id = setTimeout(() => setFlushPending(false), FLUSH_PENDING_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [isFlushPending]);

  // A finished flush clears itself; nobody wants to confirm a flush like a shot.
  useEffect(() => {
    if (isFlushFinished) apiService.send({ tp: 'req:process:clear' });
  }, [isFlushFinished, apiService]);

  const raiseTemp = () => send('req:raise-temp');
  const lowerTemp = () => send('req:lower-temp');
  const raiseTarget = () => send(isGrinding ? 'req:raise-grind-target' : 'req:raise-brew-target');
  const lowerTarget = () => send(isGrinding ? 'req:lower-grind-target' : 'req:lower-brew-target');
  const changeTarget = target =>
    apiService.send({
      tp: isGrinding ? 'req:change-grind-target' : 'req:change-brew-target',
      target,
    });

  return {
    // raw status
    smartDose: s.smartDose,
    albaWaterLevelAvailable,
    hasTankLevel: !!s.hasTankLevel,
    tankLevelOK: s.tankLevelOK ?? null,
    hasSteamLevel: !!s.hasSteamLevel,
    steamBoilerLow: s.steamBoilerLow ?? null,
    mode,
    systemReady,
    systemMessage,
    currentTemperature: s.currentTemperature,
    targetTemperature: s.targetTemperature,
    currentSteamTemperature: s.currentSteamTemperature,
    targetSteamTemperature: s.targetSteamTemperature,
    steamActive: !!s.steamActive,
    steamControlsAvailable: s.steamControlsAvailable !== false,
    currentPressure: s.currentPressure,
    targetPressure: s.targetPressure,
    currentFlow: s.currentFlow,
    targetFlow: s.targetFlow,
    currentWeight: s.currentWeight,
    currentPumpPower: s.currentPumpPower ?? 0,
    currentBoilerPower: s.currentBoilerPower ?? 0,
    currentPuckResistance: s.currentPuckResistance ?? 0,
    currentPuckFlow: s.currentPuckFlow ?? 0,
    currentCoffeeVolume: s.currentCoffeeVolume ?? 0,
    targetWeight: s.targetWeight,
    volumetricAvailable: s.volumetricAvailable,
    brewTarget: !!s.brewTarget,
    grindTarget: s.grindTarget,
    grindTargetDuration: s.grindTargetDuration,
    grindTargetVolume: s.grindTargetVolume,
    selectedProfile: s.selectedProfile,
    selectedProfileId: s.selectedProfileId,
    processInfo: p,
    tofDistance: s.tofDistance,
    warnings: s.warnings ?? [],
    dualBoiler: caps.dualBoiler,
    // derived
    isActive,
    isFinished,
    isBrewing,
    isGrinding,
    isGrindAvailable,
    showGrindTab,
    visibleModes,
    // water level
    ledControl,
    waterLevelPercent,
    // settings
    isSmartGrindEnabled,
    altRelayFunction,
    // action state
    isFlushing,
    isFlushPending,
    isFlushFinished,
    // Unknown duration counts as hold: a tap then can't start a flush nothing stops.
    // Live from status, so a change on the machine or the settings page applies at once; the cached
    // settings only cover firmware that doesn't report it.
    isHoldFlush: Number(s.flushDuration ?? settings?.flushDuration ?? 0) === 0,
    // handlers
    changeMode,
    toggleSteam,
    activate,
    deactivate,
    clear,
    startFlush,
    stopFlush,
    raiseTemp,
    lowerTemp,
    raiseTarget,
    lowerTarget,
    changeTarget,
  };
}
