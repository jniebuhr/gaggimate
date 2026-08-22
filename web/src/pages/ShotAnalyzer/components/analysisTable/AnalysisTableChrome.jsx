/** Provides the table header, toolbar actions, and warning popover UI. */

import { createPortal } from 'preact/compat';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faAngleRight,
  faAngleDoubleRight,
  faArrowRight,
  faAngleLeft,
  faAngleDoubleLeft,
  faArrowLeft,
  faCircleInfo,
} from '@fortawesome/free-solid-svg-icons';
import { getAnalyzerColumnVisual } from './analyzerGroupVisuals';
import {
  ANALYZER_ACTION_GROUP_CLASSES,
  ANALYZER_ACTION_ICON_BUTTON_CLASS,
  ANALYZER_ACTION_ICON_CLASS,
  ANALYZER_ACTION_ICON_STYLE,
  getAnalyzerIconButtonClasses,
} from '../analyzerControlStyles';
import { getAnalysisHeaderLabel } from './analysisTableModel';

export function AnalysisTableToolbarActions({ onScrollTable, onScrollToBound }) {
  return (
    <div className={`${ANALYZER_ACTION_GROUP_CLASSES} hidden sm:flex`}>
      <ScrollBtn icon={faArrowLeft} onClick={() => onScrollToBound('start')} />
      <ScrollBtn icon={faAngleDoubleLeft} onClick={() => onScrollTable(-300)} />
      <ScrollBtn
        icon={faAngleLeft}
        onClick={() => onScrollTable(-100)}
        className='mr-1 rounded-r-none'
      />
      <ScrollBtn
        icon={faAngleRight}
        onClick={() => onScrollTable(100)}
        className='rounded-l-none'
      />
      <ScrollBtn icon={faAngleDoubleRight} onClick={() => onScrollTable(300)} />
      <ScrollBtn icon={faArrowRight} onClick={() => onScrollToBound('end')} />
    </div>
  );
}

