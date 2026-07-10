import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faCheck, faTimes } from '@fortawesome/free-solid-svg-icons';
import { getDisplayStopReasonParts, utilityColors } from '../../utils/analyzerUtils';

function getBrewModeLabel(isBrewByWeight) {
  return isBrewByWeight ? 'Brew by Weight' : 'Brew by Time';
}

export function ComparePhaseLabel({ phase, phaseIndex, results }) {
  if (!phase) {
    return <div className='text-base-content/45 leading-tight font-medium'>-</div>;
  }

  const { skipNotice, stopReason } = getDisplayStopReasonParts(phase.exit?.reason);

  return (
    <>
      <div className='text-base-content/90 mb-0.5 leading-none font-medium'>
        {phase.displayName}
      </div>
      {skipNotice ? (
        <div
          className='text-base-content/55 leading-tight font-medium'
          style={{ fontSize: '0.8em' }}
        >
          {skipNotice}
        </div>
      ) : null}
      {stopReason ? (
        <div className='font-normal' style={{ fontSize: '0.85em', color: utilityColors.stopRed }}>
          {stopReason}
        </div>
      ) : null}
      {phaseIndex === (results?.phases?.length || 0) - 1 && (
        <div
          className='text-base-content/55 leading-tight font-medium'
          style={{ fontSize: '0.8em' }}
        >
          {getBrewModeLabel(results.isBrewByWeight)}
        </div>
      )}
    </>
  );
}

const DIRECT_CELL_FIELDS = {
  duration: { path: 'duration', unit: 's' },
  water: { path: 'water', unit: 'ml' },
  weight: { path: 'weight', unit: 'g' },
};

const CELL_METRIC_UNITS = {
  p: 'bar',
  tp: 'bar',
  f: 'ml/s',
  tf: 'ml/s',
  pf: 'ml/s',
  t: '°C',
  tt: '°C',
  w: 'g',
  wf: 'g/s',
};

const CELL_METRIC_PARTS = {
  se: ['start', 'end'],
  mm: ['min', 'max'],
  avg: ['avg'],
};

const BOOLEAN_CELL_FIELDS = {
  sys_shot_vol: 'sys_shot_vol',
  sys_curr_vol: 'sys_curr_vol',
  sys_scale: 'sys_scale',
  sys_vol_avail: 'sys_vol_avail',
  sys_ext: 'sys_ext',
};

function formatCellNumber(value, digits = 1) {
  const numericValue = Number(value);
  return value != null && Number.isFinite(numericValue) ? numericValue.toFixed(digits) : '-';
}

function renderCellBoolean(value) {
  if (value === true) {
    return <FontAwesomeIcon icon={faCheck} className='text-success text-[1em]' />;
  }
  if (value === false) {
    return <FontAwesomeIcon icon={faTimes} className='text-error text-[1em]' />;
  }
  return <span className='text-base-content/55 font-medium'>-</span>;
}

function getMetricCellValue(stats, metricKey, partKey) {
  const metric = stats?.[metricKey];
  const parts = CELL_METRIC_PARTS[partKey];
  if (!parts) return '-';

  const formatPart = part => {
    const value = metric?.[part];
    return metricKey === 'wf' ? formatCellNumber(Math.max(0, value ?? 0)) : formatCellNumber(value);
  };

  return parts.length === 1
    ? formatPart(parts[0])
    : `${formatPart(parts[0])}/${formatPart(parts[1])}`;
}

