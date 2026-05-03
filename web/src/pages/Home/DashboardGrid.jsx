import { useState, useCallback, useRef } from 'preact/hooks';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay as DndDragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { signal } from '@preact/signals';
import PropTypes from 'prop-types';
import SortableCard from './SortableCard.jsx';
import { getDashboardLayout, setDashboardLayout } from '../../utils/dashboardManager.js';

// Dashboard layout signal
export const dashboardLayout = signal(getDashboardLayout());

export default function DashboardGrid({ process, status, chart }) {
  const [activeId, setActiveId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const resizeRef = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 300, tolerance: 5 },
    })
  );

  const handleDragStart = useCallback((event) => {
    setActiveId(event.active.id);
  }, []);

  const handleDragOver = useCallback((event) => {
    if (event.over) {
      setDragOverId(event.over.id);
    }
    if (event.delta) {
      setDragOffset({ x: event.delta.x, y: event.delta.y });
    }
  }, []);

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    setActiveId(null);
    setDragOverId(null);
    setDragOffset({ x: 0, y: 0 });

    if (!over || active.id === over.id) return;

    const cards = [...dashboardLayout.value.cards];
    const oldIndex = cards.findIndex(c => c.id === active.id);
    const newIndex = cards.findIndex(c => c.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const [moved] = cards.splice(oldIndex, 1);
    cards.splice(newIndex, 0, moved);

    dashboardLayout.value = { cards };
    setDashboardLayout(dashboardLayout.value);
  }, []);

  // Direct resize handler - attaches to document for reliable tracking
  const startResize = useCallback((cardId, clientX, clientY) => {
    if (resizeRef.current) return; // Already resizing

    const startCard = dashboardLayout.value.cards.find(c => c.id === cardId);
    if (!startCard) return;

    resizeRef.current = {
      cardId,
      startX: clientX,
      startY: clientY,
      startCols: startCard.cols || 1,
      startRows: startCard.rows || 1,
    };

    const onMove = (e) => {
      if (!resizeRef.current) return;
      const deltaX = e.clientX - resizeRef.current.startX;
      const deltaY = e.clientY - resizeRef.current.startY;
      const threshold = 40;

      const newCols = Math.max(1, Math.min(2, resizeRef.current.startCols + Math.round(deltaX / threshold)));
      const newRows = Math.max(1, Math.min(3, resizeRef.current.startRows + Math.round(deltaY / threshold)));

      const cards = dashboardLayout.value.cards.map(card =>
        card.id === resizeRef.current.cardId
          ? { ...card, cols: newCols, rows: newRows }
          : card
      );
      dashboardLayout.value = { cards };
    };

    const onUp = () => {
      resizeRef.current = null;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);

    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
  }, []);

  const cardContentMap = { process, status, chart };
  const cardIds = dashboardLayout.value.cards.map(c => c.id);
  const activeCard = activeId ? dashboardLayout.value.cards.find(c => c.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={cardIds} strategy={rectSortingStrategy}>
        <div className='dashboard-grid'>
          {dashboardLayout.value.cards.map(cardConfig => (
            <SortableCard
              key={cardConfig.id}
              id={cardConfig.id}
              cols={cardConfig.cols || 1}
              rows={cardConfig.rows || 1}
              onResizeStart={(cardId, clientX, clientY) => startResize(cardId, clientX, clientY)}
              isDragOver={dragOverId === cardConfig.id}
            >
              {cardContentMap[cardConfig.id]}
            </SortableCard>
          ))}
        </div>
      </SortableContext>
      <DndDragOverlay>
        {activeCard ? (
          <div
            className={`sortable-card col-span-${activeCard.cols || 1} row-span-${activeCard.rows || 1}`}
            style={{
              opacity: 0.9,
              transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)`,
              position: 'fixed',
              pointerEvents: 'none',
              zIndex: 9999,
              width: 'calc(50% - 0.5rem)',
              height: 'var(--drag-overlay-height, 120px)',
            }}
          >
            <Card>{cardContentMap[activeCard.id]}</Card>
          </div>
        ) : null}
      </DndDragOverlay>
    </DndContext>
  );
}

DashboardGrid.propTypes = {
  process: PropTypes.node,
  status: PropTypes.node,
  chart: PropTypes.node,
};