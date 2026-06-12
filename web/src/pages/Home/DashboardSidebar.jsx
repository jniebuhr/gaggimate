import { useState } from 'preact/hooks';
import { useDashboardState } from './useDashboardState.js';
import { ModeCard } from './cards/ModeCard.jsx';
import { ProfileCard } from './cards/ProfileCard.jsx';
import { FavoriteProfilesCard } from './cards/FavoriteProfilesCard.jsx';
import { MetricsGrid } from './cards/MetricsGrid.jsx';
import { WaterLevelCard } from './cards/WaterLevelCard.jsx';
import { ActionCard } from './cards/ActionCard.jsx';
import PropTypes from 'prop-types';
import { METRIC_DEFINITIONS } from '../../utils/metricDefinitions.js';
import { getMetricOrder } from '../../utils/dashboardManager.js';

function Divider() {
  return <div className='border-t border-base-content/10' />;
}

export function DashboardSidebar({ unified = false }) {
  const ds = useDashboardState();

  const [metricOrder] = useState(() => getMetricOrder());

  // Inject any required metrics that are missing from the stored order (safety net)
  const orderedIds = [
    ...metricOrder,
    ...METRIC_DEFINITIONS
      .filter(m => m.required && !metricOrder.includes(m.id))
      .map(m => m.id),
  ];

  const visibleMetrics = orderedIds
    .map(id => METRIC_DEFINITIONS.find(m => m.id === id))
    .filter(Boolean)
    .filter(m => m.available(ds))
    .map(m => ({
      id: m.id,
      label: m.label,
      current: m.getValue(ds),
      target: m.getTarget ? m.getTarget(ds) : null,
      unit: m.unit,
      adjustable: m.adjustable(ds),
      onDecrease: m.onDecrease ? m.onDecrease(ds) : undefined,
      onIncrease: m.onIncrease ? m.onIncrease(ds) : undefined,
    }));

  const actionProps = {
    mode: ds.mode, isActive: ds.isActive, isFinished: ds.isFinished,
    isBrewing: ds.isBrewing, isGrinding: ds.isGrinding,
    isGrindAvailable: ds.isGrindAvailable, isFlushing: ds.isFlushing,
    activate: ds.activate, deactivate: ds.deactivate,
    clear: ds.clear, startFlush: ds.startFlush,
  };

  if (unified) {
    return (
      <div className='card bg-base-100 flex h-full flex-col gap-0 overflow-hidden rounded-xl'>
        <div className='p-3'>
          <ModeCard mode={ds.mode} showGrindTab={ds.showGrindTab} changeMode={ds.changeMode} />
        </div>
        <Divider />
        <div className='flex-1 min-h-0 max-h-[50%] p-3'>
          <ProfileCard
            selectedProfile={ds.selectedProfile}
            selectedProfileId={ds.selectedProfileId}
            processInfo={ds.processInfo}
            isActive={ds.isActive}
            isFinished={ds.isFinished}
            isBrewing={ds.isBrewing}
            isGrinding={ds.isGrinding}
            inCard
          />
        </div>
        <div className='hidden [@media(min-height:900px)]:block'>
          <Divider />
          <div className='p-3'>
            <FavoriteProfilesCard selectedProfileId={ds.selectedProfileId} inCard />
          </div>
        </div>
        <Divider />
        <div className='p-3'>
          <MetricsGrid metrics={visibleMetrics} inCard />
        </div>
        {ds.waterLevelPercent !== null && (
          <>
            <Divider />
            <div className='p-3'>
              <WaterLevelCard waterLevelPercent={ds.waterLevelPercent} inCard />
            </div>
          </>
        )}
        <div className='mt-auto'>
          <Divider />
          <div className='p-3'>
            <ActionCard {...actionProps} inCard />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='flex h-full flex-col gap-2'>
      <ModeCard mode={ds.mode} showGrindTab={ds.showGrindTab} changeMode={ds.changeMode} />

      <div className='flex-1 min-h-0 max-h-[50%]'>
        <ProfileCard
          selectedProfile={ds.selectedProfile}
          selectedProfileId={ds.selectedProfileId}
          processInfo={ds.processInfo}
          isActive={ds.isActive}
          isFinished={ds.isFinished}
          isBrewing={ds.isBrewing}
          isGrinding={ds.isGrinding}
        />
      </div>

      <div className='hidden [@media(min-height:900px)]:block'>
        <FavoriteProfilesCard selectedProfileId={ds.selectedProfileId} />
      </div>

      <MetricsGrid metrics={visibleMetrics} />

      {ds.waterLevelPercent !== null && (
        <WaterLevelCard waterLevelPercent={ds.waterLevelPercent} />
      )}

      <div className='mt-auto'>
        <ActionCard {...actionProps} />
      </div>
    </div>
  );
}

DashboardSidebar.propTypes = {
  unified: PropTypes.bool,
};
