import { computed } from '@preact/signals';
import { machine } from '../../services/ApiService.js';
import { PHASE } from './constants.js';
import IdleSection from './IdleSection.jsx';
import LogPanel from './LogPanel.jsx';
import Footer from './Footer.jsx';
import ResultsPanel from './ResultsPanel.jsx';
import { usePumpFlowCalibration } from './usePumpFlowCalibration.js';

const connected = computed(() => machine.value.connected);

export default function PumpFlowCalibration({ currentCoeffs, onApplied }) {
  const { phase, logs, results, saving, saved, start, apply, reset } = usePumpFlowCalibration({
    currentCoeffs,
    onApplied,
  });

  return (
    <div className='p-4'>
      {phase === PHASE.IDLE && <IdleSection currentCoeffs={currentCoeffs} />}

      {logs.length > 0 && <LogPanel logs={logs} />}

      {phase === PHASE.DONE && results && (
        <ResultsPanel results={results} currentCoeffs={currentCoeffs} />
      )}

      <Footer
        phase={phase}
        saving={saving}
        saved={saved}
        connected={connected.value}
        onStart={start}
        onApply={apply}
        onClose={() => reset()}
      />
    </div>
  );
}