function resolveCellValue({ data, stats, col, isSkipped = false }) {
  if (isSkipped && col.id !== 'sys_raw' && !BOOLEAN_CELL_FIELDS[col.id]) {
    const metricMatch = /^([a-z]+)_(se|mm|avg)$/.exec(col.id);
    return {
      mainValue: '-',
      unit: metricMatch
        ? CELL_METRIC_UNITS[metricMatch[1]] || ''
        : DIRECT_CELL_FIELDS[col.id]?.unit || '',
      isBoolean: false,
      booleanContent: null,
    };
  }

  const directField = DIRECT_CELL_FIELDS[col.id];
  if (directField) {
    return {
      mainValue: formatCellNumber(data?.[directField.path]),
      unit: directField.unit,
      isBoolean: false,
      booleanContent: null,
    };
  }

  if (col.id === 'sys_raw') {
    return {
      mainValue: stats?.sys_raw ?? '-',
      unit: '',
      isBoolean: false,
      booleanContent: null,
    };
  }

  const booleanField = BOOLEAN_CELL_FIELDS[col.id];
  if (booleanField) {
    return {
      mainValue: '-',
      unit: '',
      isBoolean: true,
      booleanContent: renderCellBoolean(stats?.[booleanField]),
    };
  }

  const metricMatch = /^([a-z]+)_(se|mm|avg)$/.exec(col.id);
  if (!metricMatch) {
    return {
      mainValue: '-',
      unit: '',
      isBoolean: false,
      booleanContent: null,
    };
  }

  const [, metricKey, partKey] = metricMatch;
  return {
    mainValue: getMetricCellValue(stats, metricKey, partKey),
    unit: CELL_METRIC_UNITS[metricKey] || '',
    isBoolean: false,
    booleanContent: null,
  };
}

function TargetDeltaDisplay({ targetVal, unit, subTextSize }) {
  return (
    <div
      style={subTextSize}
      className='text-base-content/55 mt-0.5 leading-tight font-medium tracking-normal whitespace-nowrap italic'
    >
      Target {targetVal} {unit}
    </div>
  );
}

function findPhaseTarget(phase, col) {
  const targets = Array.isArray(phase?.profilePhase?.targets) ? phase.profilePhase.targets : [];
  return targets.find(target => {
    if (col.id === 'weight') return target.type === 'weight' || target.type === 'volumetric';
    return target.type === col.targetType;
  });
}

function getTargetDisplay({ phase, col, unit, subTextSize }) {
  if (col.id === 'duration' && phase?.profilePhase?.duration > 0) {
    return (
      <TargetDeltaDisplay
        targetVal={phase.profilePhase.duration}
        unit={unit}
        subTextSize={subTextSize}
      />
    );
  }

  if (!col.targetType) return null;

  const target = findPhaseTarget(phase, col);
  if (!target) return null;

  return <TargetDeltaDisplay targetVal={target.value} unit={unit} subTextSize={subTextSize} />;
}

function getTargetCalcEntry(phase, col) {
  if (!col.targetType || !phase?.targetCalcValues) return null;
  return col.id === 'weight'
    ? phase.targetCalcValues.volumetric || phase.targetCalcValues.weight
    : phase.targetCalcValues[col.targetType];
}

function replaceCellValueWithCalc({ mainValue, calcEntry, col }) {
  if (!calcEntry) return mainValue;

  const calcValue = formatCellNumber(calcEntry.value);
  if (
    typeof mainValue === 'string' &&
    mainValue.includes('/') &&
    (col.type === 'se' || col.type === 'mm')
  ) {
    const parts = mainValue.split('/');
    return `${parts.slice(0, -1).join('/')}/${calcValue}`;
  }

  return calcValue;
}

function getWeightWarnings({ phase, isWeightCol, subTextSize }) {
  if (!isWeightCol) return [];

  const warnings = [];
  if (phase.scaleLost) {
    warnings.push(
      <div
        key='scale-lost-warning'
        style={{ ...subTextSize, color: utilityColors.warningOrange }}
        className='mt-0.5 flex items-center justify-end gap-1 font-bold'
      >
        <FontAwesomeIcon icon={faExclamationTriangle} />
        <span>Scale Lost</span>
      </div>,
    );
  }

  if (phase.highScaleDelay) {
    warnings.push(
      <div
        key='high-scale-delay-warning'
        style={{ ...subTextSize, color: utilityColors.warningOrange }}
        className='mt-0.5 flex items-center justify-end gap-1 font-bold'
      >
        <FontAwesomeIcon icon={faExclamationTriangle} />
        <span>
          High Scale Delay
          {phase.estimatedScaleDelayMs ? ` (${phase.estimatedScaleDelayMs} ms)` : ''}
        </span>
      </div>,
    );
  }

  return warnings;
}

