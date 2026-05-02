import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import PropTypes from 'prop-types';
import Card from '../../components/Card.jsx';

export default function SortableCard({ id, children, className, onResize }) {
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
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sortable-card ${isDragging ? 'is-dragging' : ''} ${className || ''}`}
      {...attributes}
      {...listeners}
    >
      <Card
        resizing={false}
        onResize={e => {
          // Prevent drag initiation when starting resize
          e.preventDefault();
          onResize && onResize(id, e);
        }}
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
  onResize: PropTypes.func,
};