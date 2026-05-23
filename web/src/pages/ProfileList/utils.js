import { TclConverter } from './TclConverter.js';

export function parseProfile(input) {
  try {
    let parsed = JSON.parse(input);
    if (!Array.isArray(parsed)) {
      parsed = convertJsonProfile(parsed);
      parsed = [parsed];
    }
    return parsed;
  } catch (ignored) {
    const result = TclConverter.toGaggiMate(input);
    if (result.ok) {
      return [result.json];
    }
  }
  return [];
}

function convertJsonProfile(input) {
  if (input && Array.isArray(input.stages)) return convertMeticulousProfile(input);
  return input;
}

// ---- Meticulous JSON → Gaggimate ------------------------------------------
// Reference schema: https://github.com/MeticulousHome/espresso-profile-schema

const PREINFUSION_KEYWORDS = ['preinfu', 'soak', 'bloom', 'fill', 'wet'];

function isPositive(value) {
  return typeof value === 'number' && value > 0 && Number.isFinite(value);
}

function clampDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0.5;
  return Math.max(0.5, Math.min(300, seconds));
}

function mapInterpolation(interpolation) {
  if (interpolation === 'linear') return 'linear';
  if (interpolation === 'curve') return 'ease-in-out';
  return 'instant';
}

function mapComparison(comparison) {
  return comparison === '<=' ? 'lte' : 'gte';
}

function buildVariableResolver(variables) {
  const table = {};
  for (const v of variables || []) {
    if (v && typeof v.key === 'string') table[v.key] = v.value;
  }
  return value => {
    if (typeof value !== 'string') return value;
    if (!value.startsWith('$')) return value;
    const replaced = table[value.slice(1)];
    return replaced === undefined ? 0 : replaced;
  };
}

function deriveDurations(stage, resolve) {
  const points = (stage.dynamics?.points || []).map(([x, y]) => [
    Number(resolve(x)) || 0,
    Number(resolve(y)) || 0,
  ]);
  const isTimeAxis = stage.dynamics?.over === 'time';
  const rampSpan =
    isTimeAxis && points.length >= 2
      ? Math.max(0, points[points.length - 1][0] - points[0][0])
      : 0;
  const timeTrigger = (stage.exit_triggers || []).find(
    t => t && t.type === 'time' && t.relative !== false,
  );
  const triggerSeconds = timeTrigger ? Number(resolve(timeTrigger.value)) || 0 : 0;
  const fallback = isTimeAxis && points.length ? points[points.length - 1][0] : 0;
  const rawDuration = triggerSeconds > 0 ? triggerSeconds : fallback || 300;
  return {
    points,
    duration: clampDuration(rawDuration),
    rampDuration: Math.min(rampSpan, 300),
  };
}

function buildPump(stage, points, resolve) {
  const setpoint = points.length ? points[points.length - 1][1] : 0;
  // `power` stages map to a fixed pump duty cycle (Gaggimate's simple pump form).
  if (stage.type === 'power') {
    const percent = Math.round(Math.max(0, Math.min(100, setpoint)));
    return percent;
  }
  const limits = stage.limits || [];
  const pressureLimit = limits.find(l => l && l.type === 'pressure');
  const flowLimit = limits.find(l => l && l.type === 'flow');
  const resolvedPressureLimit = pressureLimit ? Number(resolve(pressureLimit.value)) || 0 : 0;
  const resolvedFlowLimit = flowLimit ? Number(resolve(flowLimit.value)) || 0 : 0;
  if (stage.type === 'pressure') {
    return { target: 'pressure', pressure: setpoint, flow: resolvedFlowLimit };
  }
  return { target: 'flow', pressure: resolvedPressureLimit, flow: setpoint };
}

function buildTargets(stage, resolve) {
  const out = [];
  for (const trigger of stage.exit_triggers || []) {
    if (!trigger || trigger.type === 'time') continue;
    // Relative weight is "delta since stage start"; Gaggimate's volumetric target compares
    // absolute scale mass, so applying a relative value would fire too early. Drop them.
    if (trigger.type === 'weight' && trigger.relative === true) continue;
    let type;
    if (trigger.type === 'weight') type = 'volumetric';
    else if (trigger.type === 'pressure') type = 'pressure';
    else if (trigger.type === 'flow') type = 'flow';
    else continue;
    const value = Number(resolve(trigger.value));
    if (!Number.isFinite(value) || value < 0) continue;
    out.push({ type, operator: mapComparison(trigger.comparison), value });
  }
  return out;
}

function convertStage(stage, index, profileTemperature, resolve) {
  const { points, duration, rampDuration } = deriveDurations(stage, resolve);
  const isPreinfusion = PREINFUSION_KEYWORDS.some(kw =>
    (stage.name || '').toLowerCase().includes(kw),
  );
  const phase = {
    name: stage.name || `Phase ${index + 1}`,
    phase: isPreinfusion ? 'preinfusion' : 'brew',
    valve: 1,
    duration,
    pump: buildPump(stage, points, resolve),
    transition: {
      type: mapInterpolation(stage.dynamics?.interpolation),
      duration: Math.min(rampDuration, duration),
      adaptive: false,
    },
  };
  if (isPositive(stage.temperature_delta) || isPositive(-stage.temperature_delta)) {
    const overridden = profileTemperature + stage.temperature_delta;
    if (overridden > 0) phase.temperature = Number(overridden.toFixed(2));
  }
  const targets = buildTargets(stage, resolve);
  if (targets.length > 0) phase.targets = targets;
  return phase;
}

function pickDescription(display) {
  if (!display) return '';
  if (typeof display.description === 'string') return display.description;
  if (typeof display.shortDescription === 'string') return display.shortDescription;
  return '';
}

function convertMeticulousProfile(input) {
  const resolve = buildVariableResolver(input.variables);
  const profile = {
    label: typeof input.name === 'string' && input.name.trim() ? input.name : 'Imported Profile',
    type: 'pro',
    description: pickDescription(input.display),
    temperature: isPositive(input.temperature) ? input.temperature : 93,
    phases: [],
  };

  for (let i = 0; i < input.stages.length; i++) {
    profile.phases.push(convertStage(input.stages[i], i, profile.temperature, resolve));
  }

  if (isPositive(input.final_weight) && profile.phases.length > 0) {
    let lastBrewIdx = -1;
    for (let i = profile.phases.length - 1; i >= 0; i--) {
      if (profile.phases[i].phase === 'brew') {
        lastBrewIdx = i;
        break;
      }
    }
    const target =
      lastBrewIdx >= 0 ? profile.phases[lastBrewIdx] : profile.phases[profile.phases.length - 1];
    target.targets = target.targets || [];
    const hasVolumetric = target.targets.some(t => t.type === 'volumetric');
    if (!hasVolumetric) {
      target.targets.push({ type: 'volumetric', operator: 'gte', value: input.final_weight });
    }
  }

  return profile;
}
