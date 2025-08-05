export default function Card({ xs, sm, md, lg, xl, title, children, className = '', role }) {
  const gridClasses = [
    xs && `col-span-${xs}`,
    sm && `sm:col-span-${sm}`,
    md && `md:col-span-${md}`,
    lg && `lg:col-span-${lg}`,
    xl && `xl:col-span-${xl}`,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`card bg-base-100 shadow-xl ${gridClasses} ${className}`} role={role}>
      {title && (
        <div className='card-header px-4 pt-4'>
          <h2 className='card-title text-lg sm:text-xl'>{title}</h2>
        </div>
      )}
      <div className='card-body flex flex-col gap-2 p-4'>{children}</div>
    </div>
  );
}
