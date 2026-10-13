import { msg, t } from '@lingui/core/macro';
import { i18n } from '../../../../i18n.js';
import { utilityColors } from '../../utils/analyzerUtils';

const NEUTRAL_STATUS_BADGE_CLASS = 'bg-base-content/10 text-base-content/80 border-base-content/15';
const WARNING_BADGE_HIGH_SCALE_LABEL = msg`HIGH SCALE DELAY`;
const WARNING_BADGE_SCALE_LOST_LABEL = msg`SCALE LOST`;
const WARNING_BADGE_SLOW_SAMPLING_LABEL = msg`SLOW SAMPLING`;

const WARNING_HELP_COPY = {
  delayReview: msg`Review the stop reason for this phase. The algorithm was only able to identify it after several intermediate calculations.`,
  highScaleDelay: msg`The configured or inferred scale delay is unusually high. Review the scale-delay setting before relying on predictive weight stops.`,
  scaleLost: msg`Shown when the scale briefly loses connection during the brew. In this case, weight is ignored for stop detection for that brew, even if the scale reconnects later.`,
  slowSampling: msg`Excessive delay while writing samples. Possible causes include a slow SD card or high OS/system load.`,
};

function getDelayReviewLabel(results) {
  const phaseNumber = results?.delayReviewPhaseNumber;
  return phaseNumber ? t`REVIEW PHASE ${phaseNumber}` : t`PHASE REVIEW ADVISED`;
}

export function buildAnalysisWarningBadges(results) {
  const badges = [];

  if (results?.hasSlowSampleInterval) {
    const rawMaxIntervalMs = results.maxSampleIntervalMs;
    const maxIntervalMs = rawMaxIntervalMs == null ? null : Number(rawMaxIntervalMs);
    const intervalSuffix =
      Number.isFinite(maxIntervalMs) && maxIntervalMs > 0
        ? ` (${Math.round(maxIntervalMs)} ms)`
        : '';
    badges.push({
      key: 'slow-sampling',
      label: `${i18n._(WARNING_BADGE_SLOW_SAMPLING_LABEL)}${intervalSuffix}`,
      colorClass: 'text-white shadow-sm',
      details: i18n._(WARNING_HELP_COPY.slowSampling),
      style: {
        backgroundColor: utilityColors.warningOrange,
        borderColor: utilityColors.warningOrange,
      },
    });
  }

  if (results?.globalScaleLost) {
    badges.push({
      key: 'scale-lost',
      label: i18n._(WARNING_BADGE_SCALE_LOST_LABEL),
      colorClass: 'text-white shadow-sm',
      details: i18n._(WARNING_HELP_COPY.scaleLost),
      style: {
        backgroundColor: utilityColors.warningOrange,
        borderColor: utilityColors.warningOrange,
      },
    });
  }

  if (results?.highScaleDelay) {
    const delaySuffix = results.highScaleDelayMs ? ` (${results.highScaleDelayMs} ms)` : '';
    badges.push({
      key: 'high-scale-delay',
      label: `${i18n._(WARNING_BADGE_HIGH_SCALE_LABEL)}${delaySuffix}`,
      colorClass: 'text-white shadow-sm',
      details: i18n._(WARNING_HELP_COPY.highScaleDelay),
      style: {
        backgroundColor: utilityColors.warningOrange,
        borderColor: utilityColors.warningOrange,
      },
    });
  }

  if (results?.delayReviewHint) {
    badges.push({
      key: 'delay-review',
      label: getDelayReviewLabel(results),
      colorClass: NEUTRAL_STATUS_BADGE_CLASS,
      details: results.delayReviewMessage || i18n._(WARNING_HELP_COPY.delayReview),
    });
  }

  return badges;
}

function stripTrailingParentheticalSuffix(value) {
  const label = String(value || '');
  const suffixStart = label.lastIndexOf(' (');
  if (suffixStart < 0 || !label.endsWith(')')) return label;
  return label.slice(0, suffixStart);
}

function getAnalysisHeaderBaseLabel(col) {
  if (col.id === 'duration') return t`Time`;
  if (col.id === 'water') return t`Pumped Water (phase)`;
  if (col.id === 'weight') return t`Weight (total)`;
  if (col.group === 'flow') return t`Pump Flow`;
  if (col.group === 'target_flow') return t`Target Pump Flow`;
  if (col.group === 'puckflow') return t`Puck Flow`;
  if (col.group === 'temp') return t`Temperature`;
  if (col.group === 'target_temp') return t`Target Temp`;
  return stripTrailingParentheticalSuffix(col.label);
}

export function getAnalysisHeaderLabel(col) {
  const suffixByType = {
    se: ` ${t({ message: 'S/E', context: 'column type, short for start/end' })}`,
    mm: ` ${t({ message: 'Min/Max', context: 'column type' })}`,
    avg: ` ${t({ message: 'Avg ∅', context: 'column type' })}`,
  };

  return `${getAnalysisHeaderBaseLabel(col)}${suffixByType[col.type] || ''}`;
}

function getCompareAccentColor(entry, index) {
  return entry?.accentColor || (index === 0 ? 'var(--color-primary)' : 'var(--color-secondary)');
}

function getCompareAccentStrength(entry) {
  return Number.isFinite(Number(entry?.accentStrength)) ? Number(entry.accentStrength) : 1;
}

export function getCompareRowStyle(entry, index) {
  const strength = getCompareAccentStrength(entry);
  const statusbarStrength = Math.round(100 * strength);
  const accentColor = getCompareAccentColor(entry, index);

  return {
    '--compare-shot-color': accentColor,
    '--analyzer-compare-shot-color': accentColor,
    '--compare-shot-label-color': `${statusbarStrength}%`,
    '--compare-shot-marker-opacity': '1',
  };
}

export function getMaxComparePhaseCount(compareMode, compareEntries) {
  if (!compareMode) return 0;
  return Math.max(...compareEntries.map(entry => entry?.results?.phases?.length || 0), 0);
}

export function hasAnalysisProfilePhaseStops(results) {
  return Boolean(results?.phases?.some(phase => phase.exit?.reason));
}
