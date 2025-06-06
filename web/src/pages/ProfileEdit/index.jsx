import './style.css';
import { useLocation, useRoute } from 'preact-iso';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { ProfileTypeSelection } from './ProfileTypeSelection.jsx';
import { StandardProfileForm } from './StandardProfileForm.jsx';
import { useContext } from 'react';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { computed } from '@preact/signals';
import { Spinner } from '../../components/Spinner.jsx';

const PhaseLabels = {
  preinfusion: 'Pre-Infusion',
  brew: 'Brew',
}

const connected = computed(() => machine.value.connected);

export function ProfileEdit() {
  const apiService = useContext(ApiServiceContext);
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { params } = useRoute();
  const [data, setData] = useState(null);
  useEffect(async () => {
    if (params.id === 'new') {
      setData({
        label: 'New Profile',
        description: '',
        temperature: 93,
        phases: [
          {
            "name": "Pump",
            "phase": "preinfusion",
            "valve": 1,
            "pump": 100,
            "duration": 3
          },
          {
            "name": "Bloom",
            "phase": "preinfusion",
            "valve": 1,
            "pump": 0,
            "duration": 5
          },
          {
            "name": "Pump",
            "phase": "brew",
            "valve": 1,
            "pump": 100,
            "duration": 20,
            "targets": [
              {
                "type": "volumetric",
                "value": 36
              }
            ]
          }
        ],
      });
      setLoading(false);
    } else if (connected.value) {
      const response = await apiService.request({ tp: 'req:profiles:load', id: params.id });
      setData(response.profile);
      setLoading(false);
    }
  }, [params.id, setData, connected.value]);
  const onSave = useCallback(async (data) => {
    setSaving(true);
    const response = await apiService.request({ tp: 'req:profiles:save', profile: data });
    setData(response.profile);
    setSaving(false);
    if (response.profile.id !== params.id) {
      location.route(`/profiles/${response.profile.id}`);
    }
  }, []);

  if (loading) {
    return (
      <div class="flex flex-row py-16 items-center justify-center w-full">
        <Spinner size={8} />
      </div>
    );
  }

  return (
    <div key="profile-edit" className="grid grid-cols-1 gap-2 sm:grid-cols-12 md:gap-2">
      <div className="sm:col-span-12">
        <h2 className="text-2xl font-bold">Create Profile</h2>
      </div>

      {
        !data?.type && <ProfileTypeSelection onSelect={(type) => setData({...data, type})} />
      }
      {
        data?.type === 'standard' && <StandardProfileForm data={data} onChange={(data) => setData(data)} onSave={onSave} saving={saving} />
      }
    </div>
  );
}
