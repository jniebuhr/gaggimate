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
      className={`card overflow-hidden rounded-2xl border border-base-300/65 bg-base-100/90 shadow-[0_26px_60px_-42px_rgba(0,0,0,0.88)] backdrop-blur-sm transition-[transform,box-shadow,border-color] duration-200 sm:hover:-translate-y-0.5 sm:hover:border-base-content/12 sm:hover:shadow-[0_32px_70px_-42px_rgba(0,0,0,0.95)] ${gridClasses} ${fullHeight ? 'h-full' : ''} ${className}`}
      role={role}
    >
      {title && (
        <div className='card-header border-b border-base-300/55 px-5 py-4'>
          <h2 className='card-title text-lg font-semibold tracking-tight sm:text-xl'>{title}</h2>
        </div>
      )}
      <div className={`card-body flex flex-col gap-3 p-5 sm:p-6 ${fullHeight ? 'flex-1' : ''}`}>
        {children}
      </div>
    </div>
  );
}
