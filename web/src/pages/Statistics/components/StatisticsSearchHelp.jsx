import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons/faCircleQuestion';

export function StatisticsSearchHelp() {
  return (
    <details className='dropdown dropdown-end'>
      <summary
        className='border-base-content/10 bg-base-100/45 text-base-content/60 hover:bg-base-200/60 hover:text-base-content flex h-9 min-h-0 w-9 list-none items-center justify-center rounded-lg border px-0 shadow-sm transition-colors [&::-webkit-details-marker]:hidden'
        aria-label='Search help'
        title='Search help'
      >
        <FontAwesomeIcon icon={faCircleQuestion} className='text-sm' />
      </summary>
      <div className='dropdown-content bg-base-100/95 border-base-content/10 z-[60] mt-2 w-[min(92vw,34rem)] rounded-xl border p-3 shadow-xl backdrop-blur-md'>
        <div className='space-y-2 text-xs leading-relaxed'>
          <p className='font-semibold'>Statistics Search DSL</p>
          <p className='opacity-80'>
            Rules are separated with <code>;</code>. Visual filters and DSL are combined with AND.
          </p>
          <div className='bg-base-200/60 rounded-lg p-2'>
            <p className='font-semibold'>Fields</p>
            <p>
              <code>name</code>, <code>profile</code>, <code>id</code>, <code>source</code>,{' '}
              <code>date</code>
            </p>
          </div>
          <div className='bg-base-200/60 rounded-lg p-2'>
            <p className='font-semibold'>Examples</p>
            <p>
              <code>name:325; name:326;</code> (same field = OR)
            </p>
            <p>
              <code>name:&quot;325&quot;;</code> (exact)
            </p>
            <p>
              <code>profile:3_0_25; date:&gt;h-7d;</code>
            </p>
            <p>
              <code>date:&gt;=01.02.2026; date:&lt;=07.02.2026 23:59;</code>
            </p>
          </div>
          <div className='bg-base-200/60 rounded-lg p-2'>
            <p className='font-semibold'>Date</p>
            <p>
              Use <code>&gt;</code>, <code>&gt;=</code>, <code>&lt;</code>, <code>&lt;=</code>,{' '}
              <code>=</code>
            </p>
            <p>
              Relative time: <code>h</code> (now), <code>h-7d</code> (7 days ago)
            </p>
            <p className='opacity-70'>Local browser time is used.</p>
            <p className='opacity-70'>
              Date basis (<code>Shot / Auto / Upload</code>) appears only when missing shot
              timestamps are detected.
            </p>
          </div>
          <div className='bg-base-200/60 rounded-lg p-2'>
            <p className='font-semibold'>Raw / Calc</p>
            <p className='opacity-80'>
              Raw builds statistics directly from the values stored in the shot file and only reuses
              the analyzer&apos;s detected stop reasons.
            </p>
            <p className='opacity-80'>
              Calc builds statistics from the analyzer&apos;s calculated values so the results align
              with analyzer-based stop detection.
            </p>
            <p className='font-semibold opacity-90'>
              If you are unsure which mode to use, use Raw.
            </p>
          </div>
        </div>
      </div>
    </details>
  );
}
