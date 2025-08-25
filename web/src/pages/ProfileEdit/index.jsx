import { useLocation, useRoute } from 'preact-iso';
import { useCallback, useEffect, useState, useContext } from 'preact/hooks';
import { ProfileTypeSelection } from './ProfileTypeSelection.jsx';
import { StandardProfileForm } from './StandardProfileForm.jsx';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { computed } from '@preact/signals';
import { Spinner } from '../../components/Spinner.jsx';
import { ExtendedProfileForm } from './ExtendedProfileForm.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExport } from '@fortawesome/free-solid-svg-icons/faFileExport';

const connected = computed(() => machine.value.connected);
const pressureAvailable = computed(() => machine.value.capabilities.pressure);

export function ProfileEdit() {
  const apiService = useContext(ApiServiceContext);
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { params } = useRoute();
  const [data, setData] = useState(null);
  useEffect(() => {
    async function fetchData() {
      if (params.id === 'new') {
        setData({
          label: 'New Profile',
          description: '',
          temperature: 93,
          phases: [
            {
              name: 'Pump',
              phase: 'preinfusion',
              valve: 1,
              pump: 100,
              duration: 3,
              transition: {
                type: 'instant',
                duration: 0,
                adaptive: true,
              },
              targets: [],
            },
            {
              name: 'Bloom',
              phase: 'preinfusion',
              valve: 1,
              pump: 0,
              duration: 5,
              transition: {
                type: 'instant',
                duration: 0,
                adaptive: true,
              },
              targets: [],
            },
            {
              name: 'Pump',
              phase: 'brew',
              valve: 1,
              pump: 100,
              duration: 20,
              targets: [
                {
                  type: 'volumetric',
                  value: 36,
                },
              ],
              transition: {
                type: 'instant',
                duration: 0,
                adaptive: true,
              },
            },
          ],
        });
        setLoading(false);
      } else if (connected.value) {
        const response = await apiService.request({ tp: 'req:profiles:load', id: params.id });
        setData(response.profile);
        setLoading(false);
      }
    }
    fetchData();
  }, [params.id, setData, connected.value, apiService]);
  const onSave = useCallback(
    async data => {
      setSaving(true);
      const response = await apiService.request({ tp: 'req:profiles:save', profile: data });
      setData(response.profile);
      setSaving(false);
      location.route('/profiles');
    },
    [apiService, params.id, location],
  );
  const onConvert = useCallback(() => {
    setData({
      ...data,
      type: 'pro',
    });
  }, [data, setData]);

  if (loading) {
    return (
      <div className='flex w-full flex-row items-center justify-center py-16'>
        <Spinner size={8} />
      </div>
    );
  }

  return (
    <>
      <div className='mb-4 flex flex-row items-center gap-2'>
        <h2 className='flex-grow text-2xl font-bold sm:text-3xl'>
          {params.id === 'new' ? 'Create Profile' : `Edit ${data.label}`}
        </h2>
        {data?.type === 'standard' && pressureAvailable.value && (
          <button
            onClick={() => onConvert()}
            className='btn'
            title='Convert to Pro'
            aria-label='Convert to Pro'
          >
            Convert to Pro
          </button>
        )}
      </div>

      {!data?.type && <ProfileTypeSelection onSelect={type => setData({ ...data, type })} />}
      {data?.type === 'standard' && (
        <StandardProfileForm
          data={data}
          onChange={data => setData(data)}
          onSave={onSave}
          saving={saving}
          pressureAvailable={pressureAvailable.value}
        />
      )}
      {data?.type === 'pro' && (
        <ExtendedProfileForm
          data={data}
          onChange={data => setData(data)}
          onSave={onSave}
          saving={saving}
          pressureAvailable={pressureAvailable.value}
        />
      )}
    </>
  );
}
