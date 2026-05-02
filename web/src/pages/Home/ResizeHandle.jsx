import PropTypes from 'prop-types';

export default function ResizeHandle({ onResizeStart, className = '' }) {
  const handlePointerDown = (e) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    onResizeStart && onResizeStart(e);
  };

  const handlePointerUp = (e) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div
      className={`resize-handle ${className}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      aria-label="Resize card"
      role="button"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M13 13L13 5M13 13L5 13M13 13L10 10"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

ResizeHandle.propTypes = {
  onResizeStart: PropTypes.func,
  className: PropTypes.string,
};