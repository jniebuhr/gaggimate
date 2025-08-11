export default function Card({
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
      className={`card bg-base-100 shadow-xl ${gridClasses} ${fullHeight ? 'h-full' : ''} ${className}`}
      role={role}
    >
      {title && (
        <div className='card-header px-4 pt-4'>
          <h2 className='card-title text-lg sm:text-xl'>{title}</h2>
        </div>
      )}
      <div className={`card-body flex flex-col gap-2 p-4 ${fullHeight ? 'flex-1' : ''}`}>
        {children}
      </div>
    </div>
  );
}
