import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons/faCircleInfo';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons/faTriangleExclamation';
import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons/faCircleExclamation';

const VARIANTS = {
  info: { icon: faCircleInfo, color: 'text-info' },
  warning: { icon: faTriangleExclamation, color: 'text-warning' },
  error: { icon: faCircleExclamation, color: 'text-error' },
};

// Readable inline note: regular text on a neutral surface, the variant only colours the icon.
export function Notice({ variant = 'info', children }) {
  const { icon, color } = VARIANTS[variant];
  return (
    <div
      role={variant === 'info' ? undefined : 'alert'}
      className='bg-base-200 text-base-content rounded-box flex items-start gap-3 p-3 text-sm'
    >
      <FontAwesomeIcon icon={icon} className={`${color} mt-0.5 shrink-0`} />
      <span>{children}</span>
    </div>
  );
}
