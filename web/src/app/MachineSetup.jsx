import { useEffect, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons/faCheck';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { faPen } from '@fortawesome/free-solid-svg-icons/faPen';
import { faXmark } from '@fortawesome/free-solid-svg-icons/faXmark';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons/faArrowLeft';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons/faChevronDown';
import { machine as liveMachine } from '../services/ApiService.js';
import { useMachinePeeks } from './machineConnections.js';
import { FirmwareWarning } from './FirmwareWarning.jsx';
import { Notice } from './Notice.jsx';
import { formatMachineStatus } from './machineStatus.js';
import { GmLogoIcon } from '../pages/ShotAnalyzer/components/SourceMarker.jsx';
import {
  activeMachineId,
  addMachine,
  machines,
  normalizeHost,
  probeMachine,
  removeMachine,
  renameMachine,
  selectMachine,
  showMachineSetup,
} from './machines.js';
import {
  discoveredMachines,
  discoveryAvailable,
  startDiscovery,
  stopDiscovery,
} from './discovery.js';

const SECTION_TITLE =
  'text-base-content/60 flex items-center gap-2 px-1 text-xs font-medium tracking-wide uppercase';
const CORNER_BUTTON =
  'btn btn-ghost btn-circle btn-xs text-base-content/50 absolute top-1.5 right-1.5 z-[1]';

// App-only screen for adding a machine or picking a saved one; mandatory while none is active.
export function MachineSetup({ mandatory = false }) {
  const [error, setError] = useState(null);
  // Host currently being connected to, from discovery or the address form.
  const [connectingHost, setConnectingHost] = useState(null);
  const [removing, setRemoving] = useState(null);
  const connecting = connectingHost !== null;
  const saved = machines.value;
  const found = discoveredMachines.value;
  const foundHosts = new Set(found.map(m => m.host));
  const newlyFound = found.filter(m => !saved.some(s => s.host === m.host));

  const peekStates = useMachinePeeks(saved);

  useEffect(() => {
    startDiscovery();
    return () => {
      stopDiscovery();
    };
  }, []);

  const connect = async (host, preferredName) => {
    setError(null);
    // Already saved: switch instead of probing, which would open a second socket to it.
    const existing = saved.find(m => m.host === host);
    if (existing) {
      await selectMachine(existing.id);
      return;
    }
    setConnectingHost(host);
    try {
      const { settings, version } = await probeMachine(host);
      await addMachine({ host, name: preferredName || settings.mdnsName || host, version });
    } catch (err) {
      console.error('Machine probe failed', host, err?.message);
      setError(
        `Couldn't connect to ${host}: ${err?.message || err}. Make sure the machine is on and your phone is on the same Wi-Fi network.`,
      );
      setConnectingHost(null);
    }
  };

  return (
    <div className='bg-base-300 fixed inset-0 z-[10000] overflow-y-auto pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]'>
      <div className='mx-auto flex max-w-md flex-col gap-6 p-6'>
        {!mandatory && (
          <button
            type='button'
            className='btn btn-ghost self-start'
            onClick={() => (showMachineSetup.value = false)}
            disabled={connecting}
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            Back
          </button>
        )}
        <div className='flex flex-col items-center gap-3 text-center'>
          <GmLogoIcon width={72} height={72} />
          <h1 className='text-2xl font-semibold'>Connect to your GaggiMate</h1>
          <p className='text-base-content/70 text-sm'>
            Your phone needs to be on the same Wi-Fi network as the machine.
          </p>
        </div>

        {error && <Notice variant='error'>{error}</Notice>}

        {saved.length > 0 && (
          <section className='flex flex-col gap-2'>
            <h2 className={SECTION_TITLE}>Your machines</h2>
            <div className='grid grid-cols-2 gap-3'>
              {saved.map(machine => (
                <SavedMachineCard
                  key={machine.id}
                  machine={machine}
                  state={peekStates[machine.id] ?? liveMachine}
                  onNetwork={discoveryAvailable.value ? foundHosts.has(machine.host) : null}
                  disabled={connecting}
                  onRemove={() => setRemoving(machine)}
                />
              ))}
            </div>
          </section>
        )}

        {discoveryAvailable.value && (
          <section className='flex flex-col gap-2'>
            <h2 className={SECTION_TITLE}>
              <span className='flex-1'>Found on your network</span>
              <span className='loading loading-dots loading-xs' aria-label='Searching' />
            </h2>
            {newlyFound.length === 0 ? (
              <p className='text-base-content/60 px-1 text-sm'>
                {found.length === 0
                  ? "Looking for machines… If yours doesn't show up, add it by its address."
                  : 'No other machines found.'}
              </p>
            ) : (
              <div className='grid grid-cols-2 gap-3'>
                {newlyFound.map(machine => (
                  <DiscoveredMachineCard
                    key={machine.name}
                    machine={machine}
                    connecting={connectingHost === machine.host}
                    disabled={connecting}
                    onAdd={() => connect(machine.host, machine.name)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        <AddByAddress
          collapsible={saved.length > 0}
          connectingHost={connectingHost}
          onConnect={connect}
          onInvalid={setError}
        />
      </div>

      {removing && (
        <RemoveMachineModal
          machine={removing}
          onCancel={() => setRemoving(null)}
          onConfirm={async () => {
            setRemoving(null);
            await removeMachine(removing.id);
          }}
        />
      )}
    </div>
  );
}

// Tappable status card for a saved machine; the X asks before removing it.
function SavedMachineCard({ machine, state, onNetwork, disabled, onRemove }) {
  const [editing, setEditing] = useState(false);
  const isActive = machine.id === activeMachineId.value;
  const live = state.value.connected;

  let dot = 'bg-base-content/30';
  let status = 'Not found';
  if (live) {
    dot = 'bg-success';
    status = formatMachineStatus(state.value.status);
  } else if (onNetwork) {
    dot = 'bg-success';
    status = 'On this network';
  } else if (onNetwork === null) {
    status = 'Saved';
  }

  if (editing) {
    return <RenameCard machine={machine} onDone={() => setEditing(false)} />;
  }

  return (
    <div className={`card bg-base-100 relative shadow-sm ${isActive ? 'ring-primary ring-2' : ''}`}>
      <button
        type='button'
        className={CORNER_BUTTON}
        aria-label={`Remove ${machine.name}`}
        title='Remove'
        onClick={onRemove}
        disabled={disabled}
      >
        <FontAwesomeIcon icon={faXmark} />
      </button>
      <button
        type='button'
        className='flex h-full min-h-24 w-full flex-col items-start gap-1 rounded-[inherit] p-3 pr-8 text-left disabled:opacity-50'
        onClick={() => selectMachine(machine.id)}
        disabled={disabled}
      >
        <span className='w-full truncate font-medium'>{machine.name}</span>
        <span className='text-base-content/60 w-full truncate text-xs'>{machine.host}</span>
        <span className='mt-auto flex items-center gap-1.5 pt-2 text-xs'>
          <span className='flex w-3 shrink-0 justify-center'>
            <span className={`h-2 w-2 rounded-full ${dot}`} />
          </span>
          {status}
        </span>
        <FirmwareWarning version={machine.version} compact />
      </button>
      <button
        type='button'
        className='btn btn-ghost btn-circle btn-xs text-base-content/50 absolute right-1.5 bottom-1.5'
        aria-label={`Rename ${machine.name}`}
        title='Rename'
        onClick={() => setEditing(true)}
        disabled={disabled}
      >
        <FontAwesomeIcon icon={faPen} className='h-2.5 w-2.5' />
      </button>
    </div>
  );
}

function RenameCard({ machine, onDone }) {
  const [draft, setDraft] = useState(machine.name);
  const input = useRef(null);

  // Select the whole name so typing replaces it.
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  return (
    <form
      className='card bg-base-100 flex min-h-24 flex-col gap-2 p-3 shadow-sm'
      onSubmit={async event => {
        event.preventDefault();
        await renameMachine(machine.id, draft);
        onDone();
      }}
    >
      <input
        type='text'
        className='input input-sm w-full'
        aria-label={`Name for ${machine.host}`}
        value={draft}
        onInput={e => setDraft(e.currentTarget.value)}
        onKeyDown={e => e.key === 'Escape' && onDone()}
        ref={input}
      />
      <div className='mt-auto flex justify-end gap-1'>
        <button
          type='button'
          className='btn btn-ghost btn-square btn-sm text-base-content/50'
          aria-label='Cancel renaming'
          title='Cancel'
          onClick={onDone}
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
        <button
          type='submit'
          className='btn btn-ghost btn-square btn-sm text-primary'
          aria-label='Save name'
          title='Save'
          disabled={!draft.trim()}
        >
          <FontAwesomeIcon icon={faCheck} />
        </button>
      </div>
    </form>
  );
}

// Unsaved machine seen via mDNS; tapping anywhere (or the +) connects and saves it.
function DiscoveredMachineCard({ machine, connecting, disabled, onAdd }) {
  return (
    <button
      type='button'
      className='card bg-base-100 relative flex min-h-24 flex-col items-start gap-1 p-3 pr-8 text-left shadow-sm disabled:opacity-50'
      onClick={onAdd}
      disabled={disabled}
      aria-label={`Add ${machine.name}`}
    >
      <span className='text-primary absolute top-2.5 right-2.5'>
        {connecting ? (
          <span className='loading loading-spinner loading-xs' />
        ) : (
          <FontAwesomeIcon icon={faPlus} />
        )}
      </span>
      <span className='w-full truncate font-medium'>{machine.name}</span>
      <span className='text-base-content/60 w-full truncate text-xs'>{machine.host}</span>
      {machine.version && (
        <span className='text-base-content/60 mt-auto pt-2 text-xs'>{machine.version}</span>
      )}
      <FirmwareWarning version={machine.version} compact />
    </button>
  );
}

// Manual entry; always open without saved machines, otherwise a section that slides open.
function AddByAddress({ collapsible, connectingHost, onConnect, onInvalid }) {
  const [open, setOpen] = useState(!collapsible);
  const [address, setAddress] = useState('');
  const [name, setName] = useState('');
  const connecting = connectingHost !== null;
  const connectingHere = connecting && connectingHost === normalizeHost(address);
  const expanded = open || !collapsible;

  const onSubmit = event => {
    event.preventDefault();
    const host = normalizeHost(address);
    if (!host) {
      onInvalid('Enter the hostname or IP address of your machine.');
      return;
    }
    onConnect(host, name.trim());
  };

  return (
    <section className='card bg-base-100 shadow-sm'>
      {collapsible && (
        <button
          type='button'
          className='flex w-full items-center gap-3 p-4 text-left text-sm font-medium'
          onClick={() => setOpen(!open)}
          aria-expanded={expanded}
        >
          <FontAwesomeIcon icon={faPlus} className='text-primary' />
          <span className='flex-1'>Add machine by address</span>
          <FontAwesomeIcon
            icon={faChevronDown}
            className={`text-base-content/50 h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      )}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className='overflow-hidden'>
          <form
            className={`flex flex-col gap-4 p-5 ${collapsible ? 'pt-0' : ''}`}
            onSubmit={onSubmit}
            inert={!expanded}
          >
            <label className='flex flex-col gap-1.5'>
              <span className='text-sm font-medium'>Address</span>
              <input
                type='text'
                className='input w-full'
                placeholder='gaggimate.local or 192.168.1.20'
                autoCapitalize='none'
                autoCorrect='off'
                spellcheck={false}
                inputMode='url'
                value={address}
                onInput={e => setAddress(e.currentTarget.value)}
                disabled={connecting}
                required
              />
            </label>
            <label className='flex flex-col gap-1.5'>
              <span className='text-sm font-medium'>
                Name <span className='text-base-content/50 font-normal'>(optional)</span>
              </span>
              <input
                type='text'
                className='input w-full'
                placeholder='Kitchen'
                value={name}
                onInput={e => setName(e.currentTarget.value)}
                disabled={connecting}
              />
            </label>
            <button type='submit' className='btn btn-primary' disabled={connecting}>
              {connectingHere && <span className='loading loading-spinner loading-sm' />}
              {connectingHere ? 'Connecting…' : 'Connect'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

// Portaled to <body> so it sits above the full-screen setup overlay.
function RemoveMachineModal({ machine, onCancel, onConfirm }) {
  return createPortal(
    <div
      className='modal modal-open z-[10001]'
      role='dialog'
      aria-modal='true'
      aria-labelledby='remove-machine-title'
    >
      <div className='modal-box'>
        <h3 id='remove-machine-title' className='text-lg font-bold'>
          Remove {machine.name}?
        </h3>
        <p className='text-base-content/70 py-2 text-sm'>
          The app forgets {machine.host}. Nothing changes on the machine, and you can add it again
          any time.
        </p>
        <div className='modal-action'>
          <button type='button' className='btn' onClick={onCancel}>
            Cancel
          </button>
          <button type='button' className='btn btn-error' onClick={onConfirm}>
            Remove
          </button>
        </div>
      </div>
      <button type='button' className='modal-backdrop' aria-label='Close' onClick={onCancel} />
    </div>,
    document.body,
  );
}
