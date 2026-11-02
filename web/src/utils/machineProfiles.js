import { t } from '@lingui/core/macro';
import { requestSettings } from './settingsRequest.js';
import fields from '../data/machineProfileFields.json';
import { splitPidString } from '../pages/Settings/settingsForm.js';

/**
 * A machine profile from src/data/machineProfiles or the device's library.
 * @typedef {object} MachineProfile
 * @property {string} id
 * @property {string} name
 * @property {number} [schemaVersion]
 * @property {number} [revision]
 * @property {Record<string, any>} [requires] Capabilities the machine must (not) have.
 * @property {Record<string, any>} [settings]
 */

/**
 * One editable setting in src/data/machineProfileFields.json.
 * @typedef {object} ProfileField
 * @property {string} label
 * @property {string} type
 * @property {number[]} [lengths] Allowed value counts for csv fields.
 * @property {number} [min]
 * @property {number} [max]
 * @property {string} [capability] Capability the field needs.
 * @property {boolean} [singleBoiler] Only for single-boiler machines.
 * @property {number[]} [values] Allowed values, in display order.
 * @property {boolean} [restart] Changing it restarts the controller.
 * @property {boolean} [hardware] Shown in the hardware section.
 * @property {Record<string, string>} [options] Labels for select values.
 */

/** @type {Record<string, MachineProfile>} */
const modules = import.meta.glob('../data/machineProfiles/*.json', {
  eager: true,
  import: 'default',
});
export const MACHINE_PROFILES = Object.values(modules).sort((a, b) => a.name.localeCompare(b.name));
/** @type {Record<string, ProfileField>} */
export const PROFILE_FIELDS = fields;
export const CUSTOM_PROFILE = '';
export const MAX_PROFILE_BYTES = 3500;

export function parseProfileSelection(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}
export function isProfileFieldLocked(formData, key) {
  const profile = parseProfileSelection(formData.machineProfileSelection);
  if (
    !profile ||
    [
      'targetWaterTemp',
      'defaultSteamMode',
      'systemLedBrightness',
      'baristaLedBrightness',
      'systemLedMinBrightness',
      'baristaLedMinBrightness',
      'systemLedCycleTimeMs',
      'baristaLedCycleTimeMs',
    ].includes(key)
  )
    return false;
  if (key === 'targetSteamTemp') {
    return (
      profile.locks?.targetSteamTemp ??
      !!(formData.machineProfileCapabilities?.dualBoiler ?? profile.requires?.dualBoiler)
    );
  }
  return true;
}

