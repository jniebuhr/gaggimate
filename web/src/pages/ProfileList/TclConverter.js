export class TclConverter {
  /**
   * @type {number} Set to 1 to include a 'debug' object in the output JSON.
   */
  static debug = 0;

  static _fail(reason) {
    return { ok: false, reason };
  }
  static _succeed(json) {
    return { ok: true, json };
  }

  static _getTclVal(tclText, key, defaultValue = 0) {
    const match = tclText.match(new RegExp(`^${key}\\s+([\\d.]+)`, 'm'));
    if (!match) return defaultValue;
    const parsed = parseFloat(match[1]);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }

  static _getTclString(tclText, key) {
    const braced = tclText.match(new RegExp(`^${key}\\s+\\{([^}]*)\\}`, 'm'));
    if (braced) return braced[1].trim();
    const bare = tclText.match(new RegExp(`^${key}\\s+(\\S+)`, 'm'));
    return bare ? bare[1].trim() : null;
  }

  /**
   * Mirrors `fix_profile_type` in DE's `de1plus/profile.tcl`.
   */
  static _normalizeProfileType(rawType) {
    if (!rawType) return 'settings_2a';
    switch (rawType) {
      case 'settings_2':
      case 'settings_profile_pressure':
      case 'settings_2a':
        return 'settings_2a';
      case 'settings_profile_flow':
      case 'settings_2b':
        return 'settings_2b';
      case 'settings_2c':
      case 'settings_2c2':
      case 'settings_profile_advanced':
        return 'settings_2c';
      default:
        return rawType;
    }
  }

  static _toSafeFloat(value, fallback) {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  static _clampDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return 0.5;
    return Math.max(0.5, Math.min(300, seconds));
  }

  static _generateDebugInfo(profile, tclText, parserType) {
    const sourceProfileType = this._getTclString(tclText, 'settings_profile_type') || 'unknown';

    let totalMaxDuration = 0;
    let brewingMaxDuration = 0;

    const phaseSummary = profile.phases.map(p => {
      totalMaxDuration += p.duration;
      if (p.phase === 'brew') {
        brewingMaxDuration += p.duration;
      }
      const targetStrings =
        p.targets?.map(t => `${t.type} ${t.operator === 'lte' ? '<' : '>'} ${t.value}`) || [];
      return {
        name: p.name,
        maxDuration: p.duration,
        targets: targetStrings.join(', ') || 'timeout only',
      };
    });

    return {
      parser: parserType,
      sourceProfileType,
      phasesCount: profile.phases.length,
      totalMaxDuration: parseFloat(totalMaxDuration.toFixed(2)),
      brewingMaxDuration: parseFloat(brewingMaxDuration.toFixed(2)),
      phaseSummary,
    };
  }

  static _generatePhasesFromPressureProfile(tclText, profile) {
    const get = key => this._getTclVal(tclText, key);
    const preinfusionTime = get('preinfusion_time');
    const preinfusionFlow = get('preinfusion_flow_rate');
    const preinfusionStopPressure = get('preinfusion_stop_pressure');
    const holdTime = get('espresso_hold_time');
    const holdPressure = get('espresso_pressure');
    const declineTime = get('espresso_decline_time');
    const declineEndPressure = get('pressure_end');

    if (preinfusionTime > 0) {
      const phase = {
        name: 'Pre-infusion',
        phase: 'preinfusion',
        valve: 1,
        duration: this._clampDuration(preinfusionTime),
        pump: { target: 'flow', pressure: 0, flow: preinfusionFlow },
      };
      if (preinfusionStopPressure > 0) {
        phase.targets = [{ type: 'pressure', operator: 'gte', value: preinfusionStopPressure }];
      }
      profile.phases.push(phase);
    }
    if (holdTime > 0) {
      profile.phases.push({
        name: 'Hold',
        phase: 'brew',
        valve: 1,
        duration: this._clampDuration(holdTime),
        pump: { target: 'pressure', pressure: holdPressure, flow: 0 },
      });
    }
    if (declineTime > 0) {
      const declineDuration = this._clampDuration(declineTime);
      profile.phases.push({
        name: 'Decline',
        phase: 'brew',
        valve: 1,
        duration: declineDuration,
        transition: { type: 'linear', duration: declineDuration, adaptive: true },
        pump: { target: 'pressure', pressure: declineEndPressure, flow: 0 },
      });
    }
    return profile;
  }

  static _generatePhasesFromFlowProfile(tclText, profile) {
    const get = key => this._getTclVal(tclText, key);
    const preinfusionTime = get('flow_profile_preinfusion_time') || get('preinfusion_time');
    const preinfusionFlow = get('flow_profile_preinfusion') || get('preinfusion_flow_rate');
    const preinfusionStopPressure = get('preinfusion_stop_pressure');
    const holdTime = get('flow_profile_hold_time') || get('espresso_hold_time');
    const holdFlow = get('flow_profile_hold');
    const declineTime = get('flow_profile_decline_time') || get('espresso_decline_time');
    const declineEndFlow = get('flow_profile_decline');

    if (preinfusionTime > 0 && preinfusionFlow > 0) {
      const phase = {
        name: 'Pre-infusion',
        phase: 'preinfusion',
        valve: 1,
        duration: this._clampDuration(preinfusionTime),
        pump: { target: 'flow', pressure: 0, flow: preinfusionFlow },
      };
      if (preinfusionStopPressure > 0) {
        phase.targets = [{ type: 'pressure', operator: 'gte', value: preinfusionStopPressure }];
      }
      profile.phases.push(phase);
    }
    if (holdTime > 0 && holdFlow > 0) {
      profile.phases.push({
        name: 'Hold',
        phase: 'brew',
        valve: 1,
        duration: this._clampDuration(holdTime),
        pump: { target: 'flow', pressure: 0, flow: holdFlow },
      });
    }
    if (declineTime > 0 && declineEndFlow > 0) {
      const declineDuration = this._clampDuration(declineTime);
      profile.phases.push({
        name: 'Decline',
        phase: 'brew',
        valve: 1,
        duration: declineDuration,
        transition: { type: 'linear', duration: declineDuration, adaptive: true },
        pump: { target: 'flow', pressure: 0, flow: declineEndFlow },
      });
    }
    return profile;
  }

  static _mapTransitionType(value) {
    if (value === 'smooth') return 'linear';
    return 'instant';
  }

  static _parseAdvancedProfile(tclText, profile) {
    const advancedShotMatch = tclText.match(/advanced_shot\s+{{(.*)}}/s);
    if (!advancedShotMatch) return this._fail("Could not find 'advanced_shot' block in TCL input.");
    const phasesText = advancedShotMatch[1].trim();
    const phaseBlocks = phasesText ? phasesText.split(/}\s*{/) : [];

    // Authoritative preinfusion split per DE: frames before count_start are preinfusion,
    // the rest are brew (regardless of frame name). Fall back to name-keyword sniffing
    // when count_start is 0 or missing.
    const countStart = Math.trunc(
      this._getTclVal(tclText, 'final_desired_shot_volume_advanced_count_start'),
    );
    const preinfusionKeywords = ['fill', 'preinfu', 'soak', 'bloom'];

    for (let index = 0; index < phaseBlocks.length; index++) {
      const block = phaseBlocks[index];
      const phaseData = {};
      const kvRegex = /(\w+|\{[^}]+\})\s+([^{}\s]+|{[^}]+})/g;
      let match;
      while ((match = kvRegex.exec(block)) !== null) {
        phaseData[match[1].replace(/{|}/g, '')] = match[2].replace(/{|}/g, '');
      }
      if (!phaseData.name) continue;

      const isPreinfusion = countStart > 0
        ? index < countStart
        : preinfusionKeywords.some(kw => phaseData.name.toLowerCase().includes(kw));

      const pumpMode = phaseData.pump === 'pressure' ? 'pressure' : 'flow';
      const setpointRaw =
        pumpMode === 'pressure'
          ? this._toSafeFloat(phaseData.pressure, -1)
          : this._toSafeFloat(phaseData.flow, -1);
      const limitRaw = this._toSafeFloat(phaseData.max_flow_or_pressure, 0);

      const newPhase = {
        name: phaseData.name,
        phase: isPreinfusion ? 'preinfusion' : 'brew',
        valve: 1,
        duration: this._clampDuration(this._toSafeFloat(phaseData.seconds, 0.5)),
        pump: {
          target: pumpMode,
          pressure: pumpMode === 'pressure' ? setpointRaw : limitRaw,
          flow: pumpMode === 'flow' ? setpointRaw : limitRaw,
        },
        transition: { type: 'instant', duration: 0, adaptive: false },
      };

      const transitionType = this._mapTransitionType(phaseData.transition);
      if (transitionType !== 'instant') {
        newPhase.transition = {
          type: transitionType,
          duration: newPhase.duration,
          adaptive: false,
        };
      }

      const temperatureValue = this._toSafeFloat(phaseData.temperature, 0);
      if (temperatureValue > 0) newPhase.temperature = temperatureValue;

      const targets = [];
      const pumpedVolume = this._toSafeFloat(phaseData.volume, 0);
      if (pumpedVolume > 0) {
        targets.push({ type: 'pumped', operator: 'gte', value: pumpedVolume });
      }
      const perPhaseWeight = this._toSafeFloat(phaseData.weight, 0);
      if (perPhaseWeight > 0) {
        targets.push({ type: 'volumetric', operator: 'gte', value: perPhaseWeight });
      }

      const exitType = phaseData.exit_type;
      if (exitType && phaseData.exit_if === '1') {
        let targetType;
        if (exitType.includes('pressure')) targetType = 'pressure';
        else if (exitType.includes('flow')) targetType = 'flow';
        let operator;
        let valueKey;
        if (exitType.includes('over')) {
          operator = 'gte';
          valueKey = `exit_${targetType}_over`;
        } else if (exitType.includes('under')) {
          operator = 'lte';
          valueKey = `exit_${targetType}_under`;
        }
        if (targetType && operator) {
          const exitValue = this._toSafeFloat(phaseData[valueKey], NaN);
          if (Number.isFinite(exitValue) && exitValue >= 0) {
            targets.push({ type: targetType, operator, value: exitValue });
          }
        }
      }

      if (targets.length > 0) newPhase.targets = targets;
      profile.phases.push(newPhase);
    }
    return profile;
  }

  static _parseTcl(tclText) {
    const profile = {
      label: 'Converted Profile',
      type: 'pro',
      description: '',
      temperature: 93,
      phases: [],
    };
    const title = this._getTclString(tclText, 'profile_title');
    if (title) profile.label = title;
    const notes = this._getTclString(tclText, 'profile_notes');
    if (notes) profile.description = notes.replace(/\s+/g, ' ');

    const espressoTemp = this._getTclVal(tclText, 'espresso_temperature');
    if (espressoTemp > 0) profile.temperature = espressoTemp;

    const rawType = this._getTclString(tclText, 'settings_profile_type');
    const normalizedType = this._normalizeProfileType(rawType);

    let parserType;
    let resultProfile;
    if (normalizedType === 'settings_2c') {
      parserType = 'Advanced';
      resultProfile = this._parseAdvancedProfile(tclText, profile);
    } else if (normalizedType === 'settings_2b') {
      parserType = 'SimpleFlow';
      resultProfile = this._generatePhasesFromFlowProfile(tclText, profile);
    } else {
      parserType = 'SimplePressure';
      resultProfile = this._generatePhasesFromPressureProfile(tclText, profile);
    }

    if (resultProfile.ok === false) return resultProfile;
    if (resultProfile.phases.length === 0)
      return this._fail('TCL parsing resulted in zero valid phases.');

    // Apply shot weight target to every phase as a global overflow cap.
    // DE itself only evaluates the global stop-on-weight after preinfusion
    // (device_scale.tcl gates on `current_framenumber >= number_of_preinfusion_steps`).
    // Applying it everywhere is more conservative than strict DE behavior, but Gaggia
    // Classic lacks the platform-level safety nets DE relies on; the broader cap is the
    // safer default for this hardware (overflow protection on broken/missing puck, etc).
    // Profile authors who want per-phase weight stops have the per-frame `weight` field
    // (handled separately during phase parsing).
    // Advanced profiles store the target in `_advanced`; simple profiles use the unsuffixed key.
    const advancedWeight = this._getTclVal(tclText, 'final_desired_shot_weight_advanced');
    const simpleWeight = this._getTclVal(tclText, 'final_desired_shot_weight');
    const shotWeight =
      normalizedType === 'settings_2c' && advancedWeight > 0 ? advancedWeight : simpleWeight;
    if (shotWeight > 0) {
      for (const phase of resultProfile.phases) {
        phase.targets = phase.targets || [];
        const hasVolumetric = phase.targets.some(t => t.type === 'volumetric');
        if (!hasVolumetric) {
          phase.targets.push({ type: 'volumetric', operator: 'gte', value: shotWeight });
        }
      }
    }

    if (this.debug === 1) {
      resultProfile.debug = this._generateDebugInfo(resultProfile, tclText, parserType);
    }

    return resultProfile;
  }

  static toGaggiMate(text) {
    if (!text || typeof text !== 'string' || text.trim().length === 0)
      return this._fail('Input is empty or invalid.');
    const cleanText = text.replace(/^\uFEFF/, '').trim();

    const profileObject = this._parseTcl(cleanText);
    if (profileObject.ok === false) return profileObject;

    return this._succeed(profileObject);
  }
}