function renderTotalCellContent({ isBoolean, booleanContent, mainValue, unit }) {
  if (isBoolean) return <div className='flex justify-end'>{booleanContent}</div>;
  return (
    <span className='text-base-content/90 font-medium'>
      {mainValue} {unit}
    </span>
  );
}

function getCellHitState({ phase, col }) {
  if (col.id === 'weight') {
    return phase.exit?.type === 'weight' || phase.exit?.type === 'volumetric';
  }
  return phase.exit?.type === col.targetType;
}

function renderBooleanCellContent({ booleanContent, booleanAnomaly, subTextSize }) {
  return (
    <div className='flex h-full flex-col items-end justify-center pb-1'>
      <div className='flex items-center'>{booleanContent}</div>
      {booleanAnomaly && (
        <div
          style={subTextSize}
          className='text-base-content/55 mt-0.5 flex flex-col items-end leading-tight font-medium tracking-normal'
          title={`Sample ${booleanAnomaly.sampleInPhase}: ${String(booleanAnomaly.value)}`}
        >
          <span>
            Sample {booleanAnomaly.sampleInPhase}
            {Number.isFinite(booleanAnomaly.sampleCountInPhase)
              ? ` (${booleanAnomaly.sampleCountInPhase})`
              : ''}
          </span>
          <span className='text-base-content/55 font-normal'>{String(booleanAnomaly.value)}</span>
        </div>
      )}
    </div>
  );
}

function renderMetricCellValue({
  isHit,
  calcIsStopReason,
  mainValue,
  unit,
  mainValueIsCalculated,
}) {
  const isStopValue = mainValueIsCalculated ? calcIsStopReason : isHit && !calcIsStopReason;
  return (
    <span
      className={isStopValue ? 'font-normal' : 'text-base-content/90 font-medium'}
      style={isStopValue ? { color: utilityColors.stopRed } : {}}
    >
      {mainValue} {unit}
    </span>
  );
}

export function CellContent({ phase, col, results, isTotal = false }) {
  const data = isTotal ? results?.total : phase;
  const stats = isTotal ? results?.total : phase?.stats;

  if (!data) return <span>-</span>;

  const { mainValue, unit, isBoolean, booleanContent } = resolveCellValue({
    data,
    stats,
    col,
    isSkipped: Boolean(phase?.skipped),
  });

  if (isTotal) {
    return renderTotalCellContent({ isBoolean, booleanContent, mainValue, unit });
  }

  const isWeightCol = col.id === 'weight';
  const isHit = getCellHitState({ phase, col });

  // Keep secondary text proportional to the table text.
  const subTextSize = { fontSize: '0.85em' };
  const booleanAnomaly = isBoolean ? stats?.sys_anomalies?.[col.id] : null;
  const calcEntry = getTargetCalcEntry(phase, col);
  const displayMainValue = isBoolean
    ? mainValue
    : replaceCellValueWithCalc({ mainValue, calcEntry, col });
  const mainValueIsCalculated = !isBoolean && Boolean(calcEntry);
  const targetDisplay = getTargetDisplay({
    phase,
    col,
    unit,
    subTextSize,
  });
  const calcIsStopReason = Boolean(calcEntry?.isStopReason);
  const warningDisplays = getWeightWarnings({ phase, isWeightCol, subTextSize });

  return (
    <div className='flex min-h-[2em] flex-col items-end justify-center'>
      {isBoolean
        ? renderBooleanCellContent({ booleanContent, booleanAnomaly, subTextSize })
        : renderMetricCellValue({
            isHit,
            calcIsStopReason,
            mainValue: displayMainValue,
            unit,
            mainValueIsCalculated,
          })}
      {targetDisplay}
      {warningDisplays}
    </div>
  );
}
