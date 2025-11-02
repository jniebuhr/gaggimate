import { ExtendedProfileChart } from './ExtendedProfileChart.jsx';

/**
 * ProcessProfileChart extends ExtendedProfileChart to support highlighting the currently active phase
 * during brewing. It automatically determines which phase is currently active based on the process info.
 */
export function ProcessProfileChart({ 
  data, 
  processInfo = null, 
  className = 'max-h-36 w-full',
}) {
  // Determine which phase is currently active based on the process info
  const getActivePhaseIndex = () => {
    if (!processInfo || !processInfo.a || !processInfo.l || !data?.phases) {
      return null;
    }

    // Find the phase that matches the current phase label
    const currentPhaseLabel = processInfo.l;
    
    // Handle the case where processInfo.l might be "Finished"
    if (currentPhaseLabel === 'Finished') {
      return null;
    }
    
    const activePhaseIndex = data.phases.findIndex(phase => phase.name === currentPhaseLabel);
    
    return activePhaseIndex >= 0 ? activePhaseIndex : null;
  };

  const activePhaseIndex = getActivePhaseIndex();

  return (
    <ExtendedProfileChart
      data={data}
      className={className}
      selectedPhase={activePhaseIndex}
    />
  );
}
