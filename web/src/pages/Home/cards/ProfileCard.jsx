import { useContext, useEffect, useState } from 'preact/hooks';
import { ApiServiceContext } from '../../../services/ApiService.js';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRectangleList } from '@fortawesome/free-solid-svg-icons/faRectangleList';
import { ProcessProfileChart } from '../../../components/ProcessProfileChart.jsx';
import { fmtElapsed, fmtPhaseTarget, getPhaseLabel } from '../utils.js';

function ProgressCard({ processInfo, isBrewing, isGrinding, selectedProfile }) {
  const p = processInfo;
  const progress = Math.max(0, Math.min(100, ((p?.pp ?? 0) / (p?.pt || 1)) * 100));
  const phase = getPhaseLabel(p, isGrinding);
  const target = fmtPhaseTarget(p, isGrinding);

  return (
    <div className='card bg-primary/10 border-primary/30 flex flex-col gap-1 rounded-xl border p-3'>
      <div className='text-primary text-[0.65rem] font-semibold tracking-wider uppercase'>
        {isBrewing ? 'Now Brewing' : 'Grinding'} · {selectedProfile || 'Default'}
      </div>
      <div className='flex items-baseline justify-between'>
        <div className='flex flex-col gap-0.5'>
          <span className='bg-primary/20 text-primary rounded px-1.5 py-0.5 text-[0.6rem] font-semibold tracking-wider uppercase'>
            {phase}
          </span>
          <span className='text-base-content text-2xl font-bold tabular-nums'>
            {fmtElapsed(p?.e)}
          </span>
        </div>
        {target && (
          <div className='text-right'>
            <div className='text-base-content/50 text-[0.6rem] uppercase tracking-wider'>Target</div>
            <div className='text-base-content text-lg font-bold tabular-nums'>{target}</div>
          </div>
        )}
      </div>
      <div className='bg-base-content/10 h-1.5 w-full overflow-hidden rounded-full'>
        <div
          className='bg-primary h-full rounded-full transition-all duration-300 ease-out'
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

ProgressCard.propTypes = {
  processInfo:     PropTypes.object,
  isBrewing:       PropTypes.bool.isRequired,
  isGrinding:      PropTypes.bool.isRequired,
  selectedProfile: PropTypes.string,
};

export function ProfileCard({
  selectedProfile,
  selectedProfileId,
  processInfo,
  isActive,
  isFinished,
  isBrewing,
  isGrinding,
  inCard = false,
}) {
  const apiService = useContext(ApiServiceContext);
  const [profileData, setProfileData] = useState(null);

  useEffect(() => {
    if (!selectedProfileId || !apiService) { setProfileData(null); return; }
    apiService
      .request({ tp: 'req:profiles:load', id: selectedProfileId })
      .then(res => {
        setProfileData(res.profile?.type === 'pro' ? res.profile : null);
      })
      .catch(() => setProfileData(null));
  }, [selectedProfileId, apiService]); // eslint-disable-line react-hooks/exhaustive-deps

  const showProgress = (isBrewing || isGrinding) && (isActive || isFinished);

  if (showProgress) {
    return (
      <ProgressCard
        processInfo={processInfo}
        isBrewing={isBrewing}
        isGrinding={isGrinding}
        selectedProfile={selectedProfile}
      />
    );
  }

  const inner = (
    <>
      <div className='text-base-content/50 text-[0.6rem] uppercase tracking-wider'>Profile</div>
      <div className='flex items-center justify-between gap-2'>
        <span className='text-base-content truncate text-sm font-semibold'>
          {selectedProfile || 'Default'}
        </span>
        <a href='/profiles'>
          <FontAwesomeIcon icon={faRectangleList} className='text-base-content/40 shrink-0 text-sm' />
        </a>
      </div>
      {profileData && (
        <ProcessProfileChart
          data={profileData}
          processInfo={processInfo}
          className='mt-1 h-full w-full'
        />
      )}
    </>
  );

  if (inCard) {
    return <div className='flex flex-col gap-1 h-full'>{inner}</div>;
  }

  return <div className='card bg-base-100 flex flex-col gap-1 rounded-xl p-3 h-full'>{inner}</div>;
}

ProfileCard.propTypes = {
  selectedProfile:   PropTypes.string,
  selectedProfileId: PropTypes.string,
  processInfo:       PropTypes.object,
  isActive:          PropTypes.bool.isRequired,
  isFinished:        PropTypes.bool.isRequired,
  isBrewing:         PropTypes.bool.isRequired,
  isGrinding:        PropTypes.bool.isRequired,
  inCard:            PropTypes.bool,
};
