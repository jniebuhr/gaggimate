import PropTypes from 'prop-types';
import { useEffect, useState } from 'preact/hooks';
import { Trans } from '@lingui/react/macro';
import { clampLiveBrewSetpoint } from '../../../utils/liveBrew.js';

export function LiveBrewCard({ active, limits, start, stop, setpoints, setSetpoints }) {
  const [pressure, setPressure] = useState(setpoints.pressure);
  const [flow, setFlow] = useState(setpoints.flow);

  useEffect(() => {
    setPressure(setpoints.pressure);
    setFlow(setpoints.flow);
  }, [setpoints.pressure, setpoints.flow]);

  const update = (nextPressure, nextFlow) => {
    const next = {
      pressure: clampLiveBrewSetpoint(nextPressure, limits.minPressure, limits.maxPressure),
      flow: clampLiveBrewSetpoint(nextFlow, limits.minFlow, limits.maxFlow),
    };
    setPressure(next.pressure);
    setFlow(next.flow);
    setSetpoints(next.pressure, next.flow);
  };

  return (
    <div className='border-warning/40 bg-warning/10 rounded-xl border p-3'>
      <div className='text-warning mb-2 text-xs font-semibold tracking-wide uppercase'>
        <Trans>Live Brew · manual control</Trans>
      </div>
      <p className='mb-3 text-xs'>
        <Trans>Experimental: you control pressure and flow. Stop immediately if the brew behaves unexpectedly.</Trans>
      </p>
      {!active ? (
        <button type='button' className='btn btn-warning btn-sm w-full' onClick={start}>
          <Trans>Start Live Brew</Trans>
        </button>
      ) : (
        <div className='flex flex-col gap-3'>
          <label className='text-xs'>
            <span className='mb-1 block'>Pressure: {pressure.toFixed(1)} bar</span>
            <input
              className='range range-warning range-sm w-full'
              type='range'
              min={limits.minPressure}
              max={limits.maxPressure}
              step='0.1'
              value={pressure}
              onInput={event => update(Number(event.currentTarget.value), flow)}
            />
          </label>
          <label className='text-xs'>
            <span className='mb-1 block'>Flow: {flow.toFixed(1)}</span>
            <input
              className='range range-warning range-sm w-full'
              type='range'
              min={limits.minFlow}
              max={limits.maxFlow}
              step='0.1'
              value={flow}
              onInput={event => update(pressure, Number(event.currentTarget.value))}
            />
          </label>
          <button type='button' className='btn btn-error btn-sm w-full' onClick={stop}>
            <Trans>Stop Live Brew</Trans>
          </button>
        </div>
      )}
    </div>
  );
}

LiveBrewCard.propTypes = {
  active: PropTypes.bool.isRequired,
  limits: PropTypes.shape({
    minPressure: PropTypes.number.isRequired,
    maxPressure: PropTypes.number.isRequired,
    minFlow: PropTypes.number.isRequired,
    maxFlow: PropTypes.number.isRequired,
  }).isRequired,
  start: PropTypes.func.isRequired,
  stop: PropTypes.func.isRequired,
  setpoints: PropTypes.shape({ pressure: PropTypes.number, flow: PropTypes.number }).isRequired,
  setSetpoints: PropTypes.func.isRequired,
};
