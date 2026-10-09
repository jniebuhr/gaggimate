import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons/faTriangleExclamation';
import { isFirmwareSupported } from './firmwareVersion.js';

// Small inline note for machines whose firmware predates what the app expects; renders nothing otherwise.
export function FirmwareWarning({ version, compact = false, className = '' }) {
  if (isFirmwareSupported(version) !== false) return null;
  return (
    <span
      className={`text-base-content/80 flex items-start gap-1.5 text-xs font-normal ${compact ? 'whitespace-nowrap' : ''} ${className}`}
      title={compact ? `Firmware ${version} – not all features may be available.` : undefined}
    >
      <span className='flex h-4 w-3 shrink-0 items-center justify-center'>
        <FontAwesomeIcon icon={faTriangleExclamation} className='text-warning max-w-full' />
      </span>
      <span>
        {compact ? 'Old firmware' : `Firmware ${version} – not all features may be available.`}
      </span>
    </span>
  );
}
