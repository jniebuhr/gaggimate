import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons/faTriangleExclamation';
import { isFirmwareSupported } from './firmwareVersion.js';

// Small inline note for machines whose firmware predates what the app expects; renders nothing otherwise.
export function FirmwareWarning({ version, className = '' }) {
  if (isFirmwareSupported(version) !== false) return null;
  return (
    <span
      className={`text-base-content/80 flex items-start gap-1.5 text-xs font-normal ${className}`}
    >
      <FontAwesomeIcon icon={faTriangleExclamation} className='text-warning mt-0.5 shrink-0' />
      <span>Firmware {version} – not all features may be available.</span>
    </span>
  );
}
