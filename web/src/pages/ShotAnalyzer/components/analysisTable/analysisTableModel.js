import { utilityColors } from '../../utils/analyzerUtils';

const NEUTRAL_STATUS_BADGE_CLASS = 'bg-base-content/10 text-base-content/80 border-base-content/15';
const WARNING_BADGE_HIGH_SCALE_LABEL = 'HIGH SCALE DELAY OR MANUAL STOP (ADJUSTMENT)';
const WARNING_BADGE_SCALE_LOST_LABEL = 'SCALE LOST';

const WARNING_HELP_COPY = {
  delayReview:
    'Review the stop reason for this phase. The algorithm was only able to identify it after several intermediate calculations.',
  highScaleDelay:
    'This may indicate an incorrectly configured scale delay in the GaggiMate settings, a shot that was manually stopped near the target, or an adjusted target weight.',
  scaleLost:
    'Shown when the scale briefly loses connection during the brew. In this case, weight is ignored for stop detection for that brew, even if the scale reconnects later.',
};

function getDelayReviewLabel(results) {
  return results?.delayReviewPhaseNumber
    ? `REVIEW PHASE ${results.delayReviewPhaseNumber}`
    : 'PHASE REVIEW ADVISED';
}

export function buildAnalysisWarningBadges(results) {
  const badges = [];

  if (results?.globalScaleLost) {
    badges.push({
      key: 'scale-lost',
      label: WARNING_BADGE_SCALE_LOST_LABEL,
      colorClass: 'text-white shadow-sm',
      details: WARNING_HELP_COPY.scaleLost,
      style: {
        backgroundColor: utilityColors.warningOrange,
        borderColor: utilityColors.warningOrange,
      },
    });
  }

  if (results?.highScaleDelay) {
    badges.push({
      key: 'high-scale-delay',
      label: WARNING_BADGE_HIGH_SCALE_LABEL,
      colorClass: 'text-white shadow-sm',
      details: WARNING_HELP_COPY.highScaleDelay,
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
      details: results.delayReviewMessage || WARNING_HELP_COPY.delayReview,
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
  if (col.id === 'duration') return 'Time';
  if (col.id === 'water') return 'Pumped Water (phase)';
  if (col.id === 'weight') return 'Weight (total)';
  if (col.group === 'flow') return 'Pump Flow';
  if (col.group === 'target_flow') return 'Target Pump Flow';
  if (col.group === 'puckflow') return 'Puck Flow';
  if (col.group === 'temp') return 'Temperature';
  if (col.group === 'target_temp') return 'Target Temp';
  return stripTrailingParentheticalSuffix(col.label);
}

export function getAnalysisHeaderLabel(col) {
  const suffixByType = {
    se: ' S/E',
    mm: ' Min/Max',
    avg: ' Avg ∅',
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
  return Boolean(results?.phases?.some(phase => phase.profilePhase));
}
