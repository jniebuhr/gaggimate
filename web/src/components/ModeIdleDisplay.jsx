import PropTypes from 'prop-types';

const MODE_CONFIG = {
  0: { title: 'Standby', subtitle: 'Machine is ready' },
  1: { title: 'Brew', subtitle: 'Select brew target to start' },
  2: {
    title: 'Steam',
    subtitle: (tempReady) => (tempReady ? 'Steam is ready' : 'Preheating'),
  },
  3: { title: 'Water', subtitle: 'Start and open steam valve to pull water' },
  4: {
    title: 'Grind',
    subtitle: (isAvailable) => (isAvailable ? 'Select grind target to start' : 'Grind function not available'),
  },
};

/**
 * Displays the idle state message for different machine modes
 */
export const ModeIdleDisplay = ({ mode, showGrindTab, tempReady, isGrindAvailable }) => {
  const config = MODE_CONFIG[mode];
  
  // Don't render if mode is invalid or grind mode without grind tab
  if (!config || (mode === 4 && !showGrindTab)) return null;

  // Compute subtitle - can be static string or function
  const subtitle =
    typeof config.subtitle === 'function'
      ? config.subtitle(mode === 2 ? tempReady : isGrindAvailable)
      : config.subtitle;

  return (
    <div className='space-y-2 text-center'>
      <div className='text-lg font-semibold sm:text-xl'>{config.title}</div>
      <div className='text-base-content/60 text-sm'>{subtitle}</div>
    </div>
  );
};

ModeIdleDisplay.propTypes = {
  mode: PropTypes.oneOf([0, 1, 2, 3, 4]).isRequired,
  showGrindTab: PropTypes.bool.isRequired,
  tempReady: PropTypes.bool.isRequired,
  isGrindAvailable: PropTypes.bool.isRequired,
};

// Made with Bob
