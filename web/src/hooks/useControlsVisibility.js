import { useMemo } from 'preact/hooks';

/**
 * Custom hook to determine visibility of various control elements
 * based on mode, state, and availability flags
 * 
 * @param {number} mode - Current machine mode (0-4)
 * @param {boolean} active - Whether process is active
 * @param {boolean} finished - Whether process is finished
 * @param {boolean} isGrindAvailable - Whether grind functionality is available
 * @param {boolean} showGrindTab - Whether grind tab should be shown
 * @param {boolean} volumetricAvailable - Whether volumetric measurement is available
 * @returns {Object} Visibility flags for each control element
 */
export function useControlsVisibility(mode, active, finished, isGrindAvailable, showGrindTab, volumetricAvailable) {
  return useMemo(
    () => ({
      showGrindTargetBar: mode === 4 && showGrindTab && !active && !finished && isGrindAvailable && volumetricAvailable,
      showTemperatureControls: mode === 2 || mode === 3,
      showGrindTargetControls: mode === 4 && showGrindTab && !active && !finished && isGrindAvailable,
      showActionButtons: mode === 1 || mode === 3 || (mode === 4 && showGrindTab && isGrindAvailable),
    }),
    [mode, active, finished, isGrindAvailable, showGrindTab, volumetricAvailable]
  );
}

// Made with Bob