export function profileSupported(key, capabilities = {}, hardware = false) {
  const field = fields[key];
  return (
    !!field &&
    (!field.hardware || hardware) &&
    (!field.capability || !!capabilities[field.capability]) &&
    (!field.singleBoiler || !capabilities.dualBoiler)
  );
}
export function normalizeProfile(input) {
  if (!input || Array.isArray(input) || typeof input !== 'object' || input.schemaVersion !== 1)
    throw new Error('Unsupported machine profile format.');
  if (
    typeof input.id !== 'string' ||
    !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(input.id) ||
    typeof input.name !== 'string' ||
    !input.name.trim() ||
    input.name.length > 64 ||
    !Number.isInteger(input.revision) ||
    input.revision < 1 ||
    input.revision > 2147483647
  )
    throw new Error('Invalid profile identity or revision.');
  const allowed = [
    'schemaVersion',
    'id',
    'name',
    'revision',
    'requires',
    'settings',
    'plugins',
    'locks',
  ];
  if (Object.keys(input).some(key => !allowed.includes(key)))
    throw new Error('Unknown profile property.');
  if (
    'locks' in input &&
    (!input.locks ||
      typeof input.locks !== 'object' ||
      Array.isArray(input.locks) ||
      Object.entries(input.locks).some(
        ([key, value]) => key !== 'targetSteamTemp' || typeof value !== 'boolean',
      ))
  )
    throw new Error('Invalid profile field locks.');
  const requires = input.requires || {};
  if (
    !requires ||
    typeof requires !== 'object' ||
    Array.isArray(requires) ||
    Object.keys(requires).some(key => !['boards', 'pressure', 'dualBoiler'].includes(key)) ||
    ['pressure', 'dualBoiler'].some(key => key in requires && typeof requires[key] !== 'boolean') ||
    ('boards' in requires &&
      (!Array.isArray(requires.boards) ||
        !requires.boards.length ||
        requires.boards.length > 16 ||
        requires.boards.some(b => typeof b !== 'string' || !b || b.length > 80)))
  )
    throw new Error('Invalid board requirements.');
  if (
    !input.settings ||
    typeof input.settings !== 'object' ||
    Array.isArray(input.settings) ||
    !Object.keys(input.settings).length
  )
    throw new Error('Profile has no machine settings.');
  const settings = {};
  for (const [key, value] of Object.entries(input.settings)) {
    const field = fields[key];
    if (!field) throw new Error(`Unknown machine setting: ${key}`);
    if (field.type === 'boolean') {
      if (typeof value !== 'boolean') throw new Error(`Invalid boolean: ${key}`);
    } else if (field.type === 'csv') {
      const parts = typeof value === 'string' ? value.split(',') : [];
      if (
        !field.lengths.includes(parts.length) ||
        parts.some(
          p =>
            !p.trim() ||
            !Number.isFinite(Number(p)) ||
            Math.abs(Number(p)) > 1e6 ||
            ((key === 'pid' || key === 'steamPid') && Number(p) < 0),
        )
      )
        throw new Error(`Invalid coefficients: ${key}`);
    } else if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      (field.type === 'integer' && !Number.isInteger(value)) ||
      ('min' in field && value < field.min) ||
      ('max' in field && value > field.max) ||
      (field.values && !field.values.includes(value))
    )
      throw new Error(`Invalid value: ${key}`);
    settings[key] = value;
  }
  for (const prefix of ['system', 'barista']) {
    const minimum = settings[`${prefix}LedMinBrightness`];
    const maximum = settings[`${prefix}LedBrightness`] ?? 255;
    if (minimum !== undefined && minimum > maximum)
      throw new Error('LED minimum brightness exceeds maximum.');
  }
  if (
    input.plugins &&
    (!Array.isArray(input.plugins) || input.plugins.some(p => p !== 'boilerFillActive'))
  )
    throw new Error('Unknown recommended plugin.');
  const profile = {
    schemaVersion: 1,
    id: input.id,
    name: input.name.trim(),
    revision: input.revision,
    requires,
    settings,
    ...(input.plugins ? { plugins: input.plugins } : {}),
    ...(input.locks ? { locks: { ...input.locks } } : {}),
  };
  if (new TextEncoder().encode(JSON.stringify(profile)).length > MAX_PROFILE_BYTES)
    throw new Error('Profile is too large.');
  return profile;
}
export function machineBoardName(board, capabilities = {}) {
  if (capabilities.dualBoiler) return 'GaggiMate Max';
  if (/pro.*lego/i.test(board)) return 'GaggiMate Pro Lego';
  if (/pro/i.test(board)) return 'GaggiMate Pro';
  if (/standard/i.test(board)) return 'GaggiMate Standard';
  return board;
}

