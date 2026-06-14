import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars } from '@fortawesome/free-solid-svg-icons/faBars';

export default function PageHeader({ title, actions, tabs, className = '', noStack = false }) {
  const flexClasses = noStack
    ? 'flex flex-row items-center justify-between gap-4'
    : 'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between';

  return (
    <div className={`flex flex-col ${tabs ? '-mb-2 lg:-mb-4' : ''} ${className}`}>
      <div className={flexClasses}>
        <div className='flex flex-row items-center gap-3'>
          <button
            className='btn btn-ghost btn-circle text-base-content/70 -ml-3 md:hidden landscape:hidden'
            onClick={() => globalThis.dispatchEvent(new Event('open-mobile-nav'))}
            aria-label='Open menu'
          >
            <FontAwesomeIcon icon={faBars} size='xl' />
          </button>
          <h1 className='text-base-content text-2xl font-bold tracking-tight sm:text-3xl'>
            {title}
          </h1>
        </div>
        {actions && <div className='flex flex-wrap items-center gap-2 sm:shrink-0'>{actions}</div>}
      </div>
      {tabs && <div className='mt-2 lg:mt-4'>{tabs}</div>}
    </div>
  );
}
