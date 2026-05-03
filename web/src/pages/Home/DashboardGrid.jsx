import { useCallback, useRef, useState } from 'preact/hooks';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { signal } from '@preact/signals';
import PropTypes from 'prop-types';
import SortableCard from './SortableCard.jsx';
import {
  getDashboardLayout,
  normalizeDashboardLayout,
  setDashboardLayout,
} from '../../utils/dashboardManager.js';

export const dashboardLayout = signal(getDashboardLayout());

const CARD_META = {
  process: {
    title: 'Process',
    className: 'home-dashboard-card home-dashboard-card-process',
  },
  status: {
    title: 'Status',
    className: 'home-dashboard-card home-dashboard-card-options',
  },
  chart: {
    title: 'Temperature & Pressure',
    className: 'home-dashboard-card home-dashboard-card-chart',
    fullHeight: true,
  },
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function reorderCards(cards, activeId, overId) {
  const oldIndex = cards.findIndex(card => card.id === activeId);
  const newIndex = cards.findIndex(card => card.id === overId);

  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
    return cards;
  }

  return arrayMove(cards, oldIndex, newIndex);
}

export default function DashboardGrid({ process, status, chart }) {
  const [activeId, setActiveId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [resizingId, setResizingId] = useState(null);
  const gridRef = useRef(null);
  const resizeRef = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 300, tolerance: 5 },
    }),
  );

  const handleDragStart = useCallback(event => {
    setActiveId(event.active.id);
  }, []);

  const handleDragOver = useCallback(event => {
    setDragOverId(event.over?.id || null);
  }, []);

  const handleDragEnd = useCallback(event => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const currentCards = dashboardLayout.value.cards;
      const activeIndex = currentCards.findIndex(card => card.id === active.id);
      const overIndex = currentCards.findIndex(card => card.id === over.id);
      const cards = reorderCards(currentCards, active.id, over.id).map((card, index) => {
        if (activeIndex === 2 || overIndex === 2) {
          if (index === 0 || index === 1) return { ...card, cols: 6 };
          return { ...card, cols: 12 };
        }

        return card;
      });

      dashboardLayout.value = normalizeDashboardLayout({ cards });
    }

    setActiveId(null);
    setDragOverId(null);
    setDashboardLayout(dashboardLayout.value);
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setDragOverId(null);
  }, []);

  const startResize = useCallback(
    (cardId, event) => {
      if (resizeRef.current) return;

      const startCard = dashboardLayout.value.cards.find(card => card.id === cardId);
      if (!startCard) return;

      const grid = gridRef.current;
      const gridRect = grid?.getBoundingClientRect();
      const gridStyles = grid ? window.getComputedStyle(grid) : null;
      const gap = gridStyles ? parseFloat(gridStyles.columnGap || gridStyles.gap || '16') : 16;
      const columnWidth = gridRect ? (gridRect.width - gap) / 12 : 80;
      const rowHeight = 120 + gap;
      const startIndex = dashboardLayout.value.cards.findIndex(card => card.id === cardId);

      resizeRef.current = {
        cardId,
        startIndex,
        startX: event.clientX,
        startY: event.clientY,
        startCols: startCard.cols || 1,
        startRows: startCard.rows || 1,
        columnWidth,
        rowHeight,
      };
      setResizingId(cardId);

      const onMove = moveEvent => {
        if (!resizeRef.current) return;

        moveEvent.preventDefault();

        const resize = resizeRef.current;
        const deltaCols = Math.round(
          (moveEvent.clientX - resize.startX) / Math.max(1, resize.columnWidth),
        );
        const deltaRows = Math.round(
          (moveEvent.clientY - resize.startY) / Math.max(1, resize.rowHeight / 2),
        );
        const nextCols = clamp(resize.startCols + deltaCols, 3, 9);
        const nextRows = clamp(resize.startRows + deltaRows, 1, 3);

        const cards = dashboardLayout.value.cards.map((card, index) => {
          if (resize.startIndex === 2) {
            return index === 2 ? { ...card, cols: 12, rows: nextRows } : card;
          }

          if (index === 0) {
            return {
              ...card,
              cols: resize.startIndex === 0 ? nextCols : 12 - nextCols,
              rows: card.id === resize.cardId ? nextRows : card.rows,
            };
          }

          if (index === 1) {
            return {
              ...card,
              cols: resize.startIndex === 1 ? nextCols : 12 - nextCols,
              rows: card.id === resize.cardId ? nextRows : card.rows,
            };
          }

          return { ...card, cols: 12 };
        });

        dashboardLayout.value = normalizeDashboardLayout({ cards });
      };

      const onUp = () => {
        if (resizeRef.current) {
          setDashboardLayout(dashboardLayout.value);
        }

        resizeRef.current = null;
        setResizingId(null);
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointercancel', onUp);
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
    },
    [],
  );

  const cardContentMap = { process, status, chart };
  const cardIds = dashboardLayout.value.cards.map(card => card.id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={cardIds} strategy={rectSortingStrategy}>
        <div ref={gridRef} className='dashboard-grid'>
          {dashboardLayout.value.cards.map((cardConfig, index) => {
            const meta = CARD_META[cardConfig.id];
            const cols = index === 2 ? 12 : cardConfig.cols || 6;

            return (
              <SortableCard
                key={cardConfig.id}
                id={cardConfig.id}
                title={meta.title}
                cols={cols}
                rows={cardConfig.rows || 1}
                className={meta.className}
                fullHeight={meta.fullHeight}
                onResizeStart={startResize}
                isDragOver={Boolean(activeId && dragOverId === cardConfig.id)}
                isResizing={resizingId === cardConfig.id}
              >
                {cardContentMap[cardConfig.id]}
              </SortableCard>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}

DashboardGrid.propTypes = {
  process: PropTypes.node,
  status: PropTypes.node,
  chart: PropTypes.node,
};
