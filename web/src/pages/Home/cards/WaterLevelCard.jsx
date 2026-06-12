import PropTypes from 'prop-types';

export function WaterLevelCard({ waterLevelPercent, inCard = false }) {
  const pct = Math.round(waterLevelPercent);

  return (
    <div className={inCard ? 'flex flex-col gap-1.5' : 'card bg-base-100 flex flex-col gap-1.5 rounded-xl p-3'}>
      <div className='flex items-center justify-between'>
        <div className='text-base-content/50 text-[0.6rem] font-semibold tracking-wider uppercase'>
          Water Tank
        </div>
        <div className='text-info text-xs font-bold tabular-nums'>{pct}%</div>
      </div>
      <div className='bg-base-content/10 h-2 w-full overflow-hidden rounded-full'>
        <div
          className='bg-info h-full rounded-full transition-all duration-500 ease-out'
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

WaterLevelCard.propTypes = {
  waterLevelPercent: PropTypes.number.isRequired,
  inCard:            PropTypes.bool,
};
