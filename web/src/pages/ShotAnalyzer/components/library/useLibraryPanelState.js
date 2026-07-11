/* global globalThis */

/** Owns asynchronous library loading, persisted filters, hotkeys, and sticky layout state. */

import { libraryService } from '../../services/LibraryService';
import {
  buildPromotedLibraryItems,
  buildShotNavigationItems,
  getLibraryRequestSource,
} from './libraryData';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

const STATUS_BAR_CARD_GAP = 12;

export function useLibraryPanelLayoutState({ sentinelRef, barSlotRef, barRef }) {
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
  }, [updateRect]);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const resizeObserver = new ResizeObserver(() => updateRect());
    if (barRef.current) resizeObserver.observe(barRef.current);
    if (barSlotRef.current) resizeObserver.observe(barSlotRef.current);
    return () => resizeObserver.disconnect();
  }, [barRef, barSlotRef, updateRect]);

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
      if (panelRef.current && !panelRef.current.contains(event.target)) {
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
  debouncedProfilesSearch,
  debouncedShotsSearch,
  normalizedCurrentProfileName,
  normalizedCurrentShotProfileName,
  pinnedProfiles,
  pinnedShotsByProfile,
  profilesPinnedFirst,
  profilesSort,
  profilesSourceFilter,
  selectionPromotionsEnabled,
  setLoading,
  setNavigationShots,
  setProfiles,
  setShots,
  shotsPinnedFirst,
  shotsSort,
  shotsSourceFilter,
}) {
  const refreshIdRef = useRef(0);

  const refreshLibraries = useCallback(async () => {
    const id = ++refreshIdRef.current;
    setLoading(true);
    try {
      const [shotsData, profilesData] = await Promise.all([
        libraryService.getAllShots(getLibraryRequestSource(shotsSourceFilter)),
        libraryService.getAllProfiles(getLibraryRequestSource(profilesSourceFilter)),
      ]);

      if (id !== refreshIdRef.current) return;
      const { nextShots, nextProfiles } = buildPromotedLibraryItems({
        shotsData,
        profilesData,
        shotSearch: debouncedShotsSearch,
        profileSearch: debouncedProfilesSearch,
        shotsSort,
        profilesSort,
        normalizedCurrentProfileName: selectionPromotionsEnabled
          ? normalizedCurrentProfileName
          : '',
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
    } catch (error) {
      if (id !== refreshIdRef.current) return;
      console.error('Library refresh failed:', error);
    } finally {
      if (id === refreshIdRef.current) {
        setLoading(false);
      }
    }
  }, [
    debouncedProfilesSearch,
    debouncedShotsSearch,
    normalizedCurrentProfileName,
    normalizedCurrentShotProfileName,
    pinnedProfiles,
    pinnedShotsByProfile,
    profilesPinnedFirst,
    profilesSort,
    profilesSourceFilter,
    selectionPromotionsEnabled,
    setLoading,
    setNavigationShots,
    setProfiles,
    setShots,
    shotsPinnedFirst,
    shotsSort,
    shotsSourceFilter,
  ]);

  useEffect(() => {
    refreshLibraries();
  }, [refreshLibraries]);

  return refreshLibraries;
}
