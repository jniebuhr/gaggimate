import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export const ModeTab = ({
  mode,
  active,
  onClick,
  rotation = 0,
  compact = false,
  disabled = false,
}) => (
  <>
    <button
      type='button'
      title={mode.label}
      aria-label={mode.label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 min-w-0 flex-1 items-center justify-center rounded-full transition-colors duration-150 ${
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      } ${
        active
          ? 'bg-primary text-primary-content shadow-sm'
          : 'text-base-content/50 hover:text-base-content'
      }`}
    >
      {compact ? (
        <FontAwesomeIcon icon={mode.icon} className='h-3.5 w-3.5' rotation={rotation} />
      ) : (
        <>
          <span className='hidden @sm:contents'>{mode.label}</span>
          <span className='@sm:hidden'>
            <FontAwesomeIcon icon={mode.icon} className='h-3.5 w-3.5' rotation={rotation} />
          </span>
        </>
      )}
    </button>
  </>
);
