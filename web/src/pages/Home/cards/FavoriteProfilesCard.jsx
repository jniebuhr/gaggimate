import { useContext, useEffect, useState } from 'preact/hooks';
import { computed } from '@preact/signals';
import { ApiServiceContext, machine } from '../../../services/ApiService.js';

const connected = computed(() => machine.value.connected);
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTemperatureFull } from '@fortawesome/free-solid-svg-icons/faTemperatureFull';
import { faClock } from '@fortawesome/free-solid-svg-icons/faClock';
import { faScaleBalanced } from '@fortawesome/free-solid-svg-icons/faScaleBalanced';
import PropTypes from 'prop-types';

function ProfileMiniCard({ profile, isSelected, onSelect }) {
  const phases = Array.isArray(profile?.phases) ? profile.phases : [];
  const totalSeconds = phases.reduce(
    (sum, p) => sum + (Number.isFinite(p?.duration) ? p.duration : 0),
    0,
  );
  const lastPhase = phases[phases.length - 1];
  const weight = lastPhase?.targets?.find(t => t.type === 'volumetric')?.value ?? null;

  return (
    <button
      type='button'
      onClick={() => onSelect(profile.id)}
      className={`flex w-full flex-col gap-1.5 rounded-lg p-2 text-left transition-colors ${
        isSelected ? 'bg-primary/15 ring-1 ring-primary/40' : 'bg-base-200 hover:bg-base-300'
      }`}
    >
      <div className='w-full truncate text-sm font-semibold'>{profile.label}</div>
      <div className='text-base-content/50 w-full truncate text-xs'>
        {profile.description || ' '}
      </div>
      <div className='mt-auto flex flex-wrap gap-1 pt-0.5'>
        <span className='badge badge-ghost badge-xs gap-1'>
          <FontAwesomeIcon icon={faTemperatureFull} />
          {profile.temperature}°C
        </span>
        {weight !== null && (
          <span className='badge badge-ghost badge-xs gap-1'>
            <FontAwesomeIcon icon={faScaleBalanced} />
            {weight}g
          </span>
        )}
        <span className='badge badge-ghost badge-xs gap-1'>
          <FontAwesomeIcon icon={faClock} />
          {totalSeconds}s
        </span>
      </div>
    </button>
  );
}

ProfileMiniCard.propTypes = {
  profile: PropTypes.object.isRequired,
  isSelected: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
};

export function FavoriteProfilesCard({ selectedProfileId, inCard = false }) {
  const apiService = useContext(ApiServiceContext);
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    if (!apiService || !connected.value) return;
    apiService
      .request({ tp: 'req:profiles:list' })
      .then(res => setFavorites((res.profiles ?? []).filter(p => p.favorite).slice(0, 3)))
      .catch(() => {});
  }, [apiService, connected.value]);

  const handleSelect = id => {
    apiService.request({ tp: 'req:profiles:select', id }).catch(() => {});
  };

  if (favorites.length === 0) return null;

  return (
    <div className={inCard ? 'flex flex-col gap-2' : 'card bg-base-100 flex flex-col gap-2 rounded-xl p-3'}>
      <div className='text-base-content/50 text-[0.6rem] uppercase tracking-wider'>Quick Select</div>
      <div className='grid grid-cols-3 gap-2'>
        {favorites.map(profile => (
          <ProfileMiniCard
            key={profile.id}
            profile={profile}
            isSelected={profile.id === selectedProfileId}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </div>
  );
}

FavoriteProfilesCard.propTypes = {
  selectedProfileId: PropTypes.string,
  inCard:            PropTypes.bool,
};
