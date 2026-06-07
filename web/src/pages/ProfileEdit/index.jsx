import { useLocation, useRoute } from 'preact-iso';
import { useCallback, useEffect, useState, useContext, useRef } from 'preact/hooks';
import PageLayout from '../../components/PageLayout.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import { ProfileTypeSelection } from './ProfileTypeSelection.jsx';
import { StandardProfileForm } from './StandardProfileForm.jsx';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { computed } from '@preact/signals';
import { Spinner } from '../../components/Spinner.jsx';
import { ExtendedProfileForm } from './ExtendedProfileForm.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExport } from '@fortawesome/free-solid-svg-icons/faFileExport';
import { faEllipsisVertical } from '@fortawesome/free-solid-svg-icons/faEllipsisVertical';
import { faSliders } from '@fortawesome/free-solid-svg-icons/faSliders';
import { downloadJson } from '../../utils/download.js';

const connected = computed(() => machine.value.connected);
const pressureAvailable = computed(() => machine.value.capabilities.pressure);

export function ProfileEdit() {
  const apiService = useContext(ApiServiceContext);
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { params } = useRoute();
  const [data, setData] = useState(null);

  const dropdownRef = useRef(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    if (!dropdownOpen) return;

    const handleOutsideClick = event => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [dropdownOpen]);
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

  const onExport = useCallback(() => {
    if (!data) return;
    const download = {
      ...data,
    };
    delete download.id;
    delete download.selected;
    delete download.favorite;

    downloadJson(download, `profile-${params.id}.json`);
  }, [data, params.id]);

  if (loading) {
    return (
      <div className='flex w-full flex-row items-center justify-center py-16'>
        <Spinner size={8} />
      </div>
    );
  }

  const canConvert = data?.type === 'standard' && pressureAvailable.value;
  const canExport = params.id !== 'new' && data;
  const hasActions = canConvert || canExport;

  const actions = hasActions && (
    <div
      className={`action-dropdown relative ${dropdownOpen ? 'action-dropdown-open' : ''}`}
      ref={dropdownRef}
    >
      <button
        type='button'
        onClick={() => setDropdownOpen(open => !open)}
        className='btn btn-ghost btn-circle text-base-content/85 hover:bg-base-content/10'
        aria-label='More options'
        aria-expanded={dropdownOpen}
      >
        <FontAwesomeIcon icon={faEllipsisVertical} size='lg' />
      </button>
      <ul className='menu action-dropdown-menu bg-base-100 rounded-box border border-base-content/10 right-0 z-50 mt-1 w-52 p-2 shadow-lg'>
        {canConvert && (
          <li>
            <button
              type='button'
              onClick={() => {
                onConvert();
                setDropdownOpen(false);
              }}
              className='text-primary hover:bg-primary/10 justify-start gap-2 font-medium'
              aria-label='Convert to Pro'
            >
              <FontAwesomeIcon icon={faSliders} />
              <span>Convert to Pro</span>
            </button>
          </li>
        )}
        {canExport && (
          <li>
            <button
              type='button'
              onClick={() => {
                onExport();
                setDropdownOpen(false);
              }}
              className='text-success hover:bg-success/10 justify-start gap-2 font-medium'
              aria-label='Export profile'
            >
              <FontAwesomeIcon icon={faFileExport} />
              <span>Export Profile</span>
            </button>
          </li>
        )}
      </ul>
    </div>
  );

  return (
    <PageLayout variant="narrow">
      <PageHeader
        title={params.id === 'new' ? 'Create Profile' : `Edit ${data.label}`}
        noStack={true}
        actions={actions}
      />

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
    </PageLayout>
  );
}
