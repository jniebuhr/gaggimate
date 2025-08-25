import { TclConverter } from './TclConverter.js';

export function parseProfile(input) {
  try {
    let profiles = JSON.parse(input);
    if (!Array.isArray(profiles)) {
      profiles = parseJsonProfile(profiles);
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
