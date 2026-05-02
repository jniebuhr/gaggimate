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
import Card from '../../components/Card.jsx';
import { getDashboardLayout, setDashboardLayout } from '../../utils/dashboardManager.js';

// Dashboard layout signal
export const dashboardLayout = signal(getDashboardLayout());

export default function DashboardGrid({ process, status, chart }) {
  const [activeId, setActiveId] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const resizeStartRef = useRef(null);
  const gridRef = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 10 },
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
    // Track offset for DragOverlay positioning
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

    // Reorder: move item to new position
    const [moved] = cards.splice(oldIndex, 1);
    cards.splice(newIndex, 0, moved);

    dashboardLayout.value = { cards };
    setDashboardLayout(dashboardLayout.value);
  }, []);

  const handleResizeStart = useCallback((cardId, e) => {
    e.stopPropagation();
    e.preventDefault();
    setResizing(cardId);
    resizeStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      cardId,
      startCols: dashboardLayout.value.cards.find(c => c.id === cardId)?.cols || 1,
      startRows: dashboardLayout.value.cards.find(c => c.id === cardId)?.rows || 1,
    };

    const handleMove = (moveEvent) => {
      if (!resizeStartRef.current) return;
      const deltaX = moveEvent.clientX - resizeStartRef.current.clientX;
      const deltaY = moveEvent.clientY - resizeStartRef.current.clientY;
      const threshold = 40; // pixels per grid unit

      const deltaCols = Math.round(deltaX / threshold);
      const deltaRows = Math.round(deltaY / threshold);

      const cards = dashboardLayout.value.cards.map(card => {
        if (card.id !== resizeStartRef.current.cardId) return card;
        return {
          ...card,
          cols: Math.max(1, Math.min(2, resizeStartRef.current.startCols + deltaCols)),
          rows: Math.max(1, Math.min(3, resizeStartRef.current.startRows + deltaRows)),
        };
      });
      dashboardLayout.value = { cards };
    };

    const handleUp = () => {
      setResizing(null);
      resizeStartRef.current = null;
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
  }, []);

  const cardContentMap = {
    process,
    status,
    chart,
  };

  const cardIds = dashboardLayout.value.cards.map(c => c.id);

  const activeCard = activeId
    ? dashboardLayout.value.cards.find(c => c.id === activeId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={cardIds} strategy={rectSortingStrategy}>
        <div className='dashboard-grid' ref={gridRef}>
          {dashboardLayout.value.cards.map(cardConfig => {
            return (
              <SortableCard
                key={cardConfig.id}
                id={cardConfig.id}
                cols={cardConfig.cols || 1}
                rows={cardConfig.rows || 1}
                onResizeStart={(e) => handleResizeStart(cardConfig.id, e)}
                isResizing={resizing === cardConfig.id}
                isDragOver={dragOverId === cardConfig.id}
              >
                {cardContentMap[cardConfig.id]}
              </SortableCard>
            );
          })}
        </div>
      </SortableContext>
      <DndDragOverlay>
        {activeCard ? (
          <div
            className={`sortable-card col-span-${activeCard.cols || 1} row-span-${activeCard.rows || 1} is-dragging`}
            style={{
              opacity: 0.9,
              transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)`,
              position: 'fixed',
              pointerEvents: 'none',
              zIndex: 9999,
              width: 'calc(50% - 0.5rem)',
            }}
          >
            <Card>
              {cardContentMap[activeCard.id]}
            </Card>
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