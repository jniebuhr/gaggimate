import { useCallback, useContext, useEffect, useState } from 'preact/hooks';
import { Trans, useLingui } from '@lingui/react/macro';
import { msg } from '@lingui/core/macro';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { Spinner } from '../../components/Spinner.jsx';
import { InfoNote } from './InfoNote.jsx';

const REASONS = {
  sensor: msg`The temperature sensor returned an invalid reading. Check the thermocouple and its wiring.`,
  alreadyHot: msg`The boiler is already hot, so the heater works.`,
  noRise: msg`The temperature did not rise. Check the heater wiring, the SSR and the thermal fuses.`,
  noPressure: msg`No pressure was measured. Check that the water tank is full, prime the pump and check the pressure sensor wiring.`,
  lowPressure: msg`Pressure stayed below 10 bar. Prime the pump and check for leaks and the OPV setting.`,
  noRelease: msg`Pressure did not drop after opening the 3-way valve. Check the valve and its wiring.`,
  highPressure: msg`Pressure peaked above 12.5 bar. That works, but you may want to adjust the OPV to around 10–11 bar.`,
};

const REQUEST_ERRORS = {
  busy: msg`The machine is busy. Stop the running process and try again.`,
  notReady: msg`The controller is not connected yet.`,
  noPressureSensor: msg`No pressure sensor was detected.`,
  ackRequired: msg`Please confirm the safety notice first.`,
};

function useSetupTest(name) {
  const apiService = useContext(ApiServiceContext);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const id = apiService.on('evt:setup:test', event => {
      if (event.test === name) setStatus(event);
    });
    return () => apiService.off('evt:setup:test', id);
  }, [apiService, name]);

  const start = useCallback(
    async (extra = {}) => {
      setError(null);
      setStatus({ state: 'running', phase: 'starting' });
      try {
        const res = await apiService.request({ tp: 'req:setup:test:start', test: name, ...extra });
        if (!res.success) {
          setStatus(null);
          setError(res.error || 'unknown');
        }
      } catch {
        setStatus(null);
        setError('notReady');
      }
    },
    [apiService, name],
  );

  const abort = useCallback(() => {
    apiService.request({ tp: 'req:setup:test:abort' }).catch(() => {});
  }, [apiService]);

  return { status, error, start, abort };
}

function ResultAlert({ status, error }) {
  const { t, i18n } = useLingui();
  if (error) {
    const text = REQUEST_ERRORS[error];
    return (
      <InfoNote tone='error' title={t`Test not started`}>
        {text ? i18n._(text) : error}
      </InfoNote>
    );
  }
  if (!status || status.state === 'running') return null;
  const reason = status.reason && REASONS[status.reason] ? i18n._(REASONS[status.reason]) : null;
  if (status.state === 'aborted') {
    return (
      <InfoNote tone='warning' title={t`Test stopped`}>
        <Trans>The test was stopped before it finished.</Trans>
      </InfoNote>
    );
  }
  const passed = status.state === 'passed';
  return (
    <InfoNote tone={passed ? 'success' : 'error'} title={passed ? t`Test passed` : t`Test failed`}>
      {reason}
    </InfoNote>
  );
}

function HeaterTest() {
  const { t } = useLingui();
  const { status, error, start, abort } = useSetupTest('heater');
  const running = status?.state === 'running';
  const rise = Math.max(0, Number(status?.rise) || 0);
  const targetRise = Number(status?.targetRise) || 2.5;
  const temp = status?.temp ?? machine.value.status.currentTemperature;

  return (
    <div className='bg-base-200 space-y-3 rounded-lg p-4'>
      <div className='flex items-center justify-between gap-2'>
        <span className='text-xl font-medium'>
          <Trans>Heating test</Trans>
        </span>
        <span className='font-mono text-lg'>{Number(temp || 0).toFixed(1)} °C</span>
      </div>
      <p className='text-sm opacity-70'>
        <Trans>
          The heater runs at full power for up to 10 seconds and stops as soon as the boiler
          temperature has risen by a few degrees.
        </Trans>
      </p>
      {running && (
        <div className='space-y-1'>
          <progress
            className='progress progress-primary w-full'
            value={Math.min(rise, targetRise)}
            max={targetRise}
          />
          <div className='text-sm'>
            {t`Temperature rise: ${rise.toFixed(1)} of ${targetRise.toFixed(1)} °C`}
          </div>
        </div>
      )}
      <ResultAlert status={status} error={error} />
      <div className='flex justify-end gap-2'>
        {running ? (
          <button type='button' className='btn btn-outline' onClick={abort}>
            <Trans>Stop</Trans>
          </button>
        ) : (
          <button type='button' className='btn btn-primary' onClick={() => start()}>
            {status ? <Trans>Run again</Trans> : <Trans>Start heating test</Trans>}
          </button>
        )}
      </div>
    </div>
  );
}

