import { useLayoutEffect } from 'preact/hooks';
import { computeExternalTooltipPosition } from '../helpers';
import {
  areTooltipLayoutsEqual,
  createHiddenExternalTooltipLayout,
  getFiniteTooltipBound,
} from './tooltipState';

function getExternalTooltipLayout({
  tooltipState,
  tooltipWidth,
  tooltipHeight,
  fallbackWidth,
  fallbackHeight,
}) {
  if (!tooltipState.visible) {
    return createHiddenExternalTooltipLayout();
  }

  // Clamp the floating tooltip into the main chart container so it never escapes the chart bounds.
  return computeExternalTooltipPosition({
    anchorX: tooltipState.anchorX,
    anchorY: tooltipState.anchorY,
    chartWidth: tooltipState.chartWidth || fallbackWidth || 0,
    chartHeight: tooltipState.chartHeight || fallbackHeight || 0,
    tooltipWidth,
    tooltipHeight,
    boundsLeft: getFiniteTooltipBound(tooltipState.tooltipBoundsLeft, tooltipState.chartAreaLeft),
    boundsRight: getFiniteTooltipBound(
      tooltipState.tooltipBoundsRight,
      tooltipState.chartAreaRight,
    ),
    boundsTop: getFiniteTooltipBound(tooltipState.tooltipBoundsTop, tooltipState.chartAreaTop),
    boundsBottom: getFiniteTooltipBound(
      tooltipState.tooltipBoundsBottom,
      tooltipState.chartAreaBottom,
    ),
  });
}

export function useMeasuredExternalTooltipLayout({
  containerRef,
  disabled,
  setTooltipLayout,
  tooltipRef,
  tooltipState,
}) {
  useLayoutEffect(() => {
    if (disabled || !tooltipState.visible) {
      setTooltipLayout(previousLayout => {
        const hiddenLayout = createHiddenExternalTooltipLayout();
        return areTooltipLayoutsEqual(previousLayout, hiddenLayout) ? previousLayout : hiddenLayout;
      });
      return;
    }

    const tooltipElement = tooltipRef.current;
    const containerElement = containerRef.current;
    if (!tooltipElement || !containerElement) return;

    const nextLayout = getExternalTooltipLayout({
      tooltipState,
      tooltipWidth: tooltipElement.offsetWidth || 0,
      tooltipHeight: tooltipElement.offsetHeight || 0,
      fallbackWidth: tooltipState.chartWidth || containerElement.clientWidth || 0,
      fallbackHeight: tooltipState.chartHeight || containerElement.clientHeight || 0,
    });

    setTooltipLayout(previousLayout =>
      areTooltipLayoutsEqual(previousLayout, nextLayout) ? previousLayout : nextLayout,
    );
  }, [containerRef, disabled, setTooltipLayout, tooltipRef, tooltipState]);
}
