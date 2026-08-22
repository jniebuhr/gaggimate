import { useCallback, useEffect, useState } from 'preact/hooks';

const ANALYZER_SUBPAGE_HISTORY_KEY = '__gaggimateAnalyzerSubpage';
const ANALYZER_SUBPAGE_HISTORY_VERSION = 1;

function getHistoryMarker(state) {
  if (!state || typeof state !== 'object') return null;
  const marker = state[ANALYZER_SUBPAGE_HISTORY_KEY];
  if (marker?.version !== ANALYZER_SUBPAGE_HISTORY_VERSION) return null;
  return marker;
}

function isSubpageAvailable(page, { analysisEnabled, notesEnabled }) {
  if (page === 'analysis') return analysisEnabled;
  if (page === 'notes') return notesEnabled;
  return false;
}

function resolveHistorySubpage(state, options) {
  const marker = getHistoryMarker(state);
  if (!marker || marker.viewKey !== options.viewKey) return null;
  return isSubpageAvailable(marker.page, options) ? marker.page : null;
}

function buildHistoryState(currentState, page, viewKey) {
  const preservedState = currentState && typeof currentState === 'object' ? currentState : {};
  return {
    ...preservedState,
    [ANALYZER_SUBPAGE_HISTORY_KEY]: {
      page,
      version: ANALYZER_SUBPAGE_HISTORY_VERSION,
      viewKey,
    },
  };
}

function getBrowserWindow() {
  return globalThis.window;
}

export function useAnalyzerMobileSubpageNavigation({ analysisEnabled, notesEnabled, viewKey }) {
  const [mobileSubpage, setMobileSubpage] = useState(null);

  useEffect(() => {
    const browserWindow = getBrowserWindow();
    if (!browserWindow?.history) return undefined;

    const options = { analysisEnabled, notesEnabled, viewKey };
    const handlePopState = event => {
      const nextSubpage = resolveHistorySubpage(event.state, options);
      setMobileSubpage(nextSubpage);

      if (getHistoryMarker(event.state) && !nextSubpage) {
        // Skip obsolete entries when browser Forward revisits a shot that is no longer active.
        browserWindow.history.back();
      }
    };

    browserWindow.addEventListener('popstate', handlePopState);

    const currentMarker = getHistoryMarker(browserWindow.history.state);
    const currentSubpage = resolveHistorySubpage(browserWindow.history.state, options);
    setMobileSubpage(currentSubpage);

    if (currentMarker && !currentSubpage) {
      // Consume a stale same-page entry when the selected shot or compare mode changes.
      browserWindow.history.back();
    }

    return () => browserWindow.removeEventListener('popstate', handlePopState);
  }, [analysisEnabled, notesEnabled, viewKey]);

  const openMobileSubpage = useCallback(
    page => {
      if (!isSubpageAvailable(page, { analysisEnabled, notesEnabled })) return;

      const browserWindow = getBrowserWindow();
      const history = browserWindow?.history;
      if (!history) {
        setMobileSubpage(page);
        return;
      }

      const currentMarker = getHistoryMarker(history.state);
      if (currentMarker?.page === page && currentMarker.viewKey === viewKey) {
        setMobileSubpage(page);
        return;
      }

      try {
        history.pushState(
          buildHistoryState(history.state, page, viewKey),
          '',
          browserWindow.location.href,
        );
      } catch {
        // Restricted browser contexts can reject History API writes; local navigation still works.
      }
      setMobileSubpage(page);
    },
    [analysisEnabled, notesEnabled, viewKey],
  );

  const closeMobileSubpage = useCallback(() => {
    const browserWindow = getBrowserWindow();
    const history = browserWindow?.history;
    const currentMarker = getHistoryMarker(history?.state);
    const ownsCurrentEntry =
      currentMarker?.viewKey === viewKey && currentMarker.page === mobileSubpage;

    setMobileSubpage(null);
    if (!ownsCurrentEntry) return;

    try {
      history.back();
    } catch {
      // The local state is already closed, which is the intended fallback.
    }
  }, [mobileSubpage, viewKey]);

  return {
    closeMobileSubpage,
    mobileSubpage,
    openMobileSubpage,
  };
}
