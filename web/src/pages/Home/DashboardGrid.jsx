import { useState, useCallback } from 'preact/hooks';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { signal } from '@preact/signals';
import PropTypes from 'prop-types';
import SortableCard from './SortableCard.jsx';
import { getDashboardLayout, setDashboardLayout } from '../../utils/dashboardManager.js';

// Dashboard layout signal
export const dashboardLayout = signal(getDashboardLayout());

export default function DashboardGrid({ children }) {
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 300, tolerance: 5 },
    })
  );

  const handleDragStart = useCallback(event => {
    setActiveId(event.active.id);
  }, []);

  const handleDragEnd = useCallback(event => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const cards = [...dashboardLayout.value.cards];
    const oldIndex = cards.findIndex(c => c.id === active.id);
    const newIndex = cards.findIndex(c => c.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Swap cards
    const [moved] = cards.splice(oldIndex, 1);
    cards.splice(newIndex, 0, moved);

    dashboardLayout.value = { cards };
    setDashboardLayout(dashboardLayout.value);
  }, []);

  const handleResize = useCallback((cardId, deltaCols, deltaRows) => {
    const cards = dashboardLayout.value.cards.map(card => {
      if (card.id !== cardId) return card;
      return {
        ...card,
        cols: Math.max(1, Math.min(2, (card.cols || 1) + deltaCols)),
        rows: Math.max(1, Math.min(3, (card.rows || 1) + deltaRows)),
      };
    });
    dashboardLayout.value = { cards };
    setDashboardLayout(dashboardLayout.value);
  }, []);

  const cardIds = dashboardLayout.value.cards.map(c => c.id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
        <div className='dashboard-grid'>
          {dashboardLayout.value.cards.map(cardConfig => {
            const child = Array.isArray(children)
              ? children.find(c => c?.props?.id === cardConfig.id)
              : children?.props?.id === cardConfig.id ? children : null;
            return (
              <SortableCard
                key={cardConfig.id}
                id={cardConfig.id}
                className={`col-span-${cardConfig.cols || 1} row-span-${cardConfig.rows || 1}`}
                onResize={handleResize}
              >
                {child?.props?.children}
              </SortableCard>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}

DashboardGrid.propTypes = {
  children: PropTypes.node,
};