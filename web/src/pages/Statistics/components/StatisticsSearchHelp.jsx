import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons/faCircleQuestion';
import { useEffect, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { getAnalyzerIconButtonClasses } from '../../ShotAnalyzer/components/analyzerControlStyles';
import {
  STATISTICS_DROPDOWN_PANEL_SURFACE_CLASS,
  STATISTICS_DROPDOWN_PANEL_SURFACE_STYLE,
} from './statisticsDropdownSurface';
import './StatisticsSearchHelp.css';

const STATISTICS_SEARCH_HELP_PANEL_CLASS = `dropdown-content mt-2 w-[min(92vw,34rem)] p-3 ${STATISTICS_DROPDOWN_PANEL_SURFACE_CLASS}`;
const STATISTICS_SEARCH_HELP_FLOATING_ATTR = 'data-statistics-toolbar-floating-panel';

function StatisticsSearchHelpContent() {
  return (
    <div className='space-y-2 text-xs leading-relaxed'>
      <p className='font-semibold'>Statistics Search DSL</p>
      <p className='opacity-80'>
        Rules are separated with <code>;</code>. Visual filters and DSL are combined with AND.
      </p>
      <div className='bg-base-200/60 rounded-lg p-2'>
        <p className='font-semibold'>Fields</p>
        <p>
          <code>name</code>, <code>profile</code>, <code>id</code>, <code>source</code>,{' '}
          <code>date</code>, <code>pinned</code>
        </p>
      </div>
      <div className='bg-base-200/60 rounded-lg p-2'>
        <p className='font-semibold'>Examples</p>
        <p>
          <code>name:325; name:326;</code> (same field = OR)
        </p>
        <p>
          <code>name:&quot;325&quot;;</code> (exact)
        </p>
        <p>
          <code>profile:3_0_25; date:&gt;h-7d;</code>
        </p>
        <p>
          <code>pinned:true; source:gm;</code>
        </p>
        <p>
          <code>date:&gt;=01.02.2026; date:&lt;=07.02.2026 23:59;</code>
        </p>
      </div>
      <div className='bg-base-200/60 rounded-lg p-2'>
        <p className='font-semibold'>Date</p>
        <p>
          Use <code>&gt;</code>, <code>&gt;=</code>, <code>&lt;</code>, <code>&lt;=</code>,{' '}
          <code>=</code>
        </p>
        <p>
          Relative time: <code>h</code> (now), <code>h-7d</code> (7 days ago)
        </p>
        <p className='opacity-70'>Local browser time is used.</p>
        <p className='opacity-70'>
          Date basis (<code>Shot / Auto / Upload</code>) appears only when missing shot timestamps
          are detected.
        </p>
      </div>
    </div>
  );
}

export function StatisticsSearchHelp() {
  const detailsRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => globalThis.window?.matchMedia?.('(max-width: 639px)').matches || false,
  );
  const [mobilePortalTarget, setMobilePortalTarget] = useState(null);

  useEffect(() => {
    if (globalThis.window?.matchMedia === undefined) return undefined;

    const mediaQuery = globalThis.window.matchMedia('(max-width: 639px)');
    const handleChange = event => setIsMobileViewport(event.matches);
    setIsMobileViewport(mediaQuery.matches);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    return undefined;
  }, []);

  useEffect(() => {
    if (!isOpen || !isMobileViewport) {
      setMobilePortalTarget(null);
      return;
    }
    const detailsEl = detailsRef.current;
    setMobilePortalTarget(detailsEl?.closest('[data-statistics-toolbar-shell]') || null);
  }, [isMobileViewport, isOpen]);

  useEffect(() => {
    const detailsEl = detailsRef.current;
    if (!detailsEl) return undefined;

    const handleToggle = () => {
      setIsOpen(detailsEl.open);
    };

    handleToggle();
    detailsEl.addEventListener('toggle', handleToggle);

    return () => detailsEl.removeEventListener('toggle', handleToggle);
  }, []);

  const panelStyle = {
    ...STATISTICS_DROPDOWN_PANEL_SURFACE_STYLE,
    maxHeight: 'min(80vh, 32rem)',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
  };
  const mobilePanelStyle = {
    ...STATISTICS_DROPDOWN_PANEL_SURFACE_STYLE,
    maxHeight: 'min(70vh, 28rem)',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    WebkitOverflowScrolling: 'touch',
  };

  return (
    <details ref={detailsRef} className='statistics-search-help dropdown dropdown-end'>
      <summary
        className={`${getAnalyzerIconButtonClasses({
          className:
            'text-base-content/60 hover:text-base-content flex h-9 min-h-0 w-9 list-none items-center justify-center bg-transparent px-0',
        })} [&::-webkit-details-marker]:hidden`}
        aria-label='Search help'
        title='Search help'
      >
        <FontAwesomeIcon icon={faCircleQuestion} className='text-sm' />
      </summary>
      <div className={STATISTICS_SEARCH_HELP_PANEL_CLASS} style={panelStyle}>
        <StatisticsSearchHelpContent />
      </div>
      {isOpen && isMobileViewport && mobilePortalTarget
        ? createPortal(
            <div
              {...{ [STATISTICS_SEARCH_HELP_FLOATING_ATTR]: true }}
              className={`statistics-search-help-mobile-panel mx-1.5 mt-1 p-3 sm:mx-2 ${STATISTICS_DROPDOWN_PANEL_SURFACE_CLASS}`}
              style={mobilePanelStyle}
            >
              <StatisticsSearchHelpContent />
            </div>,
            mobilePortalTarget,
          )
        : null}
    </details>
  );
}
