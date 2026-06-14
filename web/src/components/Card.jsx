export function Section({
  xs,
  sm,
  md,
  lg,
  xl,
  title,
  children,
  className = '',
  role,
  fullHeight = false,
  surface = false,
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

  const bgClass = surface ? 'bg-base-200/40' : 'bg-base-100';

  return (
    <div
      className={`card ${bgClass} border border-base-content/10 min-h-0 min-w-0 ${gridClasses} ${fullHeight ? 'h-full' : ''} ${className}`}
      role={role}
    >
      {title && (
        <div className='card-header px-5 pt-5 shrink-0'>
          <h2 className='card-title text-lg font-semibold text-base-content'>{title}</h2>
        </div>
      )}
      <div className={`card-body flex min-h-0 flex-col gap-2 p-5 ${fullHeight ? 'flex-1' : ''}`}>
        {children}
      </div>
    </div>
  );
}

export const Card = Section;
export default Section;

