import { useCallback } from 'preact/hooks';
import { computed } from '@preact/signals';
import { machine } from '../../services/ApiService.js';
import { PHASE } from './constants.js';
import IdleSection from './IdleSection.jsx';
import LogPanel from './LogPanel.jsx';
import ModalFooter from './ModalFooter.jsx';
import ModalHeader from './ModalHeader.jsx';
import ResultsPanel from './ResultsPanel.jsx';
import { usePumpFlowCalibration } from './usePumpFlowCalibration.js';

const connected = computed(() => machine.value.connected);

export default function PumpFlowCalibrationModal({ isOpen, onClose, currentCoeffs, onApplied }) {
  const { phase, logs, results, saving, saved, busy, start, apply, reset } = usePumpFlowCalibration(
    { currentCoeffs, onApplied },
  );

  // Lock dismissal during the actual run AND while a save POST is in flight —
  // otherwise the user can close the modal mid-save and lose the success/failure
  // log + the parent-form sync.
  const closeLocked = busy || saving;
  const handleClose = useCallback(() => {
    if (closeLocked) return;
    reset();
    onClose();
  }, [closeLocked, reset, onClose]);

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
      <div className='bg-base-100 text-base-content max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg shadow-xl'>
        <div className='p-6'>
          <ModalHeader busy={closeLocked} onClose={handleClose} />

          {phase === PHASE.IDLE && <IdleSection currentCoeffs={currentCoeffs} />}

          {logs.length > 0 && <LogPanel logs={logs} />}

          {phase === PHASE.DONE && results && (
            <ResultsPanel results={results} currentCoeffs={currentCoeffs} />
          )}

          <ModalFooter
            phase={phase}
            saving={saving}
            saved={saved}
            connected={connected.value}
            onClose={handleClose}
            onStart={start}
            onApply={apply}
          />
        </div>
      </div>
    </div>
  );
}
