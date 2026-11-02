import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  LEGEND_BLOCK_LABELS,
  LEGEND_DASHED_LABELS,
  LEGEND_ORDER,
  LEGEND_THIN_LINE_LABELS,
  STANDARD_LINE_WIDTH,
  THIN_LINE_WIDTH,
  VISIBILITY_KEY_BY_LABEL,
} from '../constants';
import { getShotChartDisplayLabel, getShotChartLabelIcon } from '../labelVisuals';

const LEGEND_BUTTON_BASE_CLASS =
  'text-base-content inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded px-1.5 text-xs leading-tight font-normal tracking-normal normal-case transition disabled:cursor-not-allowed disabled:opacity-35';
const LEGEND_ICON_CLASS = 'text-xs';
export const SHOT_CHART_PRIMARY_LEGEND_LABELS = ['Phases', 'Stops'];
export const SHOT_CHART_SERIES_LEGEND_LABELS = LEGEND_ORDER.filter(
  label => !SHOT_CHART_PRIMARY_LEGEND_LABELS.includes(label),
);

function renderLegendMarker({ label, labelIcon, swatchColor, swatchLineWidth }) {
  if (LEGEND_BLOCK_LABELS.has(label)) {
    const markerColor = label === 'Phases' ? 'var(--color-base-content)' : swatchColor;
    return <span className='h-3 w-3 rounded-full' style={{ backgroundColor: markerColor }} />;
  }

  if (labelIcon) {
    return (
      <FontAwesomeIcon
        icon={labelIcon}
        className={LEGEND_ICON_CLASS}
        style={{ color: swatchColor }}
        aria-hidden='true'
      />
    );
  }

  return (
    <span
      className={`block w-4 border-t ${LEGEND_DASHED_LABELS.has(label) ? 'border-dashed' : 'border-solid'}`}
      style={{ borderColor: swatchColor, borderTopWidth: `${swatchLineWidth}px` }}
    />
  );
}

function getRenderableLegendLabels({
  labels,
  hiddenLegendLabels,
  hasWeightData,
  hasWeightFlowData,
}) {
  return labels.filter(label => {
    if (hiddenLegendLabels.includes(label)) return false;
    if (label === 'Weight' && !hasWeightData) return false;
    if (label === 'Weight Flow' && !hasWeightFlowData) return false;
    return true;
  });
}

export function ShotChartLegendToggles({
  labels = LEGEND_ORDER,
  hiddenLegendLabels = [],
  hasWeightData,
  hasWeightFlowData,
  isControlsLocked,
  legendColorByLabel,
  onLegendToggle,
  visibility,
  className = 'flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5',
}) {
  const renderableLabels = getRenderableLegendLabels({
    labels,
    hiddenLegendLabels,
    hasWeightData,
    hasWeightFlowData,
  });

  if (renderableLabels.length === 0) return null;

  return (
    <div className={className}>
      {renderableLabels.map(label => {
        const key = VISIBILITY_KEY_BY_LABEL[label];
        const isVisible = key ? visibility[key] : false;
        const swatchColor = legendColorByLabel[label] || '#94a3b8';
        const swatchLineWidth = LEGEND_THIN_LINE_LABELS.has(label)
          ? THIN_LINE_WIDTH
          : STANDARD_LINE_WIDTH;
        const labelIcon = getShotChartLabelIcon(label);
        const displayLabel = getShotChartDisplayLabel(label);

        return (
          <button
            key={label}
            type='button'
            onClick={() => onLegendToggle(label)}
            aria-pressed={isVisible}
            disabled={isControlsLocked}
            className={`${LEGEND_BUTTON_BASE_CLASS} ${
              isVisible
                ? 'hover:bg-base-content/5 opacity-90'
                : 'hover:bg-base-content/5 hover:text-primary opacity-45 hover:opacity-75'
            }`}
          >
            {renderLegendMarker({ label, labelIcon, swatchColor, swatchLineWidth })}
            <span>{displayLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

function MobileLegendArea({
  hiddenLegendLabels,
  hiddenMobileLegendLabels,
  hasWeightData,
  hasWeightFlowData,
  isControlsLocked,
  legendColorByLabel,
  onLegendToggle,
  showMobileLegend,
  visibleMobileLegendLabels,
  visibility,
}) {
  if (showMobileLegend) {
    return (
      <div className='flex min-w-0 flex-1 flex-col gap-1'>
        <ShotChartLegendToggles
          labels={visibleMobileLegendLabels}
          hiddenLegendLabels={[...hiddenLegendLabels, ...hiddenMobileLegendLabels]}
          hasWeightData={hasWeightData}
          hasWeightFlowData={hasWeightFlowData}
          isControlsLocked={isControlsLocked}
          legendColorByLabel={legendColorByLabel}
          onLegendToggle={onLegendToggle}
          visibility={visibility}
        />
      </div>
    );
  }

  return <div className='min-w-0 flex-1' />;
}

function DesktopLegendArea({
  hiddenLegendLabels,
  hasWeightData,
  hasWeightFlowData,
  isControlsLocked,
  legendColorByLabel,
  onLegendToggle,
  visibleTopLegendLabels,
  visibility,
}) {
  return (
    <ShotChartLegendToggles
      labels={visibleTopLegendLabels}
      hiddenLegendLabels={hiddenLegendLabels}
      hasWeightData={hasWeightData}
      hasWeightFlowData={hasWeightFlowData}
      isControlsLocked={isControlsLocked}
      legendColorByLabel={legendColorByLabel}
      onLegendToggle={onLegendToggle}
      visibility={visibility}
      className='flex min-w-0 flex-1 flex-wrap items-center gap-x-1 gap-y-0.5'
    />
  );
}

export function ChartLegendArea({
  hiddenLegendLabels,
  hiddenMobileLegendLabels,
  hasWeightData,
  hasWeightFlowData,
  isControlsLocked,
  isMobile,
  legendColorByLabel,
  onLegendToggle,
  showMobileLegend,
  visibleMobileLegendLabels,
  visibleTopLegendLabels,
  visibility,
}) {
  if (isMobile) {
    return (
      <MobileLegendArea
        hiddenLegendLabels={hiddenLegendLabels}
        hiddenMobileLegendLabels={hiddenMobileLegendLabels}
        hasWeightData={hasWeightData}
        hasWeightFlowData={hasWeightFlowData}
        isControlsLocked={isControlsLocked}
        legendColorByLabel={legendColorByLabel}
        onLegendToggle={onLegendToggle}
        showMobileLegend={showMobileLegend}
        visibleMobileLegendLabels={visibleMobileLegendLabels}
        visibility={visibility}
      />
    );
  }

  return (
    <DesktopLegendArea
      hiddenLegendLabels={hiddenLegendLabels}
      hasWeightData={hasWeightData}
      hasWeightFlowData={hasWeightFlowData}
      isControlsLocked={isControlsLocked}
      legendColorByLabel={legendColorByLabel}
      onLegendToggle={onLegendToggle}
      visibleTopLegendLabels={visibleTopLegendLabels}
      visibility={visibility}
    />
  );
}
