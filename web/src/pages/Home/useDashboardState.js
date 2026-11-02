import { grindAvailable } from '../../utils/grind.js';
import { computed } from '@preact/signals';
import { useContext, useEffect, useState } from 'preact/hooks';
import { useQuery } from 'preact-fetching';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { MODES } from './utils.js';
import { t } from '@lingui/core/macro';
import { computeWaterLevel } from '../../utils/waterLevel.js';

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
    // @ts-expect-error preact-fetching's useQuery takes (key, fetcher) only; this options object
    // is silently ignored (no staleTime / refetchOnWindowFocus support).
    { staleTime: 30000, refetchOnWindowFocus: false },
  );

  // ── derived ──────────────────────────────────────────────
  const isActive = !!p?.a;
  const isFinished = !!p?.e && !isActive;
  const isBrewing = mode === 1;
  const isGrinding = mode === 4;
  // The firmware flags a flush (utility process) so this state survives re-renders and reloads.
  const flushRunning = !!p?.u && isActive;
  const flushFinished = !!p?.u && isFinished;
  const isFlushing = flushPending || flushRunning;

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
    apiService.request({ tp: 'req:flush:start' }).catch(() => setFlushPending(false));
  };
  // Ends a hold-to-flush (flush duration 0); the firmware ignores it for a fixed-length flush.
  const stopFlush = () => {
    if (!isFlushing) return;
    send('req:flush:stop');
  };

  useEffect(() => {
    if (flushRunning) setFlushPending(false);
  }, [flushRunning]);
  // A finished flush clears itself; nobody wants to confirm a flush like a shot.
  useEffect(() => {
    if (flushFinished) apiService.send({ tp: 'req:process:clear' });
  }, [flushFinished, apiService]);

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
