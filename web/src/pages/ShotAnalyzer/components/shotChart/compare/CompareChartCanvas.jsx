import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import Chart from 'chart.js/auto';
import {
  areTooltipStatesEqual,
  createHiddenExternalTooltipLayout,
  createHiddenExternalTooltipState,
  ShotChartExternalTooltip,
  useMeasuredExternalTooltipLayout,
} from '../ShotChartExternalTooltip';
import { MobileChartScrubber } from '../MobileChartScrubber';
import {
  getChartScrubberInsets,
  getScrubberValueFromNativeInputEvent,
  getScrubberValueFromPointerEvent,
} from '../scrubberUtils';
import { extractClientPoint } from '../hoverSync';
import { useMobileScrubberReset } from '../useMobileScrubberReset';
import { createCompareChartConfig } from './compareChartConfig';
import {
  addCompareHoverListeners,
  applyCompareHover,
  applyCompareHoverAtX,
  applyCompareTitleOnlyHover,
  clearCompareChartHover,
  removeCompareHoverListeners,
} from './compareHover';

const HIDDEN_STATIC_TOOLTIP_STATE = createHiddenExternalTooltipState();

export function CompareChartCanvas({
  config,
  height,
  chartInstanceRef = null,
  isFullDisplay = false,
  enableHoverInfo = true,
  compareTooltipMode = 'compare',
  useCompactStaticTooltip = false,
  staticCompactVariant = 'default',
  hideEmptyStaticTooltip = false,
  emptyStaticTooltipContent = null,
  beforeChartContent = null,
  disableDirectHoverOnMobile = false,
  showMobileScrubber = false,
  mobileScrubberRange = null,
  staticMetricContext = null,
  useStaticTooltip = false,
}) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const containerRef = useRef(null);
  const scrubberRef = useRef(null);
  const tooltipRef = useRef(null);
  const ignoreScrubInputUntilRef = useRef(0);
  const lastPointerScrubAtRef = useRef(0);
  const hoverFrameRef = useRef(null);
  const pendingHoverPointRef = useRef(null);
  const [externalTooltipState, setExternalTooltipState] = useState(
    createHiddenExternalTooltipState,
  );
  const [externalTooltipLayout, setExternalTooltipLayout] = useState(
    createHiddenExternalTooltipLayout,
  );
  const [scrubXValue, setScrubXValue] = useState(null);
  const [scrubberInsets, setScrubberInsets] = useState({ left: 0, right: 0 });

  const scrubberMin = Number(mobileScrubberRange?.min);
  const scrubberMax = Number(mobileScrubberRange?.max);
  const scrubberKey = mobileScrubberRange?.key || `${scrubberMin}:${scrubberMax}`;
  const hasMobileScrubberRange =
    Number.isFinite(scrubberMin) && Number.isFinite(scrubberMax) && scrubberMax > scrubberMin;
  const hasActiveScrubValue = typeof scrubXValue === 'number' && Number.isFinite(scrubXValue);
  const activeScrubXValue = hasActiveScrubValue
    ? Math.min(scrubberMax, Math.max(scrubberMin, Number(scrubXValue)))
    : null;
  const updateScrubberInsets = useCallback(() => {
    const nextInsets = getChartScrubberInsets(chartRef.current);
    if (!nextInsets) return;
    setScrubberInsets(prev =>
      prev.left === nextInsets.left && prev.right === nextInsets.right ? prev : nextInsets,
    );
  }, []);

  const updateScrubberFromPointer = event => {
    if (Date.now() < ignoreScrubInputUntilRef.current) return;
    if (!hasMobileScrubberRange) return;

    if (hoverFrameRef.current != null) {
      globalThis.cancelAnimationFrame?.(hoverFrameRef.current);
      globalThis.clearTimeout?.(hoverFrameRef.current);
      hoverFrameRef.current = null;
      pendingHoverPointRef.current = null;
    }

    const nextValue = getScrubberValueFromPointerEvent(event, {
      min: scrubberMin,
      max: scrubberMax,
      trackElement: scrubberRef.current,
    });
    if (nextValue === null) return;

    lastPointerScrubAtRef.current = Date.now();
    setScrubXValue(nextValue);
  };

  const updateScrubberFromNativeInput = event => {
    const nextValue = getScrubberValueFromNativeInputEvent(event, {
      min: scrubberMin,
      max: scrubberMax,
      ignoreInputUntil: ignoreScrubInputUntilRef.current,
      lastPointerInputAt: lastPointerScrubAtRef.current,
    });
    if (nextValue !== null) {
      setScrubXValue(nextValue);
    }
  };

  const resetScrubberHover = useCallback(() => {
    ignoreScrubInputUntilRef.current = Date.now() + 250;
    setScrubXValue(null);
    const chart = chartRef.current;
    if (chart) {
      clearCompareChartHover(chart);
    }
    setExternalTooltipState(prev => {
      const hiddenState = createHiddenExternalTooltipState();
      return areTooltipStatesEqual(prev, hiddenState) ? prev : hiddenState;
    });
  }, []);

  useMobileScrubberReset({
    enabled: useStaticTooltip && showMobileScrubber,
    hasActiveScrubValue,
    scrubberRef,
    onReset: resetScrubberHover,
  });

  useMeasuredExternalTooltipLayout({
    containerRef,
    disabled: useStaticTooltip,
    setTooltipLayout: setExternalTooltipLayout,
    tooltipRef,
    tooltipState: externalTooltipState,
  });

  useEffect(() => {
    setScrubXValue(null);
  }, [scrubberKey]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const shouldSuppressHoverGuide = useStaticTooltip && showMobileScrubber && hasActiveScrubValue;
    if (chart.$suppressHoverGuide === shouldSuppressHoverGuide) return;

    chart.$suppressHoverGuide = shouldSuppressHoverGuide;
    if (!shouldSuppressHoverGuide) chart.update('none');
  }, [hasActiveScrubValue, showMobileScrubber, useStaticTooltip]);

  useEffect(() => {
    if (
      !enableHoverInfo ||
      !useStaticTooltip ||
      !showMobileScrubber ||
      !hasMobileScrubberRange ||
      !hasActiveScrubValue
    ) {
      return;
    }

    const chart = chartRef.current;
    if (!chart) return;

    if (compareTooltipMode === 'compareTitleOnly') {
      const xScale = chart.scales?.x;
      if (!chart.canvas || !chart.chartArea || !xScale) {
        clearCompareChartHover(chart);
        return;
      }

      const xPixel = xScale.getPixelForValue(activeScrubXValue);
      if (!Number.isFinite(xPixel)) {
        clearCompareChartHover(chart);
        return;
      }
      const chartRect = chart.canvas.getBoundingClientRect();
      const chartAreaHeight = Number(chart.chartArea.bottom) - Number(chart.chartArea.top);
      const clientY =
        chartRect.top +
        chart.chartArea.top +
        (Number.isFinite(chartAreaHeight) && chartAreaHeight > 0 ? chartAreaHeight / 2 : 0);
      applyCompareTitleOnlyHover(chart, chartRect.left + xPixel, clientY, setExternalTooltipState);
      return;
    }

    applyCompareHoverAtX(chart, activeScrubXValue);
  }, [
    activeScrubXValue,
    compareTooltipMode,
    enableHoverInfo,
    hasActiveScrubValue,
    hasMobileScrubberRange,
    showMobileScrubber,
    useStaticTooltip,
  ]);

  useEffect(() => {
    if (!canvasRef.current) return undefined;

    const hideExternalTooltip = () => {
      setExternalTooltipState(prev => {
        const hiddenState = createHiddenExternalTooltipState();
        return areTooltipStatesEqual(prev, hiddenState) ? prev : hiddenState;
      });
    };
    const nextConfig = createCompareChartConfig(config, {
      enableHoverInfo,
      compareTooltipMode,
      hideExternalTooltip,
      setExternalTooltipState,
    });

    const chart = new Chart(canvasRef.current, nextConfig);
    chartRef.current = chart;
    chart.$compareTooltipShowDifference = Boolean(config.compareTooltipShowDifference);
    if (chartInstanceRef) {
      chartInstanceRef.current = chart;
    }

    const hoverSurface = containerRef.current || chart.canvas;
    const clearPendingHoverFrame = () => {
      if (hoverFrameRef.current != null) {
        globalThis.cancelAnimationFrame?.(hoverFrameRef.current);
        globalThis.clearTimeout?.(hoverFrameRef.current);
        hoverFrameRef.current = null;
      }
      pendingHoverPointRef.current = null;
    };
    const clearHover = () => {
      clearPendingHoverFrame();
      clearCompareChartHover(chart);
      hideExternalTooltip();
    };
    const flushHoverMove = () => {
      hoverFrameRef.current = null;
      const point = pendingHoverPointRef.current;
      pendingHoverPointRef.current = null;
      if (!point) return;

      if (compareTooltipMode === 'compareTitleOnly') {
        applyCompareTitleOnlyHover(chart, point.clientX, point.clientY, setExternalTooltipState);
        return;
      }

      applyCompareHover(chart, point.clientX, point.clientY);
    };
    const handleHoverMove = event => {
      pendingHoverPointRef.current = extractClientPoint(event);
      if (!pendingHoverPointRef.current || hoverFrameRef.current != null) return;
      hoverFrameRef.current = globalThis.requestAnimationFrame
        ? globalThis.requestAnimationFrame(flushHoverMove)
        : globalThis.setTimeout(flushHoverMove, 16);
    };
    const supportsPointerEvents = Boolean(globalThis.window?.PointerEvent);
    const shouldAttachHover = enableHoverInfo && !(disableDirectHoverOnMobile && useStaticTooltip);

    if (hoverSurface && shouldAttachHover) {
      addCompareHoverListeners(hoverSurface, supportsPointerEvents, handleHoverMove, clearHover);
    }

    if (globalThis.window === undefined) {
      updateScrubberInsets();
    } else {
      globalThis.window.requestAnimationFrame(updateScrubberInsets);
    }

    return () => {
      if (hoverSurface && shouldAttachHover) {
        removeCompareHoverListeners(
          hoverSurface,
          supportsPointerEvents,
          handleHoverMove,
          clearHover,
        );
      }

      clearPendingHoverFrame();
      if (chartInstanceRef?.current === chart) {
        chartInstanceRef.current = null;
      }
      if (chartRef.current === chart) {
        chartRef.current = null;
      }
      chart.destroy();
      setExternalTooltipState(createHiddenExternalTooltipState());
      setExternalTooltipLayout(createHiddenExternalTooltipLayout());
    };
  }, [
    chartInstanceRef,
    config,
    disableDirectHoverOnMobile,
    enableHoverInfo,
    compareTooltipMode,
    updateScrubberInsets,
    useStaticTooltip,
  ]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || globalThis.window === undefined) return undefined;

    const frameId = globalThis.window.requestAnimationFrame(() => {
      chart.resize();
      updateScrubberInsets();
    });

    return () => globalThis.window.cancelAnimationFrame(frameId);
  }, [height, isFullDisplay, updateScrubberInsets, useStaticTooltip]);

  const shouldRenderMobileScrubber =
    enableHoverInfo && useStaticTooltip && showMobileScrubber && hasMobileScrubberRange;
  const mobileStaticTooltipState =
    shouldRenderMobileScrubber && !hasActiveScrubValue
      ? HIDDEN_STATIC_TOOLTIP_STATE
      : externalTooltipState;
  const shouldRenderStaticTooltip =
    enableHoverInfo &&
    useStaticTooltip &&
    (!hideEmptyStaticTooltip || mobileStaticTooltipState.visible);
  const mobileHoverConnectorStyle = (() => {
    if (!shouldRenderMobileScrubber || !hasActiveScrubValue || !externalTooltipState.visible) {
      return { display: 'none' };
    }

    const containerElement = containerRef.current;
    const scrubberElement = scrubberRef.current;
    const chart = chartRef.current;
    const xScale = chart?.scales?.x;
    if (!containerElement || !scrubberElement || !chart?.canvas || !chart?.chartArea || !xScale) {
      return { display: 'none' };
    }

    const xPixel = xScale.getPixelForValue(activeScrubXValue);
    if (!Number.isFinite(xPixel)) return { display: 'none' };

    const containerRect = containerElement.getBoundingClientRect();
    const canvasRect = chart.canvas.getBoundingClientRect();
    const scrubberRect = scrubberElement.getBoundingClientRect();
    const guideOverflow = 6;
    const top = canvasRect.top - containerRect.top + chart.chartArea.top - guideOverflow;
    const bottom = scrubberRect.bottom - containerRect.top;

    return {
      display: 'block',
      left: `${canvasRect.left - containerRect.left + xPixel}px`,
      top: `${Math.max(0, top)}px`,
      height: `${Math.max(0, bottom - top)}px`,
    };
  })();

  return (
    <div ref={containerRef} className='shot-chart-compare-canvas-shell relative w-full'>
      {shouldRenderStaticTooltip ? (
        <ShotChartExternalTooltip
          tooltipRef={tooltipRef}
          state={mobileStaticTooltipState}
          isFullDisplay={isFullDisplay}
          isStatic
          isCompactStatic={useCompactStaticTooltip}
          staticCompactVariant={staticCompactVariant}
          staticMetricContext={staticMetricContext}
          emptyContent={emptyStaticTooltipContent}
        />
      ) : null}
      {beforeChartContent}
      <div
        className='shot-chart-interaction-layer relative w-full'
        style={{ height: `${height}px` }}
      >
        <canvas ref={canvasRef} />
        {enableHoverInfo && !useStaticTooltip ? (
          <ShotChartExternalTooltip
            tooltipRef={tooltipRef}
            state={externalTooltipState}
            layout={externalTooltipLayout}
            isFullDisplay={isFullDisplay}
          />
        ) : null}
      </div>
      <div className='shot-chart-hover-connector' style={mobileHoverConnectorStyle} />
      {shouldRenderMobileScrubber ? (
        <MobileChartScrubber
          active={hasActiveScrubValue}
          ariaLabel='Scrub compare time'
          insets={scrubberInsets}
          max={scrubberMax}
          min={scrubberMin}
          onInput={updateScrubberFromNativeInput}
          onPointerUpdate={updateScrubberFromPointer}
          scrubberRef={scrubberRef}
          value={activeScrubXValue ?? scrubberMin}
          variant='compare'
        />
      ) : null}
    </div>
  );
}
