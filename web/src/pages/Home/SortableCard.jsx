import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import PropTypes from 'prop-types';
import Card from '../../components/Card.jsx';

export default function SortableCard({
  id,
  children,
  className,
  cols,
  rows,
  onResizeStart,
  isDragOver,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 'auto',
  };

  // Build className including col-span-2 when card spans full width
  const cardClassName = `${cols >= 2 ? 'col-span-2' : ''} ${className || ''}`.trim();

  // Forward resize start with card ID and coordinates - not the event
  const handleResizePointerDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (onResizeStart) {
      onResizeStart(id, e.clientX, e.clientY);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sortable-card ${isDragging ? 'is-dragging' : ''} ${isDragOver ? 'drag-over' : ''} ${cardClassName}`}
      {...attributes}
      {...listeners}
    >
      <Card
        cols={cols}
        rows={rows}
        onResize={handleResizePointerDown}
      >
        {children}
      </Card>
    </div>
  );
}

SortableCard.propTypes = {
  id: PropTypes.string.isRequired,
  children: PropTypes.node,
  className: PropTypes.string,
  cols: PropTypes.number,
  rows: PropTypes.number,
  onResizeStart: PropTypes.func,
  isDragOver: PropTypes.bool,
};