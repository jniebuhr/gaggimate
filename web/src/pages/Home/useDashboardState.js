import { computed } from '@preact/signals';
import { useContext, useState } from 'preact/hooks';
import { useQuery } from 'preact-fetching';
import { ApiServiceContext, machine } from '../../services/ApiService.js';

const status = computed(() => machine.value.status);
const capabilities = computed(() => machine.value.capabilities);

export function useDashboardState() {
  const apiService = useContext(ApiServiceContext);
  const [isFlushing, setIsFlushing] = useState(false);

  const s = status.value;
  const caps = capabilities.value;
  const p = s.process;

  const { data: settings } = useQuery(
    'settings-cache',
    async () => (await fetch('/api/settings')).json(),
    { staleTime: 30000, refetchOnWindowFocus: false },
  );

  // ── derived ──────────────────────────────────────────────
  const isActive = !!p?.a;
  const isFinished = !!p?.e && !isActive;
  const isBrewing = s.mode === 1;
  const isGrinding = s.mode === 4;

  const isSmartGrindEnabled = settings?.smartGrindActive || false;
  const altRelayFunction = settings?.altRelayFunction ?? 1;
  const isGrindAvailable = isSmartGrindEnabled || altRelayFunction === 1;
  const showGrindTab = isGrindAvailable || isGrinding;

  // ── water level (Alba) ────────────────────────────────────
  const ledControl = caps?.ledControl || false;
  const emptyTankDistance = settings?.emptyTankDistance || 0;
  const fullTankDistance = settings?.fullTankDistance || 0;
  const albaCalibrated = emptyTankDistance > 0 && fullTankDistance > 0;
  const waterLevelPercent =
    ledControl && albaCalibrated
      ? Math.max(
          0,
          Math.min(
            100,
            ((emptyTankDistance - s.tofDistance) / (emptyTankDistance - fullTankDistance)) * 100,
          ),
        )
      : null;

  // ── handlers ─────────────────────────────────────────────
  const send = tp => apiService.send({ tp });

  const changeMode = mode => apiService.send({ tp: 'req:change-mode', mode });

  const activate = () => send(isGrinding ? 'req:grind:activate' : 'req:process:activate');
  const deactivate = () => {
    send(isGrinding ? 'req:grind:deactivate' : 'req:process:deactivate');
    if (isFlushing) {
      send('req:process:clear');
      setIsFlushing(false);
    }
  };
  const clear = () => {
    send('req:process:clear');
    setIsFlushing(false);
  };

  const startFlush = () => {
    if (isFlushing) return;
    setIsFlushing(true);
    apiService.request({ tp: 'req:flush:start' }).catch(() => setIsFlushing(false));
  };

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
    mode: s.mode,
    currentTemperature: s.currentTemperature,
    targetTemperature: s.targetTemperature,
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
    // derived
    isActive,
    isFinished,
    isBrewing,
    isGrinding,
    isGrindAvailable,
    showGrindTab,
    // water level
    ledControl,
    albaCalibrated,
    waterLevelPercent,
    // settings
    isSmartGrindEnabled,
    altRelayFunction,
    emptyTankDistance,
    fullTankDistance,
    // action state
    isFlushing,
    // handlers
    changeMode,
    activate,
    deactivate,
    clear,
    startFlush,
    raiseTemp,
    lowerTemp,
    raiseTarget,
    lowerTarget,
    changeTarget,
  };
}
