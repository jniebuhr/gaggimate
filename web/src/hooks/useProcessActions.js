import { useMemo } from 'preact/hooks';

/**
 * Custom hook to create memoized action handlers for process control
 * 
 * @param {Object} api - ApiService instance
 * @param {boolean} grind - Whether in grind mode
 * @param {Function} setIsFlushing - State setter for flush status
 * @returns {Object} Action handler functions
 */
export function useProcessActions(api, grind, setIsFlushing) {
  return useMemo(
    () => ({
      changeTarget: (target) => {
        const tp = grind ? 'req:change-grind-target' : 'req:change-brew-target';
        api.send({ tp, target });
      },
      activate: () => {
        api.send({ tp: grind ? 'req:grind:activate' : 'req:process:activate' });
      },
      deactivate: () => {
        api.send({ tp: grind ? 'req:grind:deactivate' : 'req:process:deactivate' });
      },
      clear: () => {
        api.send({ tp: 'req:process:clear' });
      },
      raiseTemp: () => {
        api.send({ tp: 'req:raise-temp' });
      },
      lowerTemp: () => {
        api.send({ tp: 'req:lower-temp' });
      },
      raiseTarget: () => {
        api.send({ tp: grind ? 'req:raise-grind-target' : 'req:raise-brew-target' });
      },
      lowerTarget: () => {
        api.send({ tp: grind ? 'req:lower-grind-target' : 'req:lower-brew-target' });
      },
      startFlush: () => {
        setIsFlushing(true);
        api.request({ tp: 'req:flush:start' }).catch(error => {
          console.error('Flush request failed:', error);
          setIsFlushing(false);
        });
      },
    }),
    [api, grind, setIsFlushing]
  );
}

// Made with Bob