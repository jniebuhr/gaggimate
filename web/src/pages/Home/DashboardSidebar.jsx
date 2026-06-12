import { useDashboardState } from './useDashboardState.js';
import { ModeCard } from './cards/ModeCard.jsx';
import { ProfileCard } from './cards/ProfileCard.jsx';
import { MetricsGrid } from './cards/MetricsGrid.jsx';
import { WaterLevelCard } from './cards/WaterLevelCard.jsx';
import { ActionCard } from './cards/ActionCard.jsx';

export function DashboardSidebar() {
  const ds = useDashboardState();

  return (
    <div className='flex h-full flex-col gap-2'>
      <ModeCard
        mode={ds.mode}
        showGrindTab={ds.showGrindTab}
        changeMode={ds.changeMode}
      />

      <ProfileCard
        selectedProfile={ds.selectedProfile}
        selectedProfileId={ds.selectedProfileId}
        processInfo={ds.processInfo}
        isActive={ds.isActive}
        isFinished={ds.isFinished}
        isBrewing={ds.isBrewing}
        isGrinding={ds.isGrinding}
      />

      <MetricsGrid
        currentPressure={ds.currentPressure}
        targetPressure={ds.targetPressure}
        currentFlow={ds.currentFlow}
        targetFlow={ds.targetFlow}
        currentTemperature={ds.currentTemperature}
        targetTemperature={ds.targetTemperature}
        currentWeight={ds.currentWeight}
        targetWeight={ds.targetWeight}
        volumetricAvailable={ds.volumetricAvailable}
        brewTarget={ds.brewTarget}
        raiseTemp={ds.raiseTemp}
        lowerTemp={ds.lowerTemp}
        raiseTarget={ds.raiseTarget}
        lowerTarget={ds.lowerTarget}
      />

      {ds.waterLevelPercent !== null && (
        <WaterLevelCard waterLevelPercent={ds.waterLevelPercent} />
      )}

      <div className='mt-auto'>
        <ActionCard
          mode={ds.mode}
          isActive={ds.isActive}
          isFinished={ds.isFinished}
          isBrewing={ds.isBrewing}
          isGrinding={ds.isGrinding}
          isGrindAvailable={ds.isGrindAvailable}
          isFlushing={ds.isFlushing}
          activate={ds.activate}
          deactivate={ds.deactivate}
          clear={ds.clear}
          startFlush={ds.startFlush}
        />
      </div>
    </div>
  );
}