export function profileProblems(profile, settings, machine) {
  const caps = settings.machineProfileCapabilities || machine?.capabilities || {};
  const board = settings.machineProfileBoard || machine?.hardware;
  if (!board)
    return [
      t`Waiting for your controller to identify its board. Please keep the machine connected.`,
    ];
  const currentBoard = machineBoardName(board, caps);
  const requirements = profile.requires || {};
  const settingKeys = profile.settings ? Object.keys(profile.settings) : profile.settingKeys || [];
  if (settingKeys.some(key => !fields[key]))
    return [
      t`This profile includes settings outside machine configuration. Remove them from the profile before importing it.`,
    ];
  const profileFields = settingKeys.map(key => fields[key]);
  const needsDualBoiler =
    requirements.dualBoiler ??
    (profileFields.some(field => field.capability === 'dualBoiler')
      ? true
      : profileFields.some(field => field.singleBoiler)
        ? false
        : undefined);
  const profileName = profile.name;
  // Keep the normal wizard mismatch to one explanation naming the machine and board.
  if (
    (needsDualBoiler === true || profileFields.some(field => field.capability === 'dualBoiler')) &&
    !caps.dualBoiler
  )
    return [
      t`Your ${currentBoard} board is not compatible with the ${profileName} dual boiler machine. You will need a GaggiMate Max board.`,
    ];
  if (
    (needsDualBoiler === false || profileFields.some(field => field.singleBoiler)) &&
    caps.dualBoiler
  )
    return [
      t`Your ${currentBoard} board is not compatible with the ${profileName} single boiler machine. You will need a GaggiMate Pro/Standard board.`,
    ];
  // Imported profiles can still restrict a board, pressure support, or firmware features.
  // Preserve those checks without exposing field-by-field implementation details.
  if (
    (requirements.boards && !requirements.boards.includes(board)) ||
    ('pressure' in requirements && requirements.pressure !== !!caps.pressure) ||
    settingKeys.some(key => !profileSupported(key, caps, !!settings.machineHardwareConfiguration))
  )
    return [t`The ${profileName} profile is not supported by your current board or firmware.`];
  return [];
}
export function profileToForm(profile) {
  const values = { ...profile.settings };
  if ('pid' in values) Object.assign(values, splitPidString(values.pid));
  return { ...values, machineProfileSelection: JSON.stringify(profile) };
}
export function currentProfileValues(settings, capabilities, hardware) {
  const values = {};
  for (const [key, field] of Object.entries(fields)) {
    if (!profileSupported(key, capabilities, hardware) || settings[key] === undefined) continue;
    const value =
      key === 'pid' && settings.kf !== undefined ? `${settings.pid},${settings.kf}` : settings[key];
    values[key] =
      field.type === 'boolean'
        ? value === true || value === '1' || value === 1
        : field.type === 'csv'
          ? String(value)
          : Number(value);
  }
  return values;
}
export function changedProfileValues(profile, current) {
  return Object.entries(profile.settings).filter(([key, value]) => {
    if (current[key] === undefined) return true;
    if (fields[key].type === 'csv')
      return (
        value.split(',').map(Number).join(',') !==
        String(current[key]).split(',').map(Number).join(',')
      );
    return value !== current[key];
  });
}

// Compare against saved device values, rather than unsaved form edits.
export async function confirmProfileApply(formData, confirmChanges) {
  const saved = await requestSettings();
  const selected = parseProfileSelection(formData.machineProfileSelection);
  if (selected?.settings) {
    const problems = profileProblems(normalizeProfile(selected), saved);
    if (problems.length) throw new Error(problems.join('\n'));
  }
  const caps = saved.machineProfileCapabilities || {};
  const values = currentProfileValues(formData, caps, !!saved.machineHardwareConfiguration);
  if (!Object.keys(values).length) return true;
  normalizeProfile({
    schemaVersion: 1,
    id: 'custom',
    name: 'Custom',
    revision: 1,
    settings: values,
  });
  const changed = changedProfileValues(
    { settings: values },
    currentProfileValues(saved, caps, !!saved.machineHardwareConfiguration),
  );
  if (!changed.length) return true;
  if (confirmChanges) return confirmChanges(changed);
  return window.confirm(
    `Replace these machine settings?\n${changed.map(([key, value]) => `${fields[key].label}: ${String(value)}`).join('\n')}`,
  );
}

export async function waitForMachineHardware() {
  const deadline = Date.now() + 45000;
  let temperatureFault = '';
  while (Date.now() < deadline) {
    let data;
    try {
      data = await requestSettings({}, Math.min(5000, deadline - Date.now()));
    } catch {
      // A controller restart or a stale HTTP connection can briefly interrupt
      // polling. Retry reads within the deadline; never automatically retry saves.
    }
    if (data?.machineHardwareError)
      throw new Error('Controller could not save the hardware configuration.');
    if (data) temperatureFault = machineTemperatureFault(data);
    // A configuration-triggered controller restart may clear the fault, so keep polling.
    if (data && data.machineHardwareReady !== false && !temperatureFault) return data;
    await new Promise(resolve =>
      setTimeout(resolve, Math.max(0, Math.min(750, deadline - Date.now()))),
    );
  }
  if (temperatureFault) throw new Error(temperatureFault);
  throw new Error(
    'Settings were saved, but the controller has not confirmed the configuration. Keep the machine in standby and reload to check its status.',
  );
}

// Existing controller error 4 covers temperature faults (sensor failure or overtemperature).
export function machineTemperatureFault(data) {
  if (data?.controllerError !== 4) return '';
  return data.machineHardwareConfiguration || data.machineProfileCapabilities?.dualBoiler
    ? t`Settings saved. Temperature fault detected. Check that both brew and steam NTC sensors are connected and correctly configured. Restart the controller and retry Apply Preset.`
    : t`Settings saved. Temperature fault detected. Check the temperature sensor and its connection. Restart the controller and retry Apply Preset.`;
}
