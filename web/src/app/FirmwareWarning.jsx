import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons/faTriangleExclamation';
import { useLingui } from '@lingui/react/macro';
import { isFirmwareSupported } from './firmwareVersion.js';

// Small inline note for machines whose firmware predates what the app expects; renders nothing otherwise.
export function FirmwareWarning({ version, compact = false, className = '' }) {
  const { t } = useLingui();
  if (isFirmwareSupported(version) !== false) return null;
  const message = t`Firmware ${version} – not all features may be available.`;
  return (
    <span
      className={`text-base-content/80 flex items-start gap-1.5 text-xs font-normal ${compact ? 'whitespace-nowrap' : ''} ${className}`}
      title={compact ? message : undefined}
    >
      <span className='flex h-4 w-3 shrink-0 items-center justify-center'>
        <FontAwesomeIcon icon={faTriangleExclamation} className='text-warning max-w-full' />
      </span>
      <span>{compact ? t`Old firmware` : message}</span>
    </span>
  );
}
