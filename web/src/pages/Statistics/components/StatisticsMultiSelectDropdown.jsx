import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

const LONG_PRESS_MS = 220;
const MOVE_CANCEL_PX = 10;

// Reusable multiselect dropdown with desktop modifiers and touch "paint" selection.
function normalizeSearchText(value) {
  return String(value ?? '')
    .toLowerCase()
    .trim();
}

function buildOrderedSelection(items, nextSet) {
  const ordered = [];
  const seen = new Set();
  for (const item of items || []) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    if (nextSet.has(item.id)) ordered.push(item.id);
  }
  return ordered;
}

function getAccentTriggerClasses(accentTone, hasSelection = false) {
  if (accentTone === 'secondary') {
    return hasSelection
      ? 'border-secondary bg-secondary text-secondary-content hover:border-secondary hover:bg-secondary'
      : 'border-secondary/30 bg-secondary/10 text-secondary hover:border-secondary/45 hover:bg-secondary/15';
  }
  if (accentTone === 'primary') {
    return hasSelection
      ? 'border-primary bg-primary text-primary-content hover:border-primary hover:bg-primary'
      : 'border-primary/25 bg-primary/10 text-primary hover:border-primary/40 hover:bg-primary/15';
  }
  return 'border-base-content/10 bg-base-100/50 text-base-content hover:bg-base-200/70';
}

function getAccentCircleClasses(accentTone, selected) {
  if (!selected) return 'border-base-content/20 bg-base-100/40';
  if (accentTone === 'secondary') return 'border-secondary/70 bg-secondary/20';
  if (accentTone === 'primary') return 'border-primary/70 bg-primary/20';
  return 'border-base-content/45 bg-base-content/10';
}

