import { Spinner } from '../../components/Spinner.jsx';

export function StickyFormFooter({ submitting, onRestart }) {
  return (
    <div className='border-base-content/10 bg-base-300/95 sticky bottom-0 z-40 mt-6 border-t pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md'>
      <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-start sm:gap-4'>
        <div className='flex w-full items-center gap-2 sm:w-auto'>
          <button
            type='submit'
            className='btn btn-primary btn-sm flex-1 sm:flex-none'
            disabled={submitting}
          >
            {submitting && <Spinner size={4} className='mr-2' />}
            Save Settings
          </button>
          <button
            type='submit'
            name='restart'
            className='btn btn-secondary btn-sm flex-1 sm:flex-none'
            disabled={submitting}
            onClick={onRestart}
          >
            Save & Restart
          </button>
        </div>
        <div className='text-base-content/60 hidden text-[11px] leading-tight sm:block sm:max-w-xs'>
          * Restart required for Wi-Fi, Timezone, or Plugin changes.
        </div>
        <div className='text-base-content/60 text-center text-[11px] leading-tight sm:hidden'>
          * Restart required for Wi-Fi, Timezone, or Plugin changes.
        </div>
      </div>
    </div>
  );
}
