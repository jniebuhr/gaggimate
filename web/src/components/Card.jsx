export default function Card({ xs, sm, md, lg, xl, title, children, className = '', role }) {
  // Create a mapping of grid classes to ensure Tailwind recognizes them
  const getGridClasses = () => {
    const classes = [];
    
    if (xs) {
      switch (xs) {
        case 1: classes.push('col-span-1'); break;
        case 2: classes.push('col-span-2'); break;
        case 3: classes.push('col-span-3'); break;
        case 4: classes.push('col-span-4'); break;
        case 5: classes.push('col-span-5'); break;
        case 6: classes.push('col-span-6'); break;
        case 7: classes.push('col-span-7'); break;
        case 8: classes.push('col-span-8'); break;
        case 9: classes.push('col-span-9'); break;
        case 10: classes.push('col-span-10'); break;
        case 11: classes.push('col-span-11'); break;
        case 12: classes.push('col-span-12'); break;
        default: break;
      }
    }
    
    if (sm) {
      switch (sm) {
        case 1: classes.push('sm:col-span-1'); break;
        case 2: classes.push('sm:col-span-2'); break;
        case 3: classes.push('sm:col-span-3'); break;
        case 4: classes.push('sm:col-span-4'); break;
        case 5: classes.push('sm:col-span-5'); break;
        case 6: classes.push('sm:col-span-6'); break;
        case 7: classes.push('sm:col-span-7'); break;
        case 8: classes.push('sm:col-span-8'); break;
        case 9: classes.push('sm:col-span-9'); break;
        case 10: classes.push('sm:col-span-10'); break;
        case 11: classes.push('sm:col-span-11'); break;
        case 12: classes.push('sm:col-span-12'); break;
        default: break;
      }
    }
    
    if (md) {
      switch (md) {
        case 1: classes.push('md:col-span-1'); break;
        case 2: classes.push('md:col-span-2'); break;
        case 3: classes.push('md:col-span-3'); break;
        case 4: classes.push('md:col-span-4'); break;
        case 5: classes.push('md:col-span-5'); break;
        case 6: classes.push('md:col-span-6'); break;
        case 7: classes.push('md:col-span-7'); break;
        case 8: classes.push('md:col-span-8'); break;
        case 9: classes.push('md:col-span-9'); break;
        case 10: classes.push('md:col-span-10'); break;
        case 11: classes.push('md:col-span-11'); break;
        case 12: classes.push('md:col-span-12'); break;
        default: break;
      }
    }
    
    if (lg) {
      switch (lg) {
        case 1: classes.push('lg:col-span-1'); break;
        case 2: classes.push('lg:col-span-2'); break;
        case 3: classes.push('lg:col-span-3'); break;
        case 4: classes.push('lg:col-span-4'); break;
        case 5: classes.push('lg:col-span-5'); break;
        case 6: classes.push('lg:col-span-6'); break;
        case 7: classes.push('lg:col-span-7'); break;
        case 8: classes.push('lg:col-span-8'); break;
        case 9: classes.push('lg:col-span-9'); break;
        case 10: classes.push('lg:col-span-10'); break;
        case 11: classes.push('lg:col-span-11'); break;
        case 12: classes.push('lg:col-span-12'); break;
        default: break;
      }
    }
    
    if (xl) {
      switch (xl) {
        case 1: classes.push('xl:col-span-1'); break;
        case 2: classes.push('xl:col-span-2'); break;
        case 3: classes.push('xl:col-span-3'); break;
        case 4: classes.push('xl:col-span-4'); break;
        case 5: classes.push('xl:col-span-5'); break;
        case 6: classes.push('xl:col-span-6'); break;
        case 7: classes.push('xl:col-span-7'); break;
        case 8: classes.push('xl:col-span-8'); break;
        case 9: classes.push('xl:col-span-9'); break;
        case 10: classes.push('xl:col-span-10'); break;
        case 11: classes.push('xl:col-span-11'); break;
        case 12: classes.push('xl:col-span-12'); break;
        default: break;
      }
    }
    
    return classes.join(' ');
  };

  const gridClasses = getGridClasses();

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
