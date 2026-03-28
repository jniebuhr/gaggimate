// Thresholds per roast type: time in seconds, ratio = doseOut/doseIn
const THRESHOLDS = {
  light: {
    idealTimeMin: 27,
    idealTimeMax: 40,
    fastTime: 22,
    slowTime: 45,
    idealRatioMin: 1.8,
    idealRatioMax: 2.8,
  },
  medium: {
    idealTimeMin: 25,
    idealTimeMax: 35,
    fastTime: 20,
    slowTime: 40,
    idealRatioMin: 1.5,
    idealRatioMax: 2.5,
  },
  dark: {
    idealTimeMin: 20,
    idealTimeMax: 30,
    fastTime: 18,
    slowTime: 35,
    idealRatioMin: 1.2,
    idealRatioMax: 2.2,
  },
};

const ROAST_TIPS = {
  light:
    'Light roasts are dense and need more work to extract. Try a finer grind, higher temperature (92–95°C), and a longer ratio (1:2–1:3) to develop sweetness and complexity.',
  medium:
    'Medium roasts are versatile. Standard espresso parameters (1:2 ratio, 25–35s, 90–93°C) usually work well as a starting point.',
  dark:
    'Dark roasts extract quickly and easily go bitter. Try a coarser grind, shorter ratio (1:1.5–1:2), lower temperature (86–90°C), and a shorter shot time (20–30s).',
};

function getThresholds(roastType) {
  return THRESHOLDS[roastType] || THRESHOLDS.medium;
}

function classifyTime(durationSec, t) {
  if (durationSec < t.fastTime) return 'very_fast';
  if (durationSec < t.idealTimeMin) return 'fast';
  if (durationSec > t.slowTime) return 'very_slow';
  if (durationSec > t.idealTimeMax) return 'slow';
  return 'ideal';
}

function classifyRatio(ratio, t) {
  if (ratio < t.idealRatioMin * 0.85) return 'very_low';
  if (ratio < t.idealRatioMin) return 'low';
  if (ratio > t.idealRatioMax * 1.15) return 'very_high';
  if (ratio > t.idealRatioMax) return 'high';
  return 'ideal';
}

function analyzeGrind(durationSec, timeClass, roastLabel) {
  switch (timeClass) {
    case 'very_fast':
      return {
        verdict: 'finer',
        label: 'Grind Finer',
        color: 'warning',
        message: `Shot ran fast at ${durationSec.toFixed(1)}s — well below the ideal range for a ${roastLabel} roast. Grind finer to slow extraction and improve evenness.`,
      };
    case 'fast':
      return {
        verdict: 'finer',
        label: 'Grind Finer',
        color: 'warning',
        message: `Shot ran a bit fast at ${durationSec.toFixed(1)}s for a ${roastLabel} roast. Try grinding slightly finer.`,
      };
    case 'very_slow':
      return {
        verdict: 'coarser',
        label: 'Grind Coarser',
        color: 'warning',
        message: `Shot ran slow at ${durationSec.toFixed(1)}s — well above the ideal range for a ${roastLabel} roast. Grind coarser to speed extraction.`,
      };
    case 'slow':
      return {
        verdict: 'coarser',
        label: 'Grind Coarser',
        color: 'warning',
        message: `Shot ran a bit slow at ${durationSec.toFixed(1)}s for a ${roastLabel} roast. Try grinding slightly coarser.`,
      };
    default:
      return {
        verdict: 'good',
        label: 'Grind is Good',
        color: 'success',
        message: `Shot time ${durationSec.toFixed(1)}s is in the ideal range for a ${roastLabel} roast. Grind looks dialled in.`,
      };
  }
}

function analyzeExtraction(taste, timeClass) {
  const isFast = timeClass === 'fast' || timeClass === 'very_fast';
  const isSlow = timeClass === 'slow' || timeClass === 'very_slow';

  if (taste === 'sour') {
    if (isSlow) {
      return {
        verdict: 'under',
        label: 'Under-extracted',
        color: 'error',
        message:
          'Sour taste with a slow shot is unusual — check your dose, distribution, and whether the puck is restricting flow unevenly.',
      };
    }
    return {
      verdict: 'under',
      label: 'Under-extracted',
      color: 'error',
      message:
        'Sour or sharp flavours usually point to under-extraction. A finer grind, longer ratio, or higher temperature can help.',
    };
  }

  if (taste === 'bitter') {
    if (isFast) {
      return {
        verdict: 'over',
        label: 'Over-extracted',
        color: 'error',
        message:
          'Bitter taste with a fast shot is unusual — check your dose and puck prep. A shorter ratio may also help.',
      };
    }
    return {
      verdict: 'over',
      label: 'Over-extracted',
      color: 'error',
      message:
        'Harsh bitterness usually means the shot extracted too much. Try grinding coarser, pulling shorter, or lowering temperature.',
    };
  }

  // Taste is balanced — time is secondary
  if (isFast) {
    return {
      verdict: 'light',
      label: 'Light, but Tasty',
      color: 'info',
      message:
        'Shot ran fast but tasted balanced — likely a lighter, brighter style. You could try grinding slightly finer for more body.',
    };
  }
  if (isSlow) {
    return {
      verdict: 'heavy',
      label: 'Heavy, but Tasty',
      color: 'info',
      message:
        'Shot ran slow but tasted balanced — possibly on the edge. Try grinding slightly coarser to see if it opens up.',
    };
  }
  return {
    verdict: 'on-track',
    label: 'On Track',
    color: 'success',
    message: 'Taste and time both look good — extraction seems well balanced.',
  };
}

