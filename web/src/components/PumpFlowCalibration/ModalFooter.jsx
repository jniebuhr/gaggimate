import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons/faSpinner';
import { PrimaryButton, SecondaryButton } from './Buttons.jsx';
import { PHASE } from './constants.js';

export default function ModalFooter({
  phase,
  saving,
  saved,
  connected,
  onClose,
  onStart,
  onApply,
}) {
  return (
    <div className='mt-5 flex justify-end gap-3'>
      {phase === PHASE.IDLE && (
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton
            onClick={onStart}
            disabled={!connected}
            title={connected ? undefined : 'Not connected to the machine'}
          >
            Start calibration
          </PrimaryButton>
        </>
      )}
      {(phase === PHASE.RUNNING || phase === PHASE.ANALYZING) && (
        <PrimaryButton disabled>
          <FontAwesomeIcon icon={faSpinner} spin />
          {phase === PHASE.RUNNING ? 'Running shot...' : 'Analyzing...'}
        </PrimaryButton>
      )}
      {phase === PHASE.DONE && !saved && (
        <>
          <SecondaryButton onClick={onClose}>Discard</SecondaryButton>
          <PrimaryButton onClick={onApply} disabled={saving}>
            {saving && <FontAwesomeIcon icon={faSpinner} spin />}
            {saving ? 'Saving...' : 'Save to machine'}
          </PrimaryButton>
        </>
      )}
      {phase === PHASE.DONE && saved && <PrimaryButton onClick={onClose}>Done</PrimaryButton>}
      {phase === PHASE.ERROR && (
        <>
          <SecondaryButton onClick={onClose}>Close</SecondaryButton>
          <PrimaryButton onClick={onStart}>Retry</PrimaryButton>
        </>
      )}
    </div>
  );
}