export function StatisticsMultiSelectDropdown({
  label,
  items,
  selectedIds,
  onChange,
  disabled = false,
  accentTone = 'neutral',
  emptyText = 'Select...',
  maxVisibleItems = 12,
}) {
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const anchorIndexRef = useRef(-1);
  const suppressRowClickRef = useRef(false);
  const touchStateRef = useRef(null);
  const latestSelectedSetRef = useRef(new Set());

  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const selectedSet = useMemo(() => new Set(selectedIds || []), [selectedIds]);
  latestSelectedSetRef.current = selectedSet;
  const normalizedSearchTerm = normalizeSearchText(searchTerm);

  const filteredItems = useMemo(() => {
    if (!normalizedSearchTerm) return items || [];
    return (items || []).filter(item => {
      const haystack = normalizeSearchText(
        `${item?.primary || ''} ${item?.secondary || ''} ${item?.searchText || ''}`,
      );
      return haystack.includes(normalizedSearchTerm);
    });
  }, [items, normalizedSearchTerm]);

  const commitSelection = nextSet => {
    latestSelectedSetRef.current = new Set(nextSet);
    const next = buildOrderedSelection(items || [], nextSet);
    onChange?.(next);
  };

  const setSingleSelection = (id, index) => {
    const nextSet = new Set();
    nextSet.add(id);
    commitSelection(nextSet);
    anchorIndexRef.current = index;
  };

  const toggleAdditiveSelection = (id, index) => {
    const nextSet = new Set(selectedSet);
    if (nextSet.has(id)) nextSet.delete(id);
    else nextSet.add(id);
    commitSelection(nextSet);
    anchorIndexRef.current = index;
  };

  const applyRangeSelection = (index, additive) => {
    if (!Number.isInteger(index) || index < 0 || index >= filteredItems.length) return;
    const anchorIndex = anchorIndexRef.current;
    if (!Number.isInteger(anchorIndex) || anchorIndex < 0 || anchorIndex >= filteredItems.length) {
      const id = filteredItems[index]?.id;
      if (id) setSingleSelection(id, index);
      return;
    }

    const start = Math.min(anchorIndex, index);
    const end = Math.max(anchorIndex, index);
    const rangeIds = filteredItems
      .slice(start, end + 1)
      .map(item => item.id)
      .filter(Boolean);

    const nextSet = additive ? new Set(selectedSet) : new Set();
    rangeIds.forEach(id => nextSet.add(id));
    commitSelection(nextSet);
  };

  const handleItemInteraction = (itemId, index, event, { circleOnlyToggle = false } = {}) => {
    if (!itemId || disabled) return;

    if (suppressRowClickRef.current) {
      suppressRowClickRef.current = false;
      return;
    }

    const isShift = !!event?.shiftKey;
    const isMetaOrCtrl = !!event?.metaKey || !!event?.ctrlKey;

    if (isShift) {
      applyRangeSelection(index, isMetaOrCtrl || circleOnlyToggle);
      anchorIndexRef.current = index;
      return;
    }

    if (circleOnlyToggle || isMetaOrCtrl) {
      toggleAdditiveSelection(itemId, index);
      return;
    }

    setSingleSelection(itemId, index);
  };

  const applyPaintToId = (itemId, shouldSelect) => {
    if (!itemId) return;
    const nextSet = new Set(latestSelectedSetRef.current);
    if (shouldSelect) nextSet.add(itemId);
    else nextSet.delete(itemId);
    commitSelection(nextSet);
  };

  const cleanupTouchState = () => {
    const state = touchStateRef.current;
    if (!state) return;

    if (state.timer) {
      clearTimeout(state.timer);
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('pointermove', state.onMove);
      window.removeEventListener('pointerup', state.onUp);
      window.removeEventListener('pointercancel', state.onCancel);
    }

    touchStateRef.current = null;
  };

  const beginPaintMode = state => {
    if (!touchStateRef.current || touchStateRef.current.pointerId !== state.pointerId) return;
    touchStateRef.current.active = true;
    touchStateRef.current.timer = null;
    // Apply the start item immediately once long-press mode is confirmed.
    applyPaintToId(state.startItemId, state.paintSelect);
    touchStateRef.current.visitedIds.add(state.startItemId);
    suppressRowClickRef.current = true;
  };

  const handleCirclePointerDown = (event, itemId) => {
    if (disabled || !itemId) return;
    const pointerType = event.pointerType || 'mouse';
    if (pointerType === 'mouse') return;

    const startX = event.clientX;
    const startY = event.clientY;
    const paintSelect = !selectedSet.has(itemId);

    const state = {
      pointerId: event.pointerId,
      startItemId: itemId,
      startX,
      startY,
      paintSelect,
      active: false,
      timer: null,
      visitedIds: new Set(),
      onMove: null,
      onUp: null,
      onCancel: null,
    };

    const onMove = moveEvent => {
      const current = touchStateRef.current;
      if (!current || moveEvent.pointerId !== current.pointerId) return;

      if (!current.active) {
        const dx = moveEvent.clientX - current.startX;
        const dy = moveEvent.clientY - current.startY;
        if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
          cleanupTouchState();
        }
        return;
      }

      const el = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
      const row = el?.closest?.('[data-stat-multi-item-id]');
      const hitId = row?.getAttribute?.('data-stat-multi-item-id');
      if (!hitId || current.visitedIds.has(hitId)) return;
      current.visitedIds.add(hitId);
      applyPaintToId(hitId, current.paintSelect);
    };

    const endGesture = endEvent => {
      const current = touchStateRef.current;
      if (!current || endEvent.pointerId !== current.pointerId) return;
      if (current.active) suppressRowClickRef.current = true;
      cleanupTouchState();
    };

    state.onMove = onMove;
    state.onUp = endGesture;
    state.onCancel = endGesture;
    state.timer = window.setTimeout(() => beginPaintMode(state), LONG_PRESS_MS);

    touchStateRef.current = state;

    if (typeof window !== 'undefined') {
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerup', endGesture, { passive: true });
      window.addEventListener('pointercancel', endGesture, { passive: true });
    }
  };

  useEffect(() => () => cleanupTouchState(), []);

  useEffect(() => {
    if (!open) return;

    const handleDocumentPointerDown = event => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus?.();
      }
    };

    document.addEventListener('pointerdown', handleDocumentPointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      listRef.current?.querySelector?.('input')?.focus?.();
    }, 0);
    return () => clearTimeout(timer);
  }, [open]);

  // Prune stale selections when the available items change (e.g. after a source switch).
  // onChange is intentionally excluded: it is not memoized and including it would cause
  // this effect to run on every render without any actual item/selection change.
  useEffect(() => {
    const validIds = new Set((items || []).map(item => item.id).filter(Boolean));
    const pruned = (selectedIds || []).filter(id => validIds.has(id));
    if (pruned.length !== (selectedIds || []).length) {
      onChange?.(pruned);
    }
  }, [items, selectedIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedCount = selectedSet.size;
  const triggerText = selectedCount > 0 ? `${label} (${selectedCount})` : emptyText;
  const panelMaxHeight = Math.max(8, Number(maxVisibleItems) || 12) * 36;

  return (
    <div ref={rootRef} className='relative'>
      <button
        ref={triggerRef}
        type='button'
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup='listbox'
        onClick={() => setOpen(v => !v)}
        className={`inline-flex h-11 min-h-0 max-w-[15rem] min-w-[8.5rem] items-center justify-between gap-1 rounded-lg border px-2 text-xs font-semibold shadow-sm transition-colors ${getAccentTriggerClasses(accentTone, selectedCount > 0)} disabled:cursor-not-allowed disabled:opacity-40`}
      >
        <span className='truncate text-left'>{triggerText}</span>
        <span className='-ml-0.5 text-[10px] opacity-65'>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div
          ref={listRef}
          className='bg-base-100/95 border-base-content/10 absolute top-full left-0 z-[60] mt-2 w-[min(92vw,28rem)] rounded-xl border shadow-xl backdrop-blur-md'
        >
          <div className='border-base-content/8 border-b p-2'>
            <input
              type='text'
              value={searchTerm}
              onInput={e => setSearchTerm(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}...`}
              className='input input-sm input-bordered border-base-content/10 bg-base-100/70 h-8 min-h-0 w-full text-xs'
            />
          </div>

          <div
            role='listbox'
            aria-multiselectable='true'
            className='overscroll-contain p-1'
            style={{ maxHeight: `${panelMaxHeight}px`, overflowY: 'auto' }}
          >
            {filteredItems.length === 0 ? (
              <div className='px-2 py-3 text-xs opacity-60'>No items found.</div>
            ) : (
              filteredItems.map((item, index) => {
                const isSelected = selectedSet.has(item.id);
                return (
                  <div
                    key={item.id}
                    role='option'
                    aria-selected={isSelected}
                    data-stat-multi-item-id={item.id}
                    className={`group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${
                      isSelected ? 'bg-base-content/6' : 'hover:bg-base-content/4'
                    }`}
                    onClick={event => handleItemInteraction(item.id, index, event)}
                  >
                    <button
                      type='button'
                      aria-label={`${isSelected ? 'Deselect' : 'Select'} ${item.primary || item.id}`}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${getAccentCircleClasses(accentTone, isSelected)}`}
                      onClick={event => {
                        event.stopPropagation();
                        handleItemInteraction(item.id, index, event, { circleOnlyToggle: true });
                      }}
                      onPointerDown={event => {
                        event.stopPropagation();
                        handleCirclePointerDown(event, item.id);
                      }}
                    >
                      <span
                        className={`h-2.5 w-2.5 rounded-full transition-opacity ${
                          isSelected
                            ? accentTone === 'secondary'
                              ? 'bg-secondary'
                              : accentTone === 'primary'
                                ? 'bg-primary'
                                : 'bg-base-content'
                            : 'bg-transparent opacity-0'
                        }`}
                      />
                    </button>

                    <div className='min-w-0 flex-1'>
                      <div className='truncate text-xs font-semibold'>
                        {item.primary || item.id}
                      </div>
                      {item.secondary && (
                        <div className='truncate text-[10px] opacity-65'>{item.secondary}</div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className='border-base-content/8 flex items-center justify-between border-t px-2 py-1.5 text-[10px] opacity-60'>
            <span>Shift = Range</span>
            <span>Cmd/Ctrl = Add</span>
          </div>
        </div>
      )}
    </div>
  );
}