function PressureTest() {
  const { t } = useLingui();
  const { status, error, start, abort } = useSetupTest('pressure');
  const [acknowledged, setAcknowledged] = useState(false);
  const running = status?.state === 'running';
  const pressure = status?.pressure ?? machine.value.status.currentPressure;

  return (
    <div className='bg-base-200 space-y-3 rounded-lg p-4'>
      <div className='flex items-center justify-between gap-2'>
        <span className='text-xl font-medium'>
          <Trans>Pressure test</Trans>
        </span>
        <span className='font-mono text-lg'>{Number(pressure || 0).toFixed(1)} bar</span>
      </div>
      <p className='text-sm opacity-70'>
        <Trans>
          The pump runs with the 3-way valve closed until pressure stops rising. Then the pump stops
          and the valve opens, which should release the pressure to about 0 bar.
        </Trans>
      </p>
      <InfoNote tone='warning' title={t`Caution: pressurized hot water`}>
        <div className='space-y-2'>
          <ul className='list-disc pl-5 text-sm'>
            <li>
              <Trans>Fill the water tank and close the steam knob.</Trans>
            </li>
            <li>
              <Trans>
                Remove the portafilter and place a cup under the group head: hot water comes out of
                the group head when the valve opens. Keep your hands clear.
              </Trans>
            </li>
            <li>
              <Trans>Make sure the drip tray is in place.</Trans>
            </li>
          </ul>
          <label className='label cursor-pointer justify-start gap-2'>
            <input
              type='checkbox'
              className='checkbox checkbox-sm'
              checked={acknowledged}
              disabled={running}
              onChange={() => setAcknowledged(!acknowledged)}
            />
            <span className='label-text'>
              <Trans>I have read this and the machine is ready</Trans>
            </span>
          </label>
        </div>
      </InfoNote>
      {running && (
        <div className='flex items-center gap-2 text-sm'>
          <Spinner size={4} />
          {status.phase === 'releasing' ? (
            <Trans>Valve open, releasing pressure…</Trans>
          ) : (
            <Trans>Building pressure…</Trans>
          )}
          {status.maxPressure > 0 && (
            <span className='ml-auto'>{t`Peak: ${Number(status.maxPressure).toFixed(1)} bar`}</span>
          )}
        </div>
      )}
      {status && !running && status.maxPressure !== undefined && status.state !== 'aborted' && (
        <div className='text-sm'>
          {t`Peak pressure: ${Number(status.maxPressure).toFixed(1)} bar, after release: ${Number(status.residualPressure).toFixed(1)} bar`}
        </div>
      )}
      <ResultAlert status={status} error={error} />
      <div className='flex justify-end gap-2'>
        {running ? (
          <button type='button' className='btn btn-outline' onClick={abort}>
            <Trans>Stop</Trans>
          </button>
        ) : (
          <button
            type='button'
            className='btn btn-primary'
            disabled={!acknowledged}
            onClick={() => start({ ack: true })}
          >
            {status ? <Trans>Run again</Trans> : <Trans>Start pressure test</Trans>}
          </button>
        )}
      </div>
    </div>
  );
}

export function TestStep() {
  const hasPressure = machine.value.capabilities.pressure;
  return (
    <div className='space-y-4'>
      <p>
        <Trans>
          Let's make sure everything is wired up correctly. Make sure the water tank is filled
          before you start.
        </Trans>
      </p>
      {hasPressure && <PressureTest />}
      <HeaterTest />
    </div>
  );
}
