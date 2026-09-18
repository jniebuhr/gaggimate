import { useCallback, useContext, useEffect, useState } from 'preact/hooks';
import { computed } from '@preact/signals';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons/faTrash';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import Card from '../../components/Card.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import { ConfirmButton } from '../../components/ConfirmButton.jsx';
import { ApiServiceContext, machine } from '../../services/ApiService.js';

export const MAX_BEANS = 4;

const connected = computed(() => machine.value.connected);

function ProfileSelect({ id, value, profiles, onChange }) {
  const known = profiles.some(p => p.id === value);
  return (
    <select id={id} className='select select-bordered w-full' value={value} onChange={e => onChange(e.target.value)}>
      {!value && <option value=''>Select a profile…</option>}
      {value && !known && <option value={value}>{value} (not found on machine)</option>}
      {profiles.map(p => (
        <option key={p.id} value={p.id}>
          {p.label}
        </option>
      ))}
    </select>
  );
}

function BeanCard({ bean, profiles, onSave, onDelete, busy }) {
  const [name, setName] = useState(bean.name || '');
  const [profileId, setProfileId] = useState(bean.profileId || '');
  useEffect(() => {
    setName(bean.name || '');
    setProfileId(bean.profileId || '');
  }, [bean.id, bean.name, bean.profileId]);
  const dirty = name !== (bean.name || '') || profileId !== (bean.profileId || '');
  const profile = profiles.find(p => p.id === bean.profileId);

  return (
    <Card sm={12} md={6} title={bean.name || 'Bean'}>
      <div className='form-control'>
        <label htmlFor={`bean-name-${bean.id}`} className='mb-1 block text-sm font-medium'>
          Name
        </label>
        <input
          id={`bean-name-${bean.id}`}
          type='text'
          className='input input-bordered w-full'
          value={name}
          maxLength={24}
          onInput={e => setName(e.target.value)}
        />
      </div>
      <div className='form-control'>
        <label htmlFor={`bean-profile-${bean.id}`} className='mb-1 block text-sm font-medium'>
          Profile
        </label>
        <ProfileSelect id={`bean-profile-${bean.id}`} value={profileId} profiles={profiles} onChange={setProfileId} />
      </div>
      <div className='text-base-content/70 text-sm'>
        Last grind size:{' '}
        <span className='font-semibold'>{bean.lastGrind > 0 ? bean.lastGrind.toFixed(1) : '—'}</span>
        {profile && <span className='ml-2 badge badge-ghost badge-sm'>{profile.label}</span>}
      </div>
      <div className='mt-2 flex items-center justify-between'>
        <ConfirmButton
          icon={faTrash}
          tooltip='Delete bean'
          confirmTooltip='Really delete?'
          onAction={() => onDelete(bean.id)}
        />
        <button
          type='button'
          className='btn btn-primary btn-sm'
          disabled={busy || !dirty || !name.trim() || !profileId}
          onClick={() => onSave({ id: bean.id, name: name.trim(), profileId })}
        >
          Save
        </button>
      </div>
    </Card>
  );
}

function AddBeanCard({ profiles, onAdd, busy }) {
  const [name, setName] = useState('');
  const [profileId, setProfileId] = useState('');
  return (
    <Card sm={12} md={6} title='Add bean'>
      <div className='form-control'>
        <label htmlFor='new-bean-name' className='mb-1 block text-sm font-medium'>
          Name
        </label>
        <input
          id='new-bean-name'
          type='text'
          className='input input-bordered w-full'
          placeholder='e.g. Ethiopia Guji'
          value={name}
          maxLength={24}
          onInput={e => setName(e.target.value)}
        />
      </div>
      <div className='form-control'>
        <label htmlFor='new-bean-profile' className='mb-1 block text-sm font-medium'>
          Profile
        </label>
        <ProfileSelect id='new-bean-profile' value={profileId} profiles={profiles} onChange={setProfileId} />
      </div>
      <div className='mt-2 flex justify-end'>
        <button
          type='button'
          className='btn btn-primary btn-sm'
          disabled={busy || !name.trim() || !profileId}
          onClick={async () => {
            await onAdd({ name: name.trim(), profileId });
            setName('');
            setProfileId('');
          }}
        >
          <FontAwesomeIcon icon={faPlus} /> Add
        </button>
      </div>
    </Card>
  );
}

export function Beans() {
  const apiService = useContext(ApiServiceContext);
  const [beans, setBeans] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [profRes, beanRes] = await Promise.all([
      apiService.request({ tp: 'req:profiles:list' }),
      apiService.request({ tp: 'req:beans:list' }),
    ]);
    setProfiles((profRes.profiles || []).filter(p => !p.utility).map(p => ({ id: p.id, label: p.label })));
    setBeans(beanRes.beans || []);
    setLoading(false);
  }, [apiService]);

  useEffect(() => {
    if (connected.value) {
      load().catch(e => setError(String(e)));
    }
  }, [connected.value]);

  const run = useCallback(
    async req => {
      setBusy(true);
      setError('');
      try {
        const res = await apiService.request(req);
        if (res.error) setError(res.error);
        await load();
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(false);
      }
    },
    [apiService, load],
  );

  const onSave = bean => run({ tp: 'req:beans:save', bean });
  const onAdd = bean => run({ tp: 'req:beans:save', bean });
  const onDelete = id => run({ tp: 'req:beans:delete', id });

  if (loading) {
    return (
      <div className='flex w-full flex-row items-center justify-center py-20'>
        <Spinner size={8} />
      </div>
    );
  }

  return (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-12'>
      <div className='sm:col-span-12'>
        <h2 className='text-2xl font-bold sm:text-3xl'>Beans</h2>
        <p className='text-base-content/70 mt-1 text-sm'>
          Up to {MAX_BEANS} beans, each bound to one brew profile. They appear on the machine's Beans screen; tapping
          one there asks for the grind size and starts the shot with that profile.
        </p>
        {error && <div className='alert alert-error mt-3 text-sm'>{error}</div>}
      </div>
      {beans.map(b => (
        <BeanCard key={b.id} bean={b} profiles={profiles} onSave={onSave} onDelete={onDelete} busy={busy} />
      ))}
      {beans.length < MAX_BEANS ? (
        <AddBeanCard profiles={profiles} onAdd={onAdd} busy={busy} />
      ) : (
        <div className='text-base-content/60 text-sm sm:col-span-12'>
          Maximum of {MAX_BEANS} beans reached — delete one to add another.
        </div>
      )}
    </div>
  );
}
