import PropTypes from 'prop-types';
import ResizeHandle from '../pages/Home/ResizeHandle.jsx';

export default function Card({
  xs,
  sm,
  md,
  lg,
  xl,
  cols,
  rows,
  title,
  children,
  className = '',
  role,
  fullHeight = false,
  onResize,
  resizing = false,
}) {
  const getGridClasses = () => {
    const breakpoints = [
      { value: xs, prefix: '' },
      { value: sm, prefix: 'sm:' },
      { value: md, prefix: 'md:' },
      { value: lg, prefix: 'lg:' },
      { value: xl, prefix: 'xl:' },
    ];

    return breakpoints
      .filter(bp => bp.value && bp.value >= 1 && bp.value <= 12)
      .map(bp => `${bp.prefix}col-span-${bp.value}`)
      .join(' ');
  };

  const gridClasses = getGridClasses();

  return (
    <div
      className={`nd-card overflow-hidden relative ${gridClasses} ${fullHeight ? 'h-full' : ''} ${resizing ? 'resizing' : ''} ${className}`}
      role={role}
      data-cols={cols}
      data-rows={rows}
    >
      {title && (
        <div className='nd-card-header border-b border-[var(--home-border,#222)] px-5 py-4'>
          <h2 className='font-nd-mono text-[11px] font-400 uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'>
            {title}
          </h2>
        </div>
      )}
      <div className={`nd-card-body flex flex-col gap-3 p-5 sm:p-6 ${fullHeight ? 'flex-1' : ''}`}>
        {children}
      </div>
      {onResize && <ResizeHandle onResizeStart={onResize} />}
    </div>
  );
}

Card.propTypes = {
  xs: PropTypes.number,
  sm: PropTypes.number,
  md: PropTypes.number,
  lg: PropTypes.number,
  xl: PropTypes.number,
  cols: PropTypes.number,
  rows: PropTypes.number,
  title: PropTypes.string,
  children: PropTypes.node,
  className: PropTypes.string,
  role: PropTypes.string,
  fullHeight: PropTypes.bool,
  onResize: PropTypes.func,
  resizing: PropTypes.bool,
};