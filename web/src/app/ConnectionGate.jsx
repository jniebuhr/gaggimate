import { useEffect, useState } from 'preact/hooks';
import { GmLogoIcon } from '../pages/ShotAnalyzer/components/SourceMarker.jsx';
import { activeMachine, showMachineSetup } from './machines.js';

const SLOW_CONNECT_MS = 8000;

// Shown instead of the dashboard until the active machine's live connection has opened once.
export function ConnectionGate() {
  const current = activeMachine.value;
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_CONNECT_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className='bg-base-300 fixed inset-0 flex items-center justify-center pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]'>
      <div className='flex max-w-sm flex-col items-center gap-4 p-6 text-center'>
        <GmLogoIcon width={72} height={72} />
        {slow ? (
          <>
            <h1 className='text-xl font-semibold'>Can't reach {current.name}</h1>
            <p className='text-base-content/70 text-sm'>
              {current.host} isn't answering. Make sure the machine is on and your phone is on the
              same Wi-Fi network.
            </p>
            <div className='flex w-full flex-col gap-2'>
              <button
                type='button'
                className='btn btn-primary'
                onClick={() => window.location.reload()}
              >
                Try again
              </button>
              <button
                type='button'
                className='btn btn-ghost'
                onClick={() => (showMachineSetup.value = true)}
              >
                Choose another machine
              </button>
            </div>
          </>
        ) : (
          <>
            <span className='loading loading-spinner loading-md text-primary' />
            <p className='text-base-content/70'>Connecting to {current.name}…</p>
            <button
              type='button'
              className='btn btn-ghost btn-sm'
              onClick={() => (showMachineSetup.value = true)}
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
