import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { getShotChartDisplayLabel, getShotChartLabelIcon } from '../labelVisuals';
import { TooltipShotBadge } from './TooltipPrimitives';

function getStopReasonClassName(summary) {
  return `shot-chart-tooltip__phase-reason${summary?.stopType === 'safety' ? ' shot-chart-tooltip__phase-reason--warning' : ''}`;
}

function FloatingTooltipTitle({ state }) {
  if (!state.visible || state.titleLines.length === 0) return null;
  return (
    <div className='shot-chart-tooltip__title'>
      {state.titleLines.map((titleLine, index) => (
        <div key={`${titleLine}-${index}`}>{titleLine}</div>
      ))}
    </div>
  );
}

function FloatingPhaseHeading({ phaseSummary, index }) {
  return (
    <div
      key={`${phaseSummary.shotLabel || ''}-${phaseSummary.phaseLabel}-${index}`}
      className='shot-chart-tooltip__phase-heading'
    >
      <TooltipShotBadge
        shotNumber={phaseSummary.shotNumber}
        color={phaseSummary.color}
        className='shot-chart-tooltip__phase-badge'
      />
      {phaseSummary.shotLabel ? (
        <span className='shot-chart-tooltip__phase-shot'>{phaseSummary.shotLabel}</span>
      ) : null}
      {phaseSummary.phaseLabel ? <span>{phaseSummary.phaseLabel}</span> : null}
      {phaseSummary.skipNotice ? (
        <span className='shot-chart-tooltip__phase-skip-notice'>{phaseSummary.skipNotice}</span>
      ) : null}
    </div>
  );
}

function FloatingPhaseHeadingList({ state }) {
  const phaseSummaries = (state.phaseSummaries || []).filter(
    summary => summary.phaseLabel || summary.shotLabel,
  );
  if (!state.visible || phaseSummaries.length === 0) return null;

  return (
    <div className='shot-chart-tooltip__phase-heading-list'>
      {phaseSummaries.map((phaseSummary, index) => (
        <FloatingPhaseHeading
          key={`${phaseSummary.shotLabel || ''}-${phaseSummary.phaseLabel}-${index}`}
          phaseSummary={phaseSummary}
          index={index}
        />
      ))}
    </div>
  );
}

function FloatingStopSummary({ phaseSummary, index }) {
  return (
    <div
      key={`${phaseSummary.shotLabel || ''}-${phaseSummary.phaseLabel}-${index}`}
      className='shot-chart-tooltip__phase'
    >
      <div className='shot-chart-tooltip__phase-value'>
        {!phaseSummary.phaseLabel && phaseSummary.skipNotice ? (
          <span className='shot-chart-tooltip__phase-skip-notice'>{phaseSummary.skipNotice}</span>
        ) : null}
        {phaseSummary.stopReason ? (
          <span className={getStopReasonClassName(phaseSummary)}>
            {phaseSummary.stopReason}
            {phaseSummary.stopValue ? ': ' : ''}
          </span>
        ) : null}
        {phaseSummary.stopValue}
        {phaseSummary.stopTargetValue ? (
          <span className='shot-chart-tooltip__phase-target'>
            {' '}
            · Target {phaseSummary.stopTargetValue}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function FloatingStopSummaryList({ state }) {
  const stopSummaries = (state.phaseSummaries || []).filter(
    phaseSummary => phaseSummary.skipNotice || phaseSummary.stopReason || phaseSummary.stopValue,
  );
  if (!state.visible || stopSummaries.length === 0) return null;

  return (
    <div className='shot-chart-tooltip__phase-list'>
      {stopSummaries.map((phaseSummary, index) => (
        <FloatingStopSummary
          key={`${phaseSummary.shotLabel || ''}-${phaseSummary.phaseLabel}-${index}`}
          phaseSummary={phaseSummary}
          index={index}
        />
      ))}
    </div>
  );
}

function FloatingTooltipRow({ row, index }) {
  const rowIcon = getShotChartLabelIcon(row.label);
  const displayLabel = row.displayLabel || getShotChartDisplayLabel(row.label);

  return (
    <div
      key={`${row.shotLabel || ''}-${row.label}-${row.valueText}-${index}`}
      className={[
        'shot-chart-tooltip__row',
        row.spacerBefore ? 'shot-chart-tooltip__row--spacer' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {rowIcon ? (
        <FontAwesomeIcon
          icon={rowIcon}
          className='shot-chart-tooltip__icon'
          style={{ color: row.color }}
          aria-hidden='true'
        />
      ) : null}
      <span className='shot-chart-tooltip__text'>
        {row.shotLabel ? <span className='shot-chart-tooltip__shot'>{row.shotLabel}</span> : null}
        <span>{displayLabel}: </span>
        <span className='shot-chart-tooltip__value'>{row.valueText}</span>
      </span>
    </div>
  );
}

function FloatingTooltipRows({ state }) {
  if (!state.visible || state.rows.length === 0) return null;
  return state.rows.map((row, index) => (
    <FloatingTooltipRow
      key={`${row.shotLabel || ''}-${row.label}-${row.valueText}-${index}`}
      row={row}
      index={index}
    />
  ));
}

export function FloatingTooltipContent({ state }) {
  return (
    <>
      <FloatingTooltipTitle state={state} />
      <FloatingPhaseHeadingList state={state} />
      <FloatingStopSummaryList state={state} />
      <FloatingTooltipRows state={state} />
    </>
  );
}
