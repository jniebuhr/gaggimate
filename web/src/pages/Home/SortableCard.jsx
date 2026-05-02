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
  isResizing,
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

  // Separate resize handler to avoid conflict with dnd-kit listeners
  const handleResizePointerDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    onResizeStart && onResizeStart(e);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sortable-card ${isDragging ? 'is-dragging' : ''} ${isDragOver ? 'drag-over' : ''} ${className || ''}`}
      {...attributes}
      {...listeners}
    >
      <Card
        resizing={isResizing}
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
  isResizing: PropTypes.bool,
  isDragOver: PropTypes.bool,
};