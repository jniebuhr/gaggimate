import { Spinner } from '../../components/Spinner.jsx';

export function StickyFormFooter({ submitting, onRestart }) {
  return (
    <div className='sticky bottom-0 z-40 border-t border-base-content/10 bg-base-300/95 backdrop-blur-md py-4 mt-6'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-start sm:gap-6'>
        <div className='flex items-center gap-3 sm:shrink-0'>
          <button
            type='submit'
            className='btn btn-primary btn-sm'
            disabled={submitting}
          >
            {submitting && <Spinner size={4} className='mr-2' />}
            Save Settings
          </button>
          <button
            type='submit'
            name='restart'
            className='btn btn-secondary btn-sm'
            disabled={submitting}
            onClick={onRestart}
          >
            Save & Restart
          </button>
        </div>
        <div className='alert alert-warning py-1.5 px-3 text-xs w-auto max-w-md font-medium flex items-center gap-2 rounded-lg shrink shadow-sm'>
          <span>⚠️ Some options like Wi-Fi, NTP, and managing plugins require a restart.</span>
        </div>
      </div>
    </div>
  );
}
