import { TclConverter } from './TclConverter.js';

export function parseProfile(input) {
  try {
    let profiles = JSON.parse(input);
    if (!Array.isArray(profiles)) {
      profiles = convertJsonProfile(profiles);
      profiles = [profiles];
    }
    return profiles;
  } catch (ignored) {
    const result = TclConverter.toGaggiMate(input);
    if (result.ok) {
      return [result.json];
    }
    // Input isn't JSON, try TCL
  }
  return [];
}

// Detect the source profile format and dispatch to the appropriate importer.
// Falls through to returning the raw input (existing behaviour) when no
// recognised format matches.
function convertJsonProfile(input) {
  if (!input || typeof input !== 'object') return input;
  // Meticulous signature: stages[] with a dynamics object on each stage.
  // Reference: https://github.com/MeticulousHome/espresso-profile-schema
  if (
    Array.isArray(input.stages) &&
    input.stages.length > 0 &&
    input.stages.some(s => s && typeof s === 'object' && s.dynamics)
  ) {
    return convertMeticulousProfile(input);
  }
  // Gaggiuino signature: waterTemperature + phases[].
  if (input.waterTemperature !== undefined && Array.isArray(input.phases)) {
    return parseJsonProfile(input);
  }
  return input;
}

function parseJsonProfile(input) {
  if (input.waterTemperature) {
    let profile = {
      label: input.name,
      type: 'pro',
      temperature: input.waterTemperature,
      phases: [],
    };

    let isPositive = function (v) {
      return typeof v === 'number' && v > 0 && Number.isFinite(v);
    };

    for (let i = 0; i < input.phases.length; i++) {
      let p = input.phases[i];
      let phase = {
        name: p && typeof p.name === 'string' && p.name.trim() ? p.name : `Phase ${i + 1}`,
        valve: 1,
        pump: 0,
        duration: Math.max(p.target.time, p.stopConditions.time) / 1000,
        targets: [],
        temperature: isPositive(p.waterTemperature) ? p.waterTemperature : 0,
        transition: {
          type: p.target.curve.toLowerCase().replace('_', '-'),
          duration: p.target.time / 1000,
          adaptive: true,
        },
      };
      if (p.target.end > 0) {
        if (p.type == 'PRESSURE') {
          phase.pump = {
            target: 'pressure',
            pressure: p.target.end,
            flow: p.restriction,
          };
        } else {
          phase.pump = {
            target: 'flow',
            pressure: p.restriction,
            flow: p.target.end,
          };
        }
      }

      const conditions = p.stopConditions || {};
      if (isPositive(conditions.pressureAbove)) {
        phase.targets.push({ type: 'pressure', value: conditions.pressureAbove });
      }
      if (isPositive(conditions.pressureBelow)) {
        phase.targets.push({ type: 'pressure', operator: 'lte', value: conditions.pressureBelow });
      }
      if (isPositive(conditions.flowAbove)) {
        phase.targets.push({ type: 'flow', value: conditions.flowAbove });
      }
      if (isPositive(conditions.flowBelow)) {
        phase.targets.push({ type: 'flow', operator: 'lte', value: conditions.flowBelow });
      }
      if (isPositive(conditions.weight)) {
        phase.targets.push({ type: 'volumetric', value: conditions.weight });
      } else if (isPositive(input.globalStopConditions?.weight)) {
        phase.targets.push({ type: 'volumetric', value: input.globalStopConditions.weight });
      }
      if (isPositive(conditions.waterPumpedInPhase)) {
        phase.targets.push({ type: 'pumped', value: conditions.waterPumpedInPhase });
      }

      profile.phases.push(phase);
    }

    return profile;
  }
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
    isTimeAxis && points.length >= 2 ? Math.max(0, points[points.length - 1][0] - points[0][0]) : 0;
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

  // Apply final_weight to every phase as a global overflow cap.
  //
  // Why every phase, not just the last brew phase?
  // - Matches the behaviour of the existing Gaggiuino importer
  //   (`globalStopConditions.weight` fallback in the per-phase loop), so both
  //   JSON paths produce profiles with the same shape.
  // - Meticulous/DE semantics would gate the global weight stop until after
  //   preinfusion frames (those platforms have their own safety nets that
  //   prevent overflow during pre-wet). Gaggia Classic and similar hardware
  //   the firmware targets have no such safety nets — broadcasting the cap
  //   to every phase prevents the cup overflowing on a broken/missing puck
  //   or channeled shot where flow becomes excessive before reaching the
  //   final phase.
  // - In a normal shot the cap only fires during the last brew phase anyway
  //   (preinfusion typically produces 0-5 g of output), so the broader cap
  //   is invisible when things are working. It only kicks in as a failsafe.
  // - Profile authors who want per-phase weight stops can still set them via
  //   per-frame `weight` exit_triggers (handled in buildTargets() above) —
  //   those take precedence because they are placed first.
  if (isPositive(input.final_weight)) {
    for (const phase of profile.phases) {
      phase.targets = phase.targets || [];
      const hasVolumetric = phase.targets.some(t => t.type === 'volumetric');
      if (!hasVolumetric) {
        phase.targets.push({ type: 'volumetric', operator: 'gte', value: input.final_weight });
      }
    }
  }

  return profile;
}
