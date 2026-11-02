import PropTypes from 'prop-types';
import { Trans } from '@lingui/react/macro';

export function WaterLevelCard({ waterLevelPercent, inCard = false }) {
  // null: the Alba is attached but its tank distances are missing or invalid.
  const calibrated = waterLevelPercent !== null && waterLevelPercent !== undefined;
  const pct = calibrated ? Math.round(waterLevelPercent) : 0;

  return (
    <div
      className={
        inCard ? 'flex flex-col gap-1.5' : 'card bg-base-100 flex flex-col gap-1.5 rounded-xl p-3'
      }
    >
      <div className='flex items-center justify-between'>
        <div className='text-base-content/50 text-[0.6rem] font-semibold tracking-wider uppercase'>
          <Trans>Water Tank</Trans>
        </div>
        <div className='text-info text-xs font-bold tabular-nums'>
          {calibrated ? `${pct}%` : '—'}
        </div>
      </div>
      <div className='bg-base-content/10 h-2 w-full overflow-hidden rounded-full'>
        <div
          className='bg-info h-full rounded-full transition-all duration-500 ease-out'
          style={{ width: `${pct}%` }}
        />
      </div>
      {!calibrated && (
        <div className='text-base-content/50 text-[0.65rem] leading-tight'>
          <Trans>Set the tank distances in Settings → Machine to see the level.</Trans>
        </div>
      )}
    </div>
  );
}

WaterLevelCard.propTypes = {
  waterLevelPercent: PropTypes.number,
  inCard: PropTypes.bool,
};
