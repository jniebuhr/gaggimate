/** Owns asynchronous library loading, persisted filters, hotkeys, and sticky layout state. */

import { libraryService } from '../../services/LibraryService';
import { buildPromotedLibraryItems, buildShotNavigationItems } from './libraryData';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

const STATUS_BAR_CARD_GAP = 12;

export function useLibraryPanelLayoutState({ sentinelRef, barSlotRef, barRef, active = true }) {
  const [isStuck, setIsStuck] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    Boolean(globalThis.window?.matchMedia('(max-width: 1023px)').matches),
  );
  const [barRect, setBarRect] = useState({ width: 0, left: 0, height: 64 });

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => setIsStuck(!entry.isIntersecting), {
      threshold: 0,
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinelRef]);

  useEffect(() => {
    if (globalThis.window === undefined) return undefined;

    const mediaQuery = globalThis.window.matchMedia('(max-width: 1023px)');
    const handleChange = event => setIsMobileViewport(event.matches);

    setIsMobileViewport(mediaQuery.matches);

    mediaQuery.addEventListener?.('change', handleChange);
    return () => mediaQuery.removeEventListener?.('change', handleChange);
  }, []);

  const updateRect = useCallback(() => {
    const anchor = barSlotRef.current || sentinelRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const nextRect = {
      width: rect.width,
      left: rect.left,
      height: barRef.current?.offsetHeight || 64,
    };

    setBarRect(previousRect =>
      Math.round(previousRect.width) === Math.round(nextRect.width) &&
      Math.round(previousRect.left) === Math.round(nextRect.left) &&
      Math.round(previousRect.height) === Math.round(nextRect.height)
        ? previousRect
        : nextRect,
    );
  }, [barRef, barSlotRef, sentinelRef]);

  useEffect(() => {
    updateRect();
    globalThis.window?.addEventListener('resize', updateRect);
    return () => globalThis.window?.removeEventListener('resize', updateRect);
  }, [updateRect, active]);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const resizeObserver = new ResizeObserver(() => updateRect());
    if (barRef.current) resizeObserver.observe(barRef.current);
    if (barSlotRef.current) resizeObserver.observe(barSlotRef.current);
    return () => resizeObserver.disconnect();
  }, [barRef, barSlotRef, updateRect, active]);

  return {
    isStuck,
    isMobileViewport,
    barRect,
  };
}

export function useLibraryPanelHotkeys({
  collapsed,
  librarySelectionTarget,
  openLibraryForTarget,
  setCollapsed,
  handleStatusBarCompareToggle,
}) {
  useEffect(() => {
    const handleKeyDown = event => {
      if (event.defaultPrevented || event.repeat) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isLibraryHotkeyTypingTarget(event.target)) return;

      const key = String(event.key || '').toLowerCase();
      if (key === 'x') {
        event.preventDefault();
        if (collapsed) {
          openLibraryForTarget(librarySelectionTarget || 'primaryShot');
        } else {
          setCollapsed(true);
        }
        return;
      }

      if (key === 'c') {
        event.preventDefault();
        handleStatusBarCompareToggle();
      }
    };

    globalThis.document?.addEventListener('keydown', handleKeyDown);
    return () => globalThis.document?.removeEventListener('keydown', handleKeyDown);
  }, [
    collapsed,
    librarySelectionTarget,
    openLibraryForTarget,
    setCollapsed,
    handleStatusBarCompareToggle,
  ]);
}

export function getLibraryPanelLayoutStyles({ collapsed, isMobileViewport, isStuck, barRect }) {
  const shouldBeFixed = !collapsed || (!isMobileViewport && isStuck);
  const barSlotHeight = barRect.height + (collapsed ? STATUS_BAR_CARD_GAP : 0);
  const barSlotStyle = { height: `${barSlotHeight}px` };
  const barStyle = shouldBeFixed
    ? {
        position: 'fixed',
        top: 0,
        left: `${barRect.left}px`,
        width: `${barRect.width}px`,
        zIndex: 50,
      }
    : {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
      };
  const dropdownTop = barRect.height;

  return {
    barStyle,
    barSlotHeight,
    barSlotStyle,
    dropdownTop,
    dropdownStyle: {
      position: 'fixed',
      top: `${dropdownTop}px`,
      left: `${barRect.left}px`,
      width: `${barRect.width}px`,
      zIndex: 49,
    },
    desktopSectionHeight: isMobileViewport
      ? undefined
      : `max(18rem, calc(100dvh - ${dropdownTop}px - 2rem))`,
  };
}

function isLibraryHotkeyTypingTarget(target) {
  const activeElement =
    typeof Element !== 'undefined' && target instanceof Element
      ? target
      : globalThis.document?.activeElement;
  if (!activeElement) return false;
  const tag = activeElement.tagName?.toLowerCase();
  if (activeElement.isContentEditable) return true;
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return !!activeElement.closest(
    'input, textarea, select, [contenteditable="true"], [role="textbox"]',
  );
}

export function useDebouncedLibraryValue(value, delayMs = 250) {
  const [debouncedValue, setDebouncedValue] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs, value]);

  return debouncedValue;
}

export function useLibraryServiceApi(apiService) {
  useEffect(() => {
    if (apiService) libraryService.setApiService(apiService);
  }, [apiService]);
}

