import { ModeCard } from '../pages/Home/cards/ModeCard.jsx';
import { ProfileCard } from '../pages/Home/cards/ProfileCard.jsx';
import { FavoriteProfilesCard } from '../pages/Home/cards/FavoriteProfilesCard.jsx';
import { MetricsPanelWrapper } from '../pages/Home/cards/MetricsPanelWrapper.jsx';
import { WaterLevelCard } from '../pages/Home/cards/WaterLevelCard.jsx';
import { ActionCard } from '../pages/Home/cards/ActionCard.jsx';

/**
 * Each entry describes one panel in the dashboard control column.
 *
 * Fields:
 *   id               — unique string key; stored in localStorage to represent order/visibility
 *   label            — display name shown in the Settings configurator
 *   required         — if true: always visible, freely reorderable, cannot be removed by the user
 *   available        — (ds) => bool — return false to hide from dashboard AND settings pool.
 *                      ds is the useDashboardState() return value.
 *   availableInSettings — optional (status) => bool — used by the Settings configurator instead
 *                      of available() when the settings page passes raw machine.value.status.
 *                      Only needed when available() uses derived fields not in raw status.
 *   component        — Preact component to render
 *   props            — (ds) => object — props passed to component (inCard is injected by sidebar)
 *   containerClass   — optional CSS classes added to the wrapper div (e.g. flex height constraints)
 */
export const SPACER_ID = '__spacer__';

/**
 * Synthetic pseudo-panel: a flexible gap the user can place anywhere in the
 * panel order (Dashboard Settings) to split the middle panels into a
 * top-packed group and a bottom-packed group. Deliberately has no
 * component/props/containerClass since it's never rendered as a real panel.
 */
export const SPACER_DEFINITION = {
  id: SPACER_ID,
  label: 'Flexible Space',
  required: false,
  available: () => true,
};

export const PANEL_DEFINITIONS = [
  {
    id: 'mode',
    label: 'Mode Selector',
    required: true,
    supportsCompact: true,
    available: () => true,
    component: ModeCard,
    props: ds => ({
      mode: ds.mode,
      showGrindTab: ds.showGrindTab,
      changeMode: ds.changeMode,
      locked: !ds.systemReady,
    }),
  },
  {
    id: 'profile',
    label: 'Profile Selector',
    required: false,
    supportsCompact: true,
    available: ds => ds.mode !== 4,
    component: ProfileCard,
    props: ds => ({
      selectedProfile: ds.selectedProfile,
      selectedProfileId: ds.selectedProfileId,
      processInfo: ds.processInfo,
      isActive: ds.isActive,
      isFinished: ds.isFinished,
      isBrewing: ds.isBrewing,
      isGrinding: ds.isGrinding,
    }),
  },
  {
    id: 'favorites',
    label: 'Quick Select',
    required: false,
    supportsCompact: true,
    available: ds => ds.mode !== 4,
    component: FavoriteProfilesCard,
    props: ds => ({
      selectedProfileId: ds.selectedProfileId,
    }),
  },
  {
    id: 'metrics',
    label: 'Shot Metrics',
    required: true,
    supportsCompact: true,
    available: () => true,
    component: MetricsPanelWrapper,
    props: ds => ({ ds }),
  },
  {
    id: 'watertank',
    label: 'Water Tank',
    required: false,
    available: ds => ds.waterLevelPercent !== null,
    availableInSettings: status => !!status.tofDistance,
    component: WaterLevelCard,
    props: ds => ({
      waterLevelPercent: ds.waterLevelPercent,
    }),
  },
  {
    id: 'action',
    label: 'Shot Controls',
    required: true,
    available: () => true,
    availableInSettings: () => true,
    component: ActionCard,
    props: ds => ({
      mode: ds.mode,
      isActive: ds.isActive,
      isFinished: ds.isFinished,
      isBrewing: ds.isBrewing,
      isGrinding: ds.isGrinding,
      isGrindAvailable: ds.isGrindAvailable,
      isFlushing: ds.isFlushing,
      activate: ds.activate,
      deactivate: ds.deactivate,
      clear: ds.clear,
      startFlush: ds.startFlush,
      stopFlush: ds.stopFlush,
      warnings: ds.warnings,
      systemMessage: ds.systemMessage,
      currentTemperature: ds.currentTemperature,
      targetTemperature: ds.targetTemperature,
      changeTarget: ds.changeTarget,
      grindTarget: ds.grindTarget,
      grindTargetDuration: ds.grindTargetDuration,
      grindTargetVolume: ds.grindTargetVolume,
      raiseTarget: ds.raiseTarget,
      lowerTarget: ds.lowerTarget,
      volumetricAvailable: ds.volumetricAvailable,
    }),
  },
];
