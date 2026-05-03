import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import PropTypes from 'prop-types';
import Card from '../../components/Card.jsx';

export default function SortableCard({
  id,
  title,
  children,
  className,
  cols,
  rows,
  onResizeStart,
  isDragOver,
  isResizing,
  fullHeight = false,
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
    gridColumn: `span ${cols || 1}`,
    minHeight: `${Math.max(1, rows || 1) * 120}px`,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sortable-card ${isDragging ? 'is-dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
      {...attributes}
      {...listeners}
    >
      <Card
        title={title}
        cols={cols}
        rows={rows}
        className={className}
        fullHeight={fullHeight}
        resizing={isResizing}
        onResize={event => onResizeStart && onResizeStart(id, event)}
      >
        {children}
      </Card>
    </div>
  );
}

SortableCard.propTypes = {
  id: PropTypes.string.isRequired,
  title: PropTypes.string,
  children: PropTypes.node,
  className: PropTypes.string,
  cols: PropTypes.number,
  rows: PropTypes.number,
  onResizeStart: PropTypes.func,
  isDragOver: PropTypes.bool,
  isResizing: PropTypes.bool,
  fullHeight: PropTypes.bool,
};
