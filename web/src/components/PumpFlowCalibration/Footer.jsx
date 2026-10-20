import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons/faSpinner';
import { PrimaryButton, SecondaryButton } from './Buttons.jsx';
import { PHASE } from './constants.js';
import { Trans, useLingui } from '@lingui/react/macro';

export default function Footer({ phase, saving, saved, connected, onClose, onStart, onApply }) {
  const { t } = useLingui();
  return (
    <div className='mt-5 flex justify-end gap-3'>
      {phase === PHASE.IDLE && (
        <>
          <SecondaryButton onClick={onClose}>
            <Trans>Cancel</Trans>
          </SecondaryButton>
          <PrimaryButton
            onClick={onStart}
            disabled={!connected}
            title={connected ? undefined : t`Not connected to the machine`}
          >
            <Trans>Start calibration</Trans>
          </PrimaryButton>
        </>
      )}
      {(phase === PHASE.RUNNING || phase === PHASE.ANALYZING) && (
        <PrimaryButton disabled>
          <FontAwesomeIcon icon={faSpinner} spin />
          {phase === PHASE.RUNNING ? t`Running shot...` : t`Analyzing...`}
        </PrimaryButton>
      )}
      {phase === PHASE.DONE && !saved && (
        <>
          <SecondaryButton onClick={onClose}>
            <Trans>Discard</Trans>
          </SecondaryButton>
          <PrimaryButton onClick={onApply} disabled={saving}>
            {saving && <FontAwesomeIcon icon={faSpinner} spin />}
            {saving ? t`Saving...` : t`Save to machine`}
          </PrimaryButton>
        </>
      )}
      {phase === PHASE.DONE && saved && (
        <PrimaryButton onClick={onClose}>
          <Trans>Done</Trans>
        </PrimaryButton>
      )}
      {phase === PHASE.ERROR && (
        <>
          <SecondaryButton onClick={onClose}>
            <Trans>Back</Trans>
          </SecondaryButton>
          <PrimaryButton onClick={onStart}>
            <Trans>Retry</Trans>
          </PrimaryButton>
        </>
      )}
    </div>
  );
}
