import { Spinner } from '../../components/Spinner.jsx';

export function StickyFormFooter({ submitting, onRestart }) {
  return (
    <div className='sticky bottom-0 z-40 border-t border-base-content/10 bg-base-300/95 backdrop-blur-md pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] mt-6'>
      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-start gap-2 sm:gap-4'>
        <div className='flex items-center gap-2 w-full sm:w-auto'>
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
        <div className='text-[11px] leading-tight text-base-content/60 sm:max-w-xs hidden sm:block'>
          * Restart required for Wi-Fi, Timezone, or Plugin changes.
        </div>
        <div className='text-[11px] text-center leading-tight text-base-content/60 sm:hidden'>
          * Restart required for Wi-Fi, Timezone, or Plugin changes.
        </div>
      </div>
    </div>
  );
}