export function useLibrarySelectionTargetSync({
  compareMode,
  currentShot,
  librarySelectionTarget,
  secondaryShot,
  setLibrarySelectionTarget,
}) {
  useEffect(() => {
    if (!compareMode) {
      setLibrarySelectionTarget('primaryShot');
    }
  }, [compareMode, setLibrarySelectionTarget]);

  useEffect(() => {
    if (compareMode && currentShot && !secondaryShot && librarySelectionTarget === 'primaryShot') {
      setLibrarySelectionTarget('secondaryShot');
    }
  }, [compareMode, currentShot, secondaryShot, librarySelectionTarget, setLibrarySelectionTarget]);
}

export function useCloseLibraryOnOutsideClick({ collapsed, panelRef, setCollapsed }) {
  useEffect(() => {
    if (collapsed) return;
    const handleOutsideClick = event => {
      const target = event.target;
      const isLibraryActionMenuClick = target?.closest?.('[data-library-actions-menu]');
      if (panelRef.current && !panelRef.current.contains(target) && !isLibraryActionMenuClick) {
        setCollapsed(true);
      }
    };
    globalThis.document?.addEventListener('mousedown', handleOutsideClick);
    return () => globalThis.document?.removeEventListener('mousedown', handleOutsideClick);
  }, [collapsed, panelRef, setCollapsed]);
}

export function useAnalyzerStickyOffset(panelRef, barSlotHeight) {
  useEffect(() => {
    const pageElement = panelRef.current?.closest?.('.shot-analyzer-page');
    if (!pageElement) return undefined;

    pageElement.style.setProperty('--analyzer-sticky-offset', `${barSlotHeight}px`);

    return () => {
      pageElement.style.removeProperty('--analyzer-sticky-offset');
    };
  }, [barSlotHeight, panelRef]);
}

export function useLibraryRefresh({
  connected,
  shotRatingFilter,
  debouncedProfilesSearch,
  debouncedShotsSearch,
  normalizedCurrentProfileName,
  normalizedCurrentShotProfileName,
  pinnedProfiles,
  pinnedShotsByProfile,
  profilesPinnedFirst,
  profilesSort,
  selectionPromotionsEnabled,
  setNavigationShots,
  setProfiles,
  setShots,
  shotsPinnedFirst,
  shotsSort,
}) {
  const refreshIdRef = useRef(0);
  const [shotsData, setShotsData] = useState([]);
  const [profilesData, setProfilesData] = useState([]);
  const [shotsLoading, setShotsLoading] = useState(true);
  const [profilesLoading, setProfilesLoading] = useState(true);

  const shotRefreshIdRef = useRef(0);
  const refreshShots = useCallback(async () => {
    const id = ++shotRefreshIdRef.current;
    setShotsLoading(true);
    try {
      const data = await libraryService.getAllShots();
      if (id === shotRefreshIdRef.current) setShotsData(data);
    } finally {
      if (id === shotRefreshIdRef.current) setShotsLoading(false);
    }
  }, []);

  const refreshLibraries = useCallback(async () => {
    const id = ++refreshIdRef.current;
    setProfilesLoading(true);
    try {
      await Promise.all([
        refreshShots(),
        libraryService.getAllProfiles().then(data => {
          if (id !== refreshIdRef.current) return;
          setProfilesData(data);
          setProfilesLoading(false);
        }),
      ]);
    } catch (error) {
      console.error('Library refresh failed:', error);
    } finally {
      if (id === refreshIdRef.current) {
        setProfilesLoading(false);
      }
    }
  }, [refreshShots]);

  useEffect(() => {
    void refreshLibraries();
    return () => {
      refreshIdRef.current += 1;
      shotRefreshIdRef.current += 1;
    };
  }, [connected, refreshLibraries]);

  useEffect(() => {
    const { nextShots, nextProfiles } = buildPromotedLibraryItems({
      shotsData,
      profilesData,
      shotSearch: debouncedShotsSearch,
      shotRatingFilter,
      profileSearch: debouncedProfilesSearch,
      shotsSort,
      profilesSort,
      normalizedCurrentProfileName: selectionPromotionsEnabled ? normalizedCurrentProfileName : '',
      normalizedCurrentShotProfileName: selectionPromotionsEnabled
        ? normalizedCurrentShotProfileName
        : '',
      pinnedProfiles,
      pinnedShotsByProfile,
      shotsPinnedFirst,
      profilesPinnedFirst,
      selectionPromotionsEnabled,
    });
    const nextNavigationShots = buildShotNavigationItems({
      shotsData,
      shotsSort,
      shotsPinnedFirst,
      pinnedShotsByProfile,
    });

    setShots(nextShots);
    setProfiles(nextProfiles);
    setNavigationShots(nextNavigationShots);
  }, [
    shotsData,
    profilesData,
    debouncedProfilesSearch,
    debouncedShotsSearch,
    shotRatingFilter,
    normalizedCurrentProfileName,
    normalizedCurrentShotProfileName,
    pinnedProfiles,
    pinnedShotsByProfile,
    profilesPinnedFirst,
    profilesSort,
    selectionPromotionsEnabled,
    setNavigationShots,
    setProfiles,
    setShots,
    shotsPinnedFirst,
    shotsSort,
  ]);

  return { refreshLibraries, refreshShots, shotsLoading, profilesLoading };
}
