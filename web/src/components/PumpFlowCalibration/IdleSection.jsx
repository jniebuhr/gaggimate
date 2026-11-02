import { Trans } from '@lingui/react/macro';

export default function IdleSection({ currentCoeffs }) {
  return (
    <div className='space-y-3'>
      <p className='text-base-content/70 text-sm'>
        <Trans>
          Place a scale with a cup under the steam wand. Close the steam valve just enough so the
          machine can reach the target pressure during each <em>Build</em> phase.
        </Trans>
      </p>
      <div role='alert' className='alert alert-warning text-sm'>
        <span>
          <Trans>
            During the shot, adjust the valve so pressure reaches 1 bar, then 9 bar. Keep it stable
            during the <em>Measure</em> phases (10 s each).
          </Trans>
        </span>
      </div>
      <div className='bg-base-200 rounded-md p-3 text-sm'>
        <strong>
          <Trans>Current coefficients:</Trans>
        </strong>{' '}
        <span className='font-mono'>{currentCoeffs || '—'}</span>
      </div>
    </div>
  );
}
