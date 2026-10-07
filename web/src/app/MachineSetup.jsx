import { useEffect, useRef, useState } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons/faTrash';
import { faCheck } from '@fortawesome/free-solid-svg-icons/faCheck';
import { faWifi } from '@fortawesome/free-solid-svg-icons/faWifi';
import { faPen } from '@fortawesome/free-solid-svg-icons/faPen';
import { faXmark } from '@fortawesome/free-solid-svg-icons/faXmark';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons/faArrowLeft';
import { FirmwareWarning } from './FirmwareWarning.jsx';
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

// App-only screen for adding a machine or picking a saved one; mandatory while none is active.
export function MachineSetup({ mandatory = false }) {
  const [address, setAddress] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  // Host currently being connected to, from discovery or the address form.
  const [connectingHost, setConnectingHost] = useState(null);
  const connecting = connectingHost !== null;
  const saved = machines.value;
  const found = discoveredMachines.value;

  useEffect(() => {
    startDiscovery();
    return () => {
      stopDiscovery();
    };
  }, []);

  const connect = async (host, preferredName) => {
    setError(null);
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

  const onSubmit = event => {
    event.preventDefault();
    const host = normalizeHost(address);
    if (!host) {
      setError('Enter the hostname or IP address of your machine.');
      return;
    }
    connect(host, name.trim());
  };

  return (
    <div className='bg-base-300 fixed inset-0 z-[10000] overflow-y-auto pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]'>
      <div className='mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 p-6'>
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

        {discoveryAvailable.value && (
          <div className='card bg-base-100 p-2 shadow-sm'>
            <h2 className='text-base-content/60 flex items-center gap-2 px-3 pt-2 pb-1 text-xs font-medium tracking-wide uppercase'>
              <span className='flex-1'>Found on your network</span>
              <span className='loading loading-dots loading-xs' aria-label='Searching' />
            </h2>
            {found.length === 0 ? (
              <p className='text-base-content/60 px-3 pt-1 pb-3 text-sm'>
                Looking for machines… If yours doesn't show up, enter its address below.
              </p>
            ) : (
              <ul className='flex flex-col'>
                {found.map(machine => {
                  const savedMachine = saved.find(m => m.host === machine.host);
                  return (
                    <li key={machine.name}>
                      <button
                        type='button'
                        className='btn btn-ghost h-auto w-full justify-start gap-3 py-2 text-left font-normal'
                        onClick={() =>
                          savedMachine
                            ? selectMachine(savedMachine.id)
                            : connect(machine.host, machine.name)
                        }
                        disabled={connecting}
                      >
                        <FontAwesomeIcon icon={faWifi} className='text-primary' />
                        <span className='flex flex-1 flex-col'>
                          <span className='font-medium'>{savedMachine?.name ?? machine.name}</span>
                          <span className='text-base-content/60 text-xs'>
                            {machine.host}
                            {machine.version ? ` · ${machine.version}` : ''}
                          </span>
                          <FirmwareWarning version={machine.version} className='mt-1' />
                        </span>
                        {connectingHost === machine.host ? (
                          <span className='loading loading-spinner loading-sm' />
                        ) : (
                          <span className='text-primary text-sm font-medium'>
                            {savedMachine ? 'Saved' : 'Connect'}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        <form className='card bg-base-100 gap-4 p-5 shadow-sm' onSubmit={onSubmit}>
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
          {error && (
            <div role='alert' className='alert alert-error alert-soft text-sm'>
              {error}
            </div>
          )}
          <button type='submit' className='btn btn-primary' disabled={connecting}>
            {connecting && connectingHost === normalizeHost(address) && (
              <span className='loading loading-spinner loading-sm' />
            )}
            {connecting && connectingHost === normalizeHost(address) ? 'Connecting…' : 'Connect'}
          </button>
        </form>

        {saved.length > 0 && <SavedMachines disabled={connecting} />}
      </div>
    </div>
  );
}

// Saved machines with switch, inline rename and remove.
function SavedMachines({ disabled }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState('');
  const nameInput = useRef(null);

  // Select the whole name so typing replaces it.
  useEffect(() => {
    nameInput.current?.focus();
    nameInput.current?.select();
  }, [editingId]);

  const startEditing = machine => {
    setEditingId(machine.id);
    setDraft(machine.name);
  };
  const save = async () => {
    await renameMachine(editingId, draft);
    setEditingId(null);
  };

  return (
    <div className='card bg-base-100 p-2 shadow-sm'>
      <h2 className='text-base-content/60 px-3 pt-2 pb-1 text-xs font-medium tracking-wide uppercase'>
        Saved machines
      </h2>
      <ul className='flex flex-col'>
        {machines.value.map(machine =>
          machine.id === editingId ? (
            <li key={machine.id}>
              <form
                className='flex items-center gap-2 px-2 py-1.5'
                onSubmit={event => {
                  event.preventDefault();
                  save();
                }}
              >
                <input
                  type='text'
                  className='input input-sm flex-1'
                  aria-label={`Name for ${machine.host}`}
                  value={draft}
                  onInput={e => setDraft(e.currentTarget.value)}
                  onKeyDown={e => e.key === 'Escape' && setEditingId(null)}
                  ref={nameInput}
                />
                <button
                  type='submit'
                  className='btn btn-ghost btn-square btn-sm text-primary'
                  aria-label='Save name'
                  title='Save'
                  disabled={!draft.trim()}
                >
                  <FontAwesomeIcon icon={faCheck} />
                </button>
                <button
                  type='button'
                  className='btn btn-ghost btn-square btn-sm text-base-content/50'
                  aria-label='Cancel renaming'
                  title='Cancel'
                  onClick={() => setEditingId(null)}
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </form>
            </li>
          ) : (
            <li key={machine.id} className='flex items-center gap-1'>
              <button
                type='button'
                className='btn btn-ghost h-auto flex-1 justify-start py-2 text-left font-normal'
                onClick={() => selectMachine(machine.id)}
                disabled={disabled}
              >
                <span className='flex flex-1 flex-col'>
                  <span className='font-medium'>{machine.name}</span>
                  <span className='text-base-content/60 text-xs'>{machine.host}</span>
                  <FirmwareWarning version={machine.version} className='mt-1' />
                </span>
                {machine.id === activeMachineId.value && (
                  <FontAwesomeIcon icon={faCheck} className='text-primary' />
                )}
              </button>
              <button
                type='button'
                className='btn btn-ghost btn-square btn-sm text-base-content/50 hover:text-base-content'
                aria-label={`Rename ${machine.name}`}
                title='Rename'
                onClick={() => startEditing(machine)}
                disabled={disabled}
              >
                <FontAwesomeIcon icon={faPen} />
              </button>
              <button
                type='button'
                className='btn btn-ghost btn-square btn-sm text-base-content/50 hover:text-error'
                aria-label={`Remove ${machine.name}`}
                title='Remove'
                onClick={() => removeMachine(machine.id)}
                disabled={disabled}
              >
                <FontAwesomeIcon icon={faTrash} />
              </button>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
