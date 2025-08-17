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
  static _uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0,
        v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  static _getTclVal(tclText, key) {
    const match = tclText.match(new RegExp(`^${key}\\s+([\\d.]+)`, 'm'));
    return parseFloat(match?.[1] || 0);
  }

  static _generateDebugInfo(profile, tclText, parserType) {
    const profileTypeMatch = tclText.match(/settings_profile_type\s+(\w+)/);
    const sourceProfileType = profileTypeMatch ? profileTypeMatch[1] : 'unknown';

    let totalMaxDuration = 0;
    let brewingMaxDuration = 0;

    const phaseSummary = profile.phases.map(p => {
      totalMaxDuration += p.duration;
      if (p.phase === 'brew') {
        brewingMaxDuration += p.duration;
      }
      const targetStrings =
        p.targets?.map(t => `${t.type} ${t.operator === 'gte' ? '>' : '<'} ${t.value}`) || [];
      return {
        name: p.name,
        maxDuration: p.duration,
        targets: targetStrings.join(', ') || 'timeout only',
      };
    });

    return {
      parser: parserType,
      sourceProfileType: sourceProfileType,
      phasesCount: profile.phases.length,
      totalMaxDuration: parseFloat(totalMaxDuration.toFixed(2)),
      brewingMaxDuration: parseFloat(brewingMaxDuration.toFixed(2)),
      phaseSummary: phaseSummary,
    };
  }

  static _generatePhasesFromSimpleProfile(tclText, profile) {
    // Implementation from previous version...
    const get = key => this._getTclVal(tclText, key);
    const preinfusionTime = get('preinfusion_time');
    const preinfusionFlow = get('preinfusion_flow_rate');
    const preinfusionStopPressure = get('preinfusion_stop_pressure');
    const holdTime = get('espresso_hold_time');
    const holdPressure = get('espresso_pressure');
    const declineTime = get('espresso_decline_time');
    const declineEndPressure = get('pressure_end');
    const targetWeight = get('final_desired_shot_weight');

    if (preinfusionTime > 0) {
      profile.phases.push({
        name: 'Pre-infusion',
        phase: 'preinfusion',
        valve: 1,
        duration: preinfusionTime,
        pump: { target: 'flow', pressure: 1.0, flow: preinfusionFlow },
        targets: [{ type: 'pressure', operator: 'gte', value: preinfusionStopPressure }],
      });
    }
    if (holdTime > 0) {
      profile.phases.push({
        name: 'Hold',
        phase: 'brew',
        valve: 1,
        duration: holdTime,
        pump: { target: 'pressure', pressure: holdPressure, flow: 0 },
      });
    }
    if (declineTime > 0) {
      profile.phases.push({
        name: 'Decline',
        phase: 'brew',
        valve: 1,
        duration: declineTime,
        pump: { target: 'pressure', pressure: declineEndPressure, flow: 0 },
      });
    }
    if (targetWeight > 0 && profile.phases.length > 0) {
      const lastPhase = profile.phases[profile.phases.length - 1];
      if (!lastPhase.targets) lastPhase.targets = [];
      lastPhase.targets.push({ type: 'volumetric', value: targetWeight });
    }
    return profile;
  }

  static _parseAdvancedProfile(tclText, profile) {
    // Implementation from previous version...
    const advancedShotMatch = tclText.match(/advanced_shot\s+{{(.*)}}/s);
    if (!advancedShotMatch) return this._fail("Could not find 'advanced_shot' block in TCL input.");
    const phasesText = advancedShotMatch[1].trim();
    const phaseBlocks = phasesText ? phasesText.split(/}\s*{/) : [];
    for (const block of phaseBlocks) {
      const phaseData = {};
      const regex = /(\w+|\{[^}]+\})\s+([^{}\s]+|{[^}]+})/g;
      let match;
      while ((match = regex.exec(block)) !== null) {
        phaseData[match[1].replace(/{|}/g, '')] = match[2].replace(/{|}/g, '');
      }
      if (!phaseData.name) continue;
      const preinfusionKeywords = ['fill', 'preinfu', 'soak', 'bloom'];
      const isPreinfusion = preinfusionKeywords.some(kw =>
        phaseData.name.toLowerCase().includes(kw),
      );
      const newPhase = {
        name: phaseData.name,
        phase: isPreinfusion ? 'preinfusion' : 'brew',
        valve: 1,
        duration: parseFloat(phaseData.seconds) || 0,
        pump: {
          target: phaseData.pump === 'flow' ? 'flow' : 'pressure',
          pressure: parseFloat(phaseData.pressure) || 0,
          flow: phaseData.pump === 'flow' ? parseFloat(phaseData.max_flow_or_pressure) || 0 : 0,
        },
        transition: { type: 'instant' },
      };
      if (phaseData.transition === 'smooth') {
        newPhase.transition = {
          type: 'ease-in-out',
          duration: newPhase.duration,
          adaptive: true,
        };
      }
      if (phaseData.temperature) newPhase.temperature = parseFloat(phaseData.temperature);
      const targets = [];
      if (phaseData.volume && parseFloat(phaseData.volume) > 0)
        targets.push({ type: 'volumetric', value: parseFloat(phaseData.volume) });
      const exitType = phaseData.exit_type;
      if (exitType && phaseData.exit_if === '1') {
        let targetType, operator, valueKey;
        if (exitType.includes('pressure')) targetType = 'pressure';
        if (exitType.includes('flow')) targetType = 'flow';
        if (exitType.includes('over')) {
          operator = 'gte';
          valueKey = `exit_${targetType}_over`;
        } else if (exitType.includes('under')) {
          operator = 'lte';
          valueKey = `exit_${targetType}_under`;
        }
        if (targetType && operator && phaseData[valueKey])
          targets.push({
            type: targetType,
            operator: operator,
            value: parseFloat(phaseData[valueKey]),
          });
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
    const titleMatch = tclText.match(/profile_title\s+{([^}]+)}/);
    if (titleMatch) profile.label = titleMatch[1].trim();
    const notesMatch = tclText.match(/profile_notes\s+{([^}]+)}/s);
    if (notesMatch) profile.description = notesMatch[1].trim().replace(/\s+/g, ' ');
    profile.temperature = this._getTclVal(tclText, 'espresso_temperature');
    const profileTypeMatch = tclText.match(/settings_profile_type\s+(\w+)/);
    const profileType = profileTypeMatch ? profileTypeMatch[1] : 'settings_2a';

    const parserType = profileType === 'settings_2c' ? 'Advanced' : 'Simple';
    let resultProfile;

    if (parserType === 'Advanced') {
      resultProfile = this._parseAdvancedProfile(tclText, profile);
    } else {
      resultProfile = this._generatePhasesFromSimpleProfile(tclText, profile);
    }

    if (resultProfile.ok === false) return resultProfile;
    if (resultProfile.phases.length === 0)
      return this._fail('TCL parsing resulted in zero valid phases.');

    // *** ADD DEBUG INFO IF ENABLED ***
    if (this.debug === 1) {
      resultProfile.debug = this._generateDebugInfo(resultProfile, tclText, parserType);
    }

    return resultProfile;
  }

  static _validate(profile) {
    return { isValid: true };
  } // Simplified for brevity

  static toGaggiMate(text) {
    if (!text || typeof text !== 'string' || text.trim().length === 0)
      return this._fail('Input is empty or invalid.');
    const cleanText = text.replace(/^\uFEFF/, '').trim();

    const profileObject = this._parseTcl(cleanText);
    if (profileObject.ok === false) return profileObject;

    const validation = this._validate(profileObject);
    if (!validation.isValid) return this._fail(`Validation Error: ${validation.message}`);

    try {
      return this._succeed(profileObject);
    } catch (e) {
      return this._fail(`JSON serialization failed: ${e.message}`);
    }
  }
}
