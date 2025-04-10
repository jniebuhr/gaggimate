import './style.css';
import mockData from '../../mocks/profiles.json';
import { useLocation, useRoute } from 'preact-iso';
import { useEffect, useState } from 'preact/hooks';
import { ProfileTypeSelection } from './ProfileTypeSelection.jsx';
import { StandardProfileForm } from './StandardProfileForm.jsx';

const PhaseLabels = {
  preinfusion: 'Pre-Infusion',
  brew: 'Brew',
}


export function ProfileEdit() {
  const { params } = useRoute();
  const [data, setData] = useState(null);
  useEffect(() => {
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
            "pump": 1,
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
            "pump": 1,
            "duration": 27,
            "targets": [
              {
                "type": "volumetric",
                "value": 36
              }
            ]
          }
        ],
      });
    }
  }, [params.id, setData]);
  return (
    <div key="profile-edit" className="grid grid-cols-1 gap-2 sm:grid-cols-12 md:gap-2">
      <div className="sm:col-span-12">
        <h2 className="text-2xl font-bold">Create Profile</h2>
      </div>

      {
        !data?.type && <ProfileTypeSelection onSelect={(type) => setData({...data, type})} />
      }
      {
        data?.type === 'standard' && <StandardProfileForm data={data} onChange={(data) => setData(data)} />
      }
    </div>
  );
}
