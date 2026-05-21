import { useRoute } from 'preact-iso';
import { useCallback, useContext, useEffect, useState } from 'preact/hooks';
import { computed } from '@preact/signals';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExport } from '@fortawesome/free-solid-svg-icons/faFileExport';
import Card from '../../components/Card.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { downloadJson } from '../../utils/download.js';

const connected = computed(() => machine.value.connected);

function ProfileSummary({ data }) {
  const phases = Array.isArray(data?.phases) ? data.phases : [];
  const totalDuration = phases.reduce(
    (sum, phase) => sum + (Number.isFinite(phase?.duration) ? phase.duration : 0),
    0,
  );

  return (
    <Card sm={10} title='Profile Summary'>
      <div className='grid grid-cols-1 gap-4 text-sm md:grid-cols-2'>
        <div>
          <div className='text-base-content/60'>Name</div>
          <div className='font-medium'>{data?.label || 'Unnamed profile'}</div>
        </div>
        <div>
          <div className='text-base-content/60'>Type</div>
          <div className='font-medium'>{data?.type || 'Unknown'}</div>
        </div>
        <div>
          <div className='text-base-content/60'>Temperature</div>
          <div className='font-medium'>{data?.temperature ?? 'Not set'}°C</div>
        </div>
        <div>
          <div className='text-base-content/60'>Total phase duration</div>
          <div className='font-medium'>{totalDuration}s</div>
        </div>
      </div>
      {data?.description && (
        <div className='mt-4 text-sm'>
          <div className='text-base-content/60'>Description</div>
          <p>{data.description}</p>
        </div>
      )}
    </Card>
  );
}

function PhaseList({ phases }) {
  if (!Array.isArray(phases) || phases.length === 0) {
    return (
      <Card sm={10} title='Phases'>
        <p className='text-sm opacity-70'>No phase data available.</p>
      </Card>
    );
  }

  return (
    <Card sm={10} title='Phases'>
      <div className='space-y-3'>
        {phases.map((phase, index) => (
          <div key={`${phase?.name || 'phase'}-${index}`} className='bg-base-100 rounded-box border-base-300 border p-4'>
            <div className='mb-2 flex flex-row items-center justify-between gap-2'>
              <div className='font-semibold'>{phase?.name || `Phase ${index + 1}`}</div>
              <div className='badge badge-outline'>{phase?.phase || 'unknown'}</div>
            </div>
            <div className='grid grid-cols-2 gap-3 text-sm md:grid-cols-4'>
              <div>
                <div className='text-base-content/60'>Duration</div>
                <div>{phase?.duration ?? '—'}s</div>
              </div>
              <div>
                <div className='text-base-content/60'>Pump</div>
                <div>{phase?.pump ?? '—'}</div>
              </div>
              <div>
                <div className='text-base-content/60'>Valve</div>
                <div>{phase?.valve ?? '—'}</div>
              </div>
              <div>
                <div className='text-base-content/60'>Targets</div>
                <div>{Array.isArray(phase?.targets) ? phase.targets.length : 0}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ProfileEdit() {
  const apiService = useContext(ApiServiceContext);
  const { params } = useRoute();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      if (params.id === 'new') {
        setData(null);
        setError('Profile creation is disabled in GaggiGo MVP. Create or edit profiles in GaggiMate.');
        setLoading(false);
        return;
      }

      if (!connected.value) return;

      try {
        const response = await apiService.request({ tp: 'req:profiles:load', id: params.id });
        setData(response.profile);
        setError(null);
      } catch {
        setError('Profile could not be loaded.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [params.id, connected.value, apiService]);

  const onExport = useCallback(() => {
    if (!data) return;
    const exportedProfile = { ...data };
    delete exportedProfile.id;
    delete exportedProfile.selected;
    delete exportedProfile.favorite;
    downloadJson(exportedProfile, `profile-${data.id || data.label || 'export'}.json`);
  }, [data]);

  if (loading) {
    return (
      <div className='flex w-full flex-row items-center justify-center py-16'>
        <Spinner size={8} />
      </div>
    );
  }

  if (error) {
    return (
      <>
        <div className='mb-4 flex flex-row items-center gap-2'>
          <h2 className='flex-grow text-2xl font-bold sm:text-3xl'>Profile</h2>
        </div>
        <Card sm={10} title='Read-only profile access'>
          <div className='alert alert-warning shadow-sm'>
            <span>{error}</span>
          </div>
          <div className='pt-4'>
            <a href='/profiles' className='btn btn-outline'>
              Back to profiles
            </a>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <div className='mb-4 flex flex-row items-center gap-2'>
        <h2 className='flex-grow text-2xl font-bold sm:text-3xl'>
          {data?.label || 'Profile Details'}
        </h2>
        <button
          type='button'
          onClick={onExport}
          className='btn btn-ghost btn-sm'
          title='Export Profile'
          aria-label='Export profile'
        >
          <FontAwesomeIcon icon={faFileExport} />
        </button>
      </div>

      <div className='mb-4 alert alert-info shadow-sm'>
        <span>
          Profiles are view-only in GaggiGo MVP. Editing and saving remain in GaggiMate.
        </span>
      </div>

      <div className='grid grid-cols-1 gap-4 lg:grid-cols-10'>
        <ProfileSummary data={data} />
        <PhaseList phases={data?.phases} />
        <Card sm={10} title='Boundary'>
          <div className='alert alert-warning shadow-sm'>
            <span>
              GaggiGo can inspect and export profile data, but it does not write profile changes to the machine.
            </span>
          </div>
          <div className='pt-4'>
            <a href='/profiles' className='btn btn-outline'>
              Back to profiles
            </a>
          </div>
        </Card>
      </div>
    </>
  );
}
