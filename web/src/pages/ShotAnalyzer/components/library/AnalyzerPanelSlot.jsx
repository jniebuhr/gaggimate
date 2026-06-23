import { AnalyzerActionBar } from '../AnalyzerActionBar';
import { StatusBar } from './StatusBar';
import { faFileImport } from '@fortawesome/free-solid-svg-icons/faFileImport';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

function hasFileDrag(event) {
  const types = event?.dataTransfer?.types;
  if (!types) return false;
  if (Array.isArray(types)) return types.includes('Files');
  if (typeof types.contains === 'function') return types.contains('Files');
  return false;
}

function AnalyzerPanelSlot({ statusBarProps, actionBarProps, showActionBar = true }) {
  const dragDepthRef = useRef(0);
  const dragResetTimerRef = useRef(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isWindowFileDragActive, setIsWindowFileDragActive] = useState(false);
  const isImporting = Boolean(actionBarProps?.isImporting);
  const onImport = actionBarProps?.onImport;
  const isDropzoneActive = !isImporting && (isDragActive || isWindowFileDragActive);

  const clearDragResetTimer = useCallback(() => {
    if (dragResetTimerRef.current) {
      globalThis.window?.clearTimeout(dragResetTimerRef.current);
      dragResetTimerRef.current = null;
    }
  }, []);

  const clearDragState = useCallback(() => {
    clearDragResetTimer();
    dragDepthRef.current = 0;
    setIsDragActive(false);
    setIsWindowFileDragActive(false);
  }, [clearDragResetTimer]);

  const armDragResetTimer = useCallback(() => {
    clearDragResetTimer();
    dragResetTimerRef.current = globalThis.window?.setTimeout(() => {
      clearDragState();
    }, 350);
  }, [clearDragResetTimer, clearDragState]);

  useEffect(() => {
    if (isImporting) {
      clearDragState();
      return undefined;
    }
    if (globalThis.window === undefined) return undefined;

    const handleWindowDragEnter = event => {
      if (!hasFileDrag(event)) return;
      setIsWindowFileDragActive(true);
      armDragResetTimer();
    };

    const handleWindowDragOver = event => {
      if (!hasFileDrag(event)) return;
      event.preventDefault();
      setIsWindowFileDragActive(true);
      event.dataTransfer.dropEffect = 'copy';
      armDragResetTimer();
    };

    const handleWindowDragLeave = event => {
      const isOutsideWindow =
        event.clientX <= 0 ||
        event.clientY <= 0 ||
        event.clientX >= globalThis.window.innerWidth ||
        event.clientY >= globalThis.window.innerHeight;
      if (isOutsideWindow) clearDragState();
    };

    const handleWindowDrop = event => {
      if (!hasFileDrag(event)) return;
      event.preventDefault();
      clearDragState();
    };

    globalThis.window.addEventListener('dragenter', handleWindowDragEnter);
    globalThis.window.addEventListener('dragover', handleWindowDragOver);
    globalThis.window.addEventListener('dragleave', handleWindowDragLeave);
    globalThis.window.addEventListener('drop', handleWindowDrop);
    globalThis.window.addEventListener('dragend', clearDragState);

    return () => {
      globalThis.window.removeEventListener('dragenter', handleWindowDragEnter);
      globalThis.window.removeEventListener('dragover', handleWindowDragOver);
      globalThis.window.removeEventListener('dragleave', handleWindowDragLeave);
      globalThis.window.removeEventListener('drop', handleWindowDrop);
      globalThis.window.removeEventListener('dragend', clearDragState);
      clearDragResetTimer();
    };
  }, [armDragResetTimer, clearDragResetTimer, clearDragState, isImporting]);

  const handleDragEnter = event => {
    if (isImporting || !hasFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    setIsDragActive(true);
    armDragResetTimer();
  };

  const handleDragOver = event => {
    if (isImporting || !hasFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    if (!isDragActive) setIsDragActive(true);
    armDragResetTimer();
  };

  const handleDragLeave = event => {
    if (isImporting || !isDragActive) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragActive(false);
  };

  const handleDrop = event => {
    if (isImporting || !hasFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    clearDragState();
    const files = Array.from(event.dataTransfer.files || []);
    if (files.length > 0) onImport?.(files);
  };

  return (
    <section
      className={`relative transition-all ${
        isDropzoneActive ? 'bg-primary/8 ring-primary/30 rounded-lg shadow-lg ring-2' : ''
      }`}
      aria-label='Shot and profile import dropzone'
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDropzoneActive ? (
        <div className='border-primary/55 bg-base-100/90 text-primary pointer-events-none absolute inset-0 z-[30] flex items-center justify-center rounded-lg border-2 border-dashed shadow-inner'>
          <div className='border-primary/25 bg-base-100/90 flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium shadow-sm'>
            <FontAwesomeIcon icon={faFileImport} className='text-sm' />
            <span>Drop shot or profile JSON here</span>
          </div>
        </div>
      ) : null}
      <StatusBar {...statusBarProps} />
      {showActionBar ? <AnalyzerActionBar {...actionBarProps} /> : null}
    </section>
  );
}

export function LibraryPanelStatusSlots({
  collapsed,
  compareMode,
  primaryActionBarProps,
  primaryStatusBarProps,
  secondaryActionBarProps,
  secondaryStatusBarProps,
}) {
  return (
    <div
      className={`app-card-surface ${compareMode ? 'overflow-visible' : 'overflow-hidden'} rounded-xl transition-all duration-200 ${
        collapsed ? '' : 'library-panel-statusbar-surface--open rounded-b-none'
      }`}
    >
      {compareMode ? (
        <div>
          <AnalyzerPanelSlot
            statusBarProps={{
              ...primaryStatusBarProps,
              compareBadgeNumber: 1,
            }}
            actionBarProps={primaryActionBarProps}
          />
          <AnalyzerPanelSlot
            statusBarProps={secondaryStatusBarProps}
            actionBarProps={secondaryActionBarProps}
            showActionBar={false}
          />
        </div>
      ) : (
        <AnalyzerPanelSlot
          statusBarProps={primaryStatusBarProps}
          actionBarProps={primaryActionBarProps}
        />
      )}
    </div>
  );
}
