import { useEffect, useRef, useState } from 'preact/hooks';
import { Trans, useLingui } from '@lingui/react/macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons/faCheck';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { faPlug } from '@fortawesome/free-solid-svg-icons/faPlug';
import { faArrowRightFromBracket } from '@fortawesome/free-solid-svg-icons/faArrowRightFromBracket';
import { faChevronUp } from '@fortawesome/free-solid-svg-icons/faChevronUp';
import { machine } from '../services/ApiService.js';
import { FirmwareWarning } from './FirmwareWarning.jsx';
import { useMachinePeeks } from './machineConnections.js';
import { formatMachineStatus } from './machineStatus.js';
import {
  activeMachine,
  disconnectMachine,
  machines,
  selectMachine,
  showMachineSetup,
} from './machines.js';

// App-only sidebar entry: shows the connected machine and switches, adds or disconnects machines.
export function MachineSwitcher({ collapsed = false }) {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  // Fixed position next to the button; the collapsed sidebar scrolls and would clip the menu.
  const [menuPosition, setMenuPosition] = useState(null);
  const root = useRef(null);
  const trigger = useRef(null);
  const current = activeMachine.value;
  const peekStates = useMachinePeeks(machines.value, open);

  // Close on a tap outside or Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = event => !root.current?.contains(event.target) && setOpen(false);
    const onKey = event => event.key === 'Escape' && setOpen(false);
    const onResize = () => setOpen(false);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  if (!current) return null;
  const host = current.host;
  const connected = machine.value.connected;
  const liveStatus = connected ? formatMachineStatus(machine.value.status) : null;
  const statusOf = m => {
    if (m.id === current.id) return liveStatus;
    const state = peekStates[m.id]?.value;
    return state?.connected ? formatMachineStatus(state.status) : null;
  };

  const run = action => () => {
    setOpen(false);
    action();
  };

  const statusDot = (
    <span
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${connected ? 'bg-success' : 'bg-warning animate-pulse'}`}
      aria-label={connected ? t`Connected` : t`Connecting`}
    />
  );

  return (
    <div
      ref={root}
      className={`dropdown dropdown-top ${open ? 'dropdown-open' : ''} ${collapsed ? '' : 'w-full'}`}
    >
      <button
        type='button'
        ref={trigger}
        aria-expanded={open}
        onClick={() => {
          if (!open && collapsed) {
            const rect = trigger.current.getBoundingClientRect();
            const edge =
              trigger.current.closest('.sidebar')?.getBoundingClientRect().right ?? rect.right;
            setMenuPosition({ left: edge + 8, bottom: window.innerHeight - rect.bottom });
          }
          setOpen(!open);
        }}
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
            <span className='flex h-5 items-center self-start'>{statusDot}</span>
            <span className='flex min-w-0 flex-1 flex-col text-left'>
              <span className='truncate text-sm font-medium'>{current.name}</span>
              <span className='text-base-content/60 truncate text-xs font-normal'>
                {liveStatus ?? t`Connecting to ${host}…`}
              </span>
              <FirmwareWarning version={current.version} compact className='mt-1' />
            </span>
            <FontAwesomeIcon
              icon={faChevronUp}
              className={`text-base-content/50 h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </>
        )}
      </button>
      <ul
        className={`dropdown-content ${open ? '' : 'hidden'} menu bg-base-100 rounded-box border-base-300 w-64 border p-2 shadow-lg ${collapsed ? 'z-[10000]' : 'z-10 mb-2'}`}
        style={collapsed && menuPosition ? { position: 'fixed', ...menuPosition } : undefined}
      >
        <li className='menu-title'>
          <Trans>Machines</Trans>
        </li>
        {machines.value.map(m => {
          const isCurrent = m.id === current.id;
          const status = statusOf(m);
          return (
            <li key={m.id}>
              <button
                type='button'
                className='flex items-start gap-3'
                onClick={run(() => selectMachine(m.id))}
              >
                <span className='flex h-5 w-3 shrink-0 items-center justify-center'>
                  {isCurrent && <FontAwesomeIcon icon={faCheck} className='text-primary h-3 w-3' />}
                </span>
                <span className='flex min-w-0 flex-1 flex-col'>
                  <span className='truncate'>{m.name}</span>
                  <span className='text-base-content/60 truncate text-xs'>
                    {status ? `${status} · ${m.host}` : m.host}
                  </span>
                  <FirmwareWarning version={m.version} className='mt-1' />
                </span>
              </button>
            </li>
          );
        })}
        <li>
          <button type='button' onClick={run(() => (showMachineSetup.value = true))}>
            <FontAwesomeIcon icon={faPlus} className='h-3 w-3' />
            <Trans>Add or manage machines</Trans>
          </button>
        </li>
        <li>
          <button type='button' className='text-error' onClick={run(disconnectMachine)}>
            <FontAwesomeIcon icon={faArrowRightFromBracket} className='h-3 w-3' />
            <Trans>Disconnect</Trans>
          </button>
        </li>
      </ul>
    </div>
  );
}
