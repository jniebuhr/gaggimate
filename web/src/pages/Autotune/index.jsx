import { useState, useEffect, useCallback, useContext } from 'preact/hooks';
import { ApiServiceContext } from '../../services/ApiService.js';
import { OverviewChart } from '../../components/OverviewChart.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import Card from '../../components/Card.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons/faTriangleExclamation';
import { faCheck } from '@fortawesome/free-solid-svg-icons/faCheck';
import { faPlay } from '@fortawesome/free-solid-svg-icons/faPlay';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons/faArrowLeft';

export function Autotune() {
  const apiService = useContext(ApiServiceContext);
  const [active, setActive] = useState(false);
  const [result, setResult] = useState(null);
  const [time, setTime] = useState(60);
  const [samples, setSamples] = useState(4);

  const onStart = useCallback(() => {
    apiService.send({
      tp: 'req:autotune-start',
      time,
      samples,
    });
    setActive(true);
  }, [time, samples, apiService]);

  useEffect(() => {
    const listenerId = apiService.on('evt:autotune-result', msg => {
      setActive(false);
      setResult(msg.pid);
    });
    return () => {
      apiService.off('evt:autotune-result', listenerId);
    };
  }, [apiService]);

  return (
    <div className='flex flex-col gap-6'>
      {/* Header */}
      <div className='flex items-center gap-3'>
        <h1 className='font-nd-mono text-[20px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'>
          PID Autotune
        </h1>
      </div>

      {/* Main card */}
      <Card sm={12} title='Settings'>
        {active && (
          <div className='flex flex-col gap-5'>
            <div className='h-[200px] lg:h-[350px]'>
              <OverviewChart />
            </div>
            <div className='flex flex-col items-center gap-4 py-6'>
              <div className='flex items-center gap-3'>
                <Spinner size={8} />
                <span className='font-nd-mono text-[18px] text-[var(--text-primary,#e8e8e8)]'>
                  Autotune in Progress
                </span>
              </div>
              <div className='border-l-2 border-[var(--color-warning,#d4a843)] pl-4'>
                <span className='font-nd-mono text-[14px] text-[var(--text-disabled,#666)]'>
                  Please wait while the system optimizes your PID settings. This may take up to 30 seconds.
                </span>
              </div>
            </div>
          </div>
        )}

        {result && (
          <div className='flex flex-col gap-5 text-center'>
            <div className='flex items-center justify-center gap-3 border-l-2 border-[var(--color-success,#7cb876)] pl-4'>
              <FontAwesomeIcon icon={faCheck} className='text-[var(--color-success,#7cb876)] text-xl' />
              <div className='text-left'>
                <div className='font-nd-mono text-[18px] text-[var(--text-primary,#e8e8e8)]'>
                  Autotune Complete
                </div>
                <div className='font-nd-mono text-[14px] text-[var(--text-disabled,#666)]'>
                  Your new PID values have been saved successfully.
                </div>
              </div>
            </div>
            <div className='rounded-[8px] border border-[var(--home-border,#222)] bg-[var(--home-surface,#111)] p-4'>
              <pre className='font-nd-mono text-[12px] text-[var(--text-primary,#e8e8e8)]'>
                <code>{result}</code>
              </pre>
            </div>
          </div>
        )}

        {!active && !result && (
          <div className='flex flex-col gap-5'>
            <div className='flex items-start gap-3 border-l-2 border-[var(--color-warning,#d4a843)] pl-4'>
              <FontAwesomeIcon icon={faTriangleExclamation} className='mt-0.5 text-[var(--color-warning,#d4a843)] text-xl' />
              <span className='font-nd-mono text-[14px] text-[var(--text-disabled,#666)]'>
                Ensure the boiler temperature is below 50 C before starting the autotune process.
              </span>
            </div>

            <div className='grid grid-cols-1 gap-5 sm:grid-cols-2'>
              <div className='flex flex-col gap-2'>
                <label
                  htmlFor='tuningGoal'
                  className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
                >
                  Tuning Goal
                </label>
                <input
                  id='tuningGoal'
                  type='number'
                  min='0'
                  max='100'
                  className='nd-input nd-input--lg'
                  value={time}
                  onChange={e => setTime(parseInt(e.target.value, 10) || 0)}
                />
                <span className='font-nd-mono text-[13px] text-[var(--text-disabled,#666)]'>
                  0 = Conservative, 100 = Aggressive. Higher values result in faster response but may cause overshoot.
                </span>
              </div>

              <div className='flex flex-col gap-2'>
                <label
                  htmlFor='windowSize'
                  className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
                >
                  Window Size
                </label>
                <input
                  id='windowSize'
                  type='number'
                  min='1'
                  max='10'
                  className='nd-input nd-input--lg'
                  value={samples}
                  onChange={e => setSamples(parseInt(e.target.value, 10) || 1)}
                />
                <span className='font-nd-mono text-[13px] text-[var(--text-disabled,#666)]'>
                  Number of samples. More samples provide better accuracy but take longer.
                </span>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Action buttons */}
      <div className='flex gap-3'>
        {!active && !result && (
          <button
            className='nd-action-btn nd-action-btn--primary'
            onClick={onStart}
            disabled={time < 0 || time > 100 || samples < 1 || samples > 10}
          >
            <FontAwesomeIcon icon={faPlay} />
          </button>
        )}

        {result && (
          <button className='nd-action-btn' onClick={() => setResult(null)}>
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>
        )}
      </div>
    </div>
  );
}
