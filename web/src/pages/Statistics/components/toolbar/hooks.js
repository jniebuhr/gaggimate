// Custom hooks for StatisticsToolbar: keyboard shortcut registration
import { useEffect } from 'preact/hooks';
import { closeOpenToolbarDetails, isToolbarFloatingPanelTarget } from './helpers';

export function useAdvancedSearchSync({
  query,
  parseErrorsLength,
  parseWarningsLength,
  showAdvancedSearch,
  setShowAdvancedSearch,
  setShowDslSelectionPreview,
}) {
  useEffect(() => {
    if (query || parseErrorsLength > 0 || parseWarningsLength > 0) {
      setShowAdvancedSearch(true);
    }
  }, [query, parseErrorsLength, parseWarningsLength, setShowAdvancedSearch]);

  useEffect(() => {
    if (!showAdvancedSearch) {
      setShowDslSelectionPreview(false);
    }
  }, [showAdvancedSearch, setShowDslSelectionPreview]);

  useEffect(() => {
    if (!String(query || '').trim()) {
      setShowDslSelectionPreview(false);
    }
  }, [query, setShowDslSelectionPreview]);
}

export function useDslPreviewOutsideDismiss({
  shouldShowDslSelectionPreview,
  isToolbarExpanded,
  dslInputRef,
  setShowDslSelectionPreview,
}) {
  useEffect(() => {
    if (!shouldShowDslSelectionPreview || !isToolbarExpanded) return;

    const handlePointerDown = event => {
      const inputNode = dslInputRef.current;
      if (!inputNode) return;
      if (inputNode.contains(event.target)) return;
      setShowDslSelectionPreview(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [shouldShowDslSelectionPreview, isToolbarExpanded, dslInputRef, setShowDslSelectionPreview]);
}

export function useToolbarCollapseBehavior({
  isToolbarExpanded,
  isBusy,
  shouldCollapseToolbar,
  isCollapsedStripExpanded,
  toolbarContainerRef,
  setShowDslSelectionPreview,
  setIsCollapsedStripExpanded,
}) {
  useEffect(() => {
    if (isToolbarExpanded) return;

    setShowDslSelectionPreview(false);
    const toolbarNode = toolbarContainerRef.current;
    if (!toolbarNode) return;

    closeOpenToolbarDetails(toolbarNode);
  }, [isToolbarExpanded, setShowDslSelectionPreview, toolbarContainerRef]);

  useEffect(() => {
    if (!isBusy) return;

    const toolbarNode = toolbarContainerRef.current;
    if (!toolbarNode) return;

    closeOpenToolbarDetails(toolbarNode);
  }, [isBusy, toolbarContainerRef]);

  useEffect(() => {
    if (!shouldCollapseToolbar) {
      setIsCollapsedStripExpanded(false);
    }
  }, [shouldCollapseToolbar, setIsCollapsedStripExpanded]);

  useEffect(() => {
    if (!shouldCollapseToolbar || !isCollapsedStripExpanded) return;

    const handlePointerDown = event => {
      const toolbarNode = toolbarContainerRef.current;
      if (!toolbarNode) return;
      if (toolbarNode.contains(event.target)) return;
      if (isToolbarFloatingPanelTarget(event.target)) return;
      setIsCollapsedStripExpanded(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [
    shouldCollapseToolbar,
    isCollapsedStripExpanded,
    toolbarContainerRef,
    setIsCollapsedStripExpanded,
  ]);

  useEffect(() => {
    if (!shouldCollapseToolbar || !isCollapsedStripExpanded) return;

    const handleKeyDown = event => {
      if (event.key !== 'Escape') return;

      const toolbarNode = toolbarContainerRef.current;
      if (!toolbarNode) return;

      const eventTarget = event.target instanceof Element ? event.target : null;
      const activeElement = globalThis.document?.activeElement;
      const isToolbarFocused =
        (eventTarget && toolbarNode.contains(eventTarget)) ||
        isToolbarFloatingPanelTarget(eventTarget) ||
        (activeElement instanceof Element && toolbarNode.contains(activeElement)) ||
        isToolbarFloatingPanelTarget(activeElement);

      if (!isToolbarFocused) return;

      event.preventDefault();
      setIsCollapsedStripExpanded(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    shouldCollapseToolbar,
    isCollapsedStripExpanded,
    toolbarContainerRef,
    setIsCollapsedStripExpanded,
  ]);
}

export function useToolbarDropdownBehavior({ toolbarContainerRef, isToolbarExpanded }) {
  useEffect(() => {
    const toolbarNode = toolbarContainerRef.current;
    if (!toolbarNode) return;

    const handleClick = event => {
      if (event.target.closest('[data-statistics-multiselect-trigger]')) {
        closeOpenToolbarDetails(toolbarNode);
        return;
      }

      const summary = event.target.closest('summary');
      if (!summary) return;
      const details = summary.parentElement;
      if (details?.tagName !== 'DETAILS') return;
      if (details.open) return;

      toolbarNode.querySelectorAll('details[open]').forEach(detailsNode => {
        if (detailsNode !== details) {
          detailsNode.open = false;
        }
      });
    };

    toolbarNode.addEventListener('click', handleClick);
    return () => {
      toolbarNode.removeEventListener('click', handleClick);
    };
  }, [toolbarContainerRef]);

  useEffect(() => {
    if (!isToolbarExpanded) return;

    const handlePointerDown = event => {
      const toolbarNode = toolbarContainerRef.current;
      if (!toolbarNode) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      toolbarNode.querySelectorAll('details[data-close-on-outside][open]').forEach(detailsNode => {
        if (detailsNode.contains(target)) return;
        detailsNode.open = false;
      });
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isToolbarExpanded, toolbarContainerRef]);
}
