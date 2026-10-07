import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons/faCheck';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { faPlug } from '@fortawesome/free-solid-svg-icons/faPlug';
import { faArrowRightFromBracket } from '@fortawesome/free-solid-svg-icons/faArrowRightFromBracket';
import { faChevronUp } from '@fortawesome/free-solid-svg-icons/faChevronUp';
import { machine } from '../services/ApiService.js';
import { FirmwareWarning } from './FirmwareWarning.jsx';
import {
  activeMachine,
  disconnectMachine,
  machines,
  selectMachine,
  showMachineSetup,
} from './machines.js';

// App-only sidebar entry: shows the connected machine and switches, adds or disconnects machines.
export function MachineSwitcher({ collapsed = false }) {
  const current = activeMachine.value;
  if (!current) return null;
  const connected = machine.value.connected;

  // daisyUI dropdowns are focus-driven — blur to close after a selection.
  const run = action => () => {
    document.activeElement?.blur();
    action();
  };

  const statusDot = (
    <span
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${connected ? 'bg-success' : 'bg-warning animate-pulse'}`}
      aria-label={connected ? 'Connected' : 'Connecting'}
    />
  );

  return (
    <div className={`dropdown dropdown-top ${collapsed ? '' : 'w-full'}`}>
      {/* div+tabindex instead of <button>: Safari doesn't focus buttons on click,
          which daisyUI's focus-driven dropdown relies on. */}
      <div
        tabIndex={0}
        role='button'
        title={`${current.name} (${current.host})`}
        className={
          collapsed
            ? 'btn btn-square btn-md text-base-content hover:bg-base-content/10 relative h-12 min-h-0 w-12 min-w-0 rounded-xl border-none bg-transparent px-0'
            : 'btn btn-md bg-base-200 hover:bg-base-content/10 text-base-content h-auto min-h-12 w-full justify-start gap-3 rounded-xl border-none px-3 py-2'
        }
      >
        {collapsed ? (
          <>
            <FontAwesomeIcon icon={faPlug} />
            <span className='absolute top-2.5 right-2.5'>{statusDot}</span>
          </>
        ) : (
          <>
            {statusDot}
            <span className='flex min-w-0 flex-1 flex-col text-left'>
              <span className='truncate text-sm font-medium'>{current.name}</span>
              <span className='text-base-content/60 truncate text-xs font-normal'>
                {connected ? current.host : `Connecting to ${current.host}…`}
              </span>
              <FirmwareWarning version={current.version} className='mt-1 whitespace-normal' />
            </span>
            <FontAwesomeIcon icon={faChevronUp} className='text-base-content/50 h-3 w-3' />
          </>
        )}
      </div>
      <ul
        tabIndex={0}
        className='dropdown-content menu bg-base-100 rounded-box border-base-300 z-10 mb-2 w-64 border p-2 shadow-lg'
      >
        <li className='menu-title'>Machines</li>
        {machines.value.map(m => (
          <li key={m.id}>
            <button type='button' onClick={run(() => selectMachine(m.id))}>
              <span className='flex min-w-0 flex-1 flex-col'>
                <span className='truncate'>{m.name}</span>
                <span className='text-base-content/60 truncate text-xs'>{m.host}</span>
                <FirmwareWarning version={m.version} className='mt-1' />
              </span>
              {m.id === current.id && <FontAwesomeIcon icon={faCheck} className='h-3 w-3' />}
            </button>
          </li>
        ))}
        <li>
          <button type='button' onClick={run(() => (showMachineSetup.value = true))}>
            <FontAwesomeIcon icon={faPlus} className='h-3 w-3' />
            Add or manage machines
          </button>
        </li>
        <li>
          <button type='button' className='text-error' onClick={run(disconnectMachine)}>
            <FontAwesomeIcon icon={faArrowRightFromBracket} className='h-3 w-3' />
            Disconnect
          </button>
        </li>
      </ul>
    </div>
  );
}
