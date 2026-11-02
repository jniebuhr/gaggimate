import { useContext } from 'preact/hooks';
import { ApiServiceContext } from '../../../services/ApiService.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTemperatureFull } from '@fortawesome/free-solid-svg-icons/faTemperatureFull';
import { faClock } from '@fortawesome/free-solid-svg-icons/faClock';
import { faScaleBalanced } from '@fortawesome/free-solid-svg-icons/faScaleBalanced';
import PropTypes from 'prop-types';
import { Trans } from '@lingui/react/macro';
import { SkeletonBlock } from '../../../components/SkeletonBlock.jsx';
import { useProfileList } from '../../../services/hooks.js';

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
      className={`flex w-full cursor-pointer flex-col gap-1.5 rounded-lg p-2 text-left transition-colors ${
        isSelected ? 'bg-primary/15 ring-primary/40 ring-1' : 'bg-base-200 hover:bg-base-300'
      }`}
    >
      <div className='w-full truncate text-sm font-semibold'>{profile.label}</div>
      <div className='text-base-content/50 w-full truncate text-xs'>
        {profile.description || ' '}
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

export function FavoriteProfilesCard({ selectedProfileId, inCard = false, compact = false }) {
  const apiService = useContext(ApiServiceContext);
  const { profiles, loading } = useProfileList();
  const favorites = profiles.filter(p => p.favorite).slice(0, 3);

  const handleSelect = id => {
    apiService.request({ tp: 'req:profiles:select', id }).catch(() => {});
  };

  const wrapperClass = inCard
    ? 'flex flex-col gap-2'
    : 'card bg-base-100 flex flex-col gap-2 rounded-xl p-3';

  if (loading) {
    return (
      <div className={wrapperClass}>
        <SkeletonBlock className='h-2 w-20' />
        {compact ? (
          <div className='flex gap-1.5'>
            {[0, 1, 2].map(i => (
              <SkeletonBlock key={i} className='h-7 w-20 rounded-full' />
            ))}
          </div>
        ) : (
          <div className='grid grid-cols-3 gap-2'>
            {[0, 1, 2].map(i => (
              <SkeletonBlock key={i} className='h-24 rounded-lg' />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className={wrapperClass}>
        <div className='text-base-content/50 text-[0.6rem] tracking-wider uppercase'>
          <Trans>Quick Select</Trans>
        </div>
        <div className='text-base-content/50 flex flex-col items-center gap-1 py-3 text-center text-sm'>
          <span className='text-lg'>★</span>
          <span>
            <Trans>No favorites — mark profiles as ★ in the profile list</Trans>
          </span>
        </div>
      </div>
    );
  }

  const content = compact ? (
    <div className='flex gap-1.5 overflow-x-auto pb-0.5'>
      {favorites.map(profile => (
        <button
          key={profile.id}
          type='button'
          onClick={() => handleSelect(profile.id)}
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            profile.id === selectedProfileId
              ? 'bg-primary text-primary-content'
              : 'bg-base-200 text-base-content hover:bg-base-300'
          }`}
        >
          {profile.label}
        </button>
      ))}
    </div>
  ) : (
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
  );

  return (
    <div className={wrapperClass}>
      <div className='text-base-content/50 text-[0.6rem] tracking-wider uppercase'>
        <Trans>Quick Select</Trans>
      </div>
      {content}
    </div>
  );
}

FavoriteProfilesCard.propTypes = {
  selectedProfileId: PropTypes.string,
  inCard: PropTypes.bool,
  compact: PropTypes.bool,
};