export function AnalysisTableHeader({
  compareMode,
  hasProfilePhaseStops,
  visibleColumns,
  subtleDividerClass,
  strongDividerClass,
  tableHeaderTextClass,
  tableHeaderSubtextClass,
}) {
  return (
    <thead>
      <tr className='border-base-content/10 border-b-2'>
        {!compareMode && (
          <th
            className={`w-10 border-r px-2 py-2 text-center select-none ${subtleDividerClass} ${tableHeaderTextClass}`}
          >
            #
          </th>
        )}
        {compareMode && (
          <th
            className={`min-w-[140px] px-2 py-2 text-left whitespace-nowrap ${subtleDividerClass} ${tableHeaderTextClass}`}
          >
            Shot
          </th>
        )}
        <th
          className={`min-w-[120px] px-2 py-2 text-left whitespace-nowrap ${strongDividerClass} ${tableHeaderTextClass}`}
        >
          <div className='leading-none'>Phase</div>
          {hasProfilePhaseStops && (
            <div className={`mt-0.5 ${tableHeaderSubtextClass}`} style={{ fontSize: '0.85em' }}>
              Stop reason
            </div>
          )}
        </th>
        {visibleColumns.map(col => {
          const columnVisual = getAnalyzerColumnVisual(col);
          return (
            <th
              key={col.id}
              className={`border-l px-3 py-2 text-right align-middle ${subtleDividerClass} ${tableHeaderTextClass}`}
            >
              <span className='ml-auto flex max-w-[6.75rem] items-center justify-end gap-1.5 text-right leading-tight'>
                <FontAwesomeIcon
                  icon={columnVisual.icon}
                  className='shrink-0 text-xs'
                  style={{ color: columnVisual.color }}
                />
                <span className='min-w-0 break-words whitespace-normal'>
                  {getAnalysisHeaderLabel(col)}
                </span>
              </span>
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

export function StatusBadge({ label, colorClass = '', style = {}, details }) {
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState(null);

  const updatePopoverPosition = useCallback(() => {
    const triggerElement = triggerRef.current;
    const browserWindow = globalThis.window;
    if (!triggerElement || !browserWindow) return;

    const viewportWidth = browserWindow.innerWidth || 0;
    const viewportHeight = browserWindow.innerHeight || 0;
    const scrollX = browserWindow.scrollX || browserWindow.pageXOffset || 0;
    const scrollY = browserWindow.scrollY || browserWindow.pageYOffset || 0;
    const triggerRect = triggerElement.getBoundingClientRect();
    const margin = 10;
    const width = Math.min(viewportWidth - margin * 2, 360);
    const left = Math.min(
      Math.max(margin, triggerRect.left),
      Math.max(margin, viewportWidth - width - margin),
    );
    const spaceAbove = triggerRect.top - margin;
    const spaceBelow = viewportHeight - triggerRect.bottom - margin;
    const openAbove = spaceBelow < 120 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(80, Math.min(viewportHeight - margin * 2, 220));

    setPopoverStyle({
      position: 'absolute',
      left: `${scrollX + left}px`,
      top: `${
        scrollY +
        (openAbove ? Math.max(margin, triggerRect.top - maxHeight - 8) : triggerRect.bottom + 8)
      }px`,
      width: `${width}px`,
      maxHeight: `${maxHeight}px`,
    });
  }, []);

  const closePopover = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return undefined;
    updatePopoverPosition();

    const handlePointerDown = event => {
      if (triggerRef.current?.contains(event.target)) return;
      if (popoverRef.current?.contains(event.target)) return;
      closePopover();
    };
    const handleKeyDown = event => {
      if (event.key === 'Escape') closePopover();
    };
    const handleResize = () => updatePopoverPosition();
    const handleScroll = event => {
      if (popoverRef.current?.contains(event.target)) return;
      closePopover();
    };

    globalThis.document?.addEventListener('pointerdown', handlePointerDown);
    globalThis.document?.addEventListener('keydown', handleKeyDown);
    globalThis.window?.addEventListener('resize', handleResize);
    globalThis.window?.addEventListener('scroll', handleScroll, { passive: true });
    globalThis.document?.addEventListener('scroll', handleScroll, true);

    return () => {
      globalThis.document?.removeEventListener('pointerdown', handlePointerDown);
      globalThis.document?.removeEventListener('keydown', handleKeyDown);
      globalThis.window?.removeEventListener('resize', handleResize);
      globalThis.window?.removeEventListener('scroll', handleScroll);
      globalThis.document?.removeEventListener('scroll', handleScroll, true);
    };
  }, [closePopover, isOpen, updatePopoverPosition]);

  const popoverContent =
    isOpen && details ? (
      <div
        ref={popoverRef}
        className='bg-base-100/95 border-base-content/10 text-base-content z-[10000] overflow-y-auto rounded-lg border p-2.5 text-xs leading-relaxed font-normal tracking-normal normal-case shadow-xl backdrop-blur-md'
        style={popoverStyle || { position: 'absolute', visibility: 'hidden' }}
      >
        <p className='text-base-content/90 mb-1 text-[12px] leading-tight font-medium tracking-normal'>
          {label}
        </p>
        <p className='text-base-content/55 leading-relaxed font-normal'>{details}</p>
      </div>
    ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type='button'
        className={`relative inline-flex items-center gap-1 rounded-t-md rounded-b-none border border-b-0 px-2.5 pt-1 pb-2 text-xs leading-none font-medium tracking-tight transition-[filter,background-color] duration-150 select-none hover:brightness-105 focus-visible:ring-2 focus-visible:ring-current focus-visible:outline-none ${colorClass}`}
        style={style}
        aria-expanded={isOpen}
        onClick={() => setIsOpen(current => !current)}
      >
        <span>{label}</span>
        <FontAwesomeIcon icon={faCircleInfo} className='text-[10px] opacity-80' />
      </button>
      {globalThis.document?.body ? createPortal(popoverContent, globalThis.document.body) : null}
    </>
  );
}

const ScrollBtn = ({ icon, onClick, className = '', title }) => (
  <button
    onClick={onClick}
    title={title}
    className={getAnalyzerIconButtonClasses({
      className: `${ANALYZER_ACTION_ICON_BUTTON_CLASS} ${className}`,
    })}
  >
    <FontAwesomeIcon
      icon={icon}
      className={ANALYZER_ACTION_ICON_CLASS}
      style={ANALYZER_ACTION_ICON_STYLE}
    />
  </button>
);