function analyzeStrength(ratio, ratioClass) {
  const r = ratio.toFixed(2);
  switch (ratioClass) {
    case 'very_low':
      return {
        verdict: 'very_concentrated',
        label: 'Very Concentrated',
        color: 'warning',
        message: `Ratio 1:${r} is very tight — ristretto territory. Expect an intense, syrupy cup. Pull more yield if you want something more balanced.`,
      };
    case 'low':
      return {
        verdict: 'concentrated',
        label: 'Concentrated',
        color: 'info',
        message: `Ratio 1:${r} is on the short side — rich and full-bodied. This is intentional for some styles, otherwise pull a touch more.`,
      };
    case 'very_high':
      return {
        verdict: 'very_diluted',
        label: 'Very Diluted',
        color: 'warning',
        message: `Ratio 1:${r} is very long — lungo territory. The cup may taste thin and watery. Stop the shot earlier or increase dose.`,
      };
    case 'high':
      return {
        verdict: 'diluted',
        label: 'Slightly Diluted',
        color: 'info',
        message: `Ratio 1:${r} is on the long side — lighter body. Try stopping the shot a bit earlier if you want more intensity.`,
      };
    default:
      return {
        verdict: 'balanced',
        label: 'Balanced Strength',
        color: 'success',
        message: `Ratio 1:${r} sits in the classic espresso range — strength looks good.`,
      };
  }
}

function getAdvancedHints(shot) {
  const hints = [];
  if (!shot?.samples || shot.samples.length === 0) return hints;

  const samples = shot.samples;

  // First drip timing from weight data
  const firstDripSample = samples.find(s => (s.v ?? 0) >= 0.3 || (s.ev ?? 0) >= 0.3);
  if (firstDripSample) {
    const firstDripSec = firstDripSample.t / 1000;
    if (firstDripSec < 5) {
      hints.push({
        type: 'fast_drip',
        message: `First drip at ${firstDripSec.toFixed(1)}s — quite early. Pre-infusion or a finer grind may improve even extraction.`,
      });
    } else if (firstDripSec > 16) {
      hints.push({
        type: 'slow_drip',
        message: `First drip at ${firstDripSec.toFixed(1)}s — unusually late. Check for over-tamping or an excessively fine grind.`,
      });
    }
  }

  // Pressure analysis
  const pressureSamples = samples.filter(s => s.cp != null && s.cp > 0);
  if (pressureSamples.length > 10) {
    const peakPressure = Math.max(...pressureSamples.map(s => s.cp));
    if (peakPressure > 11) {
      hints.push({
        type: 'pressure_spike',
        message: `Peak pressure reached ${peakPressure.toFixed(1)} bar — very high. Check your puck prep and distribution.`,
      });
    }

    // Channeling heuristic: significant pressure variance in the brew phase
    // Skip early ramp-up (first 20% of samples)
    const brewStart = Math.floor(pressureSamples.length * 0.2);
    const brewSamples = pressureSamples.slice(brewStart);
    if (brewSamples.length > 8) {
      const brewPeak = Math.max(...brewSamples.map(s => s.cp));
      const brewAvg = brewSamples.reduce((sum, s) => sum + s.cp, 0) / brewSamples.length;
      if (brewPeak > 5 && brewPeak > brewAvg * 1.4) {
        hints.push({
          type: 'channeling',
          message:
            'Pressure spiked significantly during extraction — possible channeling. Try improving grind distribution and puck prep.',
        });
      }
    }
  }

  return hints;
}

/**
 * Analyse a shot and produce barista-style feedback.
 *
 * @param {object} shot  - Parsed shot object (duration, samples, volume)
 * @param {object} notes - Shot notes (doseIn, doseOut, ratio, balanceTaste, roastType)
 * @returns {object} Feedback result
 */
export function analyzeShotFeedback(shot, notes) {
  const durationSec = (shot?.duration ?? 0) / 1000;

  if (!durationSec) {
    return { canAnalyze: false, reason: 'no_duration' };
  }

  const roastType = notes?.roastType || '';
  const roastLabel = roastType || 'standard';
  const thresholds = getThresholds(roastType);

  const doseIn = parseFloat(notes?.doseIn) || 0;
  const doseOut = parseFloat(notes?.doseOut) || (shot?.volume ?? 0);
  const ratio = doseIn > 0 && doseOut > 0 ? doseOut / doseIn : parseFloat(notes?.ratio) || 0;
  const taste = notes?.balanceTaste || 'balanced';

  const timeClass = classifyTime(durationSec, thresholds);
  const ratioClass = ratio > 0 ? classifyRatio(ratio, thresholds) : null;

  const grind = analyzeGrind(durationSec, timeClass, roastLabel);
  const extraction = analyzeExtraction(taste, timeClass);
  const strength = ratio > 0 ? analyzeStrength(ratio, ratioClass) : null;
  const roastTip = roastType ? ROAST_TIPS[roastType] || null : null;
  const advancedHints = getAdvancedHints(shot);

  const missingData = [];
  if (!doseIn) missingData.push('dose in');
  if (!doseOut) missingData.push('dose out');

  return {
    canAnalyze: true,
    grind,
    extraction,
    strength,
    roastTip,
    roastType,
    advancedHints,
    missingData,
    durationSec,
    ratio,
  };
}
