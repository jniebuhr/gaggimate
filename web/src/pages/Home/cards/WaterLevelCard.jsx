import { faDroplet, faRotateLeft } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import PropTypes from 'prop-types';
import { useState } from 'preact/hooks';

const severityLabels = ['Tracking', 'Refill soon', 'Refill now'];
const severityColors = ['text-info', 'text-warning', 'text-error'];

function CardFrame({ children, inCard, compact = false }) {
  const classes = `flex flex-col ${compact ? 'gap-1.5' : 'gap-2'}`;
  return (
    <div className={inCard ? classes : `card bg-base-100 ${classes} rounded-xl p-3`}>
      {children}
    </div>
  );
}

function ReminderHeader({ color, status }) {
  return (
    <div className='flex items-center justify-between gap-3'>
      <div className='flex items-center gap-2'>
        <FontAwesomeIcon icon={faDroplet} className={color} />
        <span className='text-base-content/50 text-[0.6rem] font-semibold tracking-wider uppercase'>
          Water Tank
        </span>
      </div>
      <span className={`${color} text-xs font-bold`}>{status}</span>
    </div>
  );
}

function PhysicalWaterLevel({ inCard, waterLevelPercent }) {
  const percent = Math.round(waterLevelPercent);

  return (
    <CardFrame inCard={inCard} compact>
      <div className='flex items-center justify-between'>
        <div className='text-base-content/50 text-[0.6rem] font-semibold tracking-wider uppercase'>
          Water Tank
        </div>
        <div className='text-info text-xs font-bold tabular-nums'>{percent}%</div>
      </div>
      <div className='bg-base-content/10 h-2 w-full overflow-hidden rounded-full'>
        <div
          className='bg-info h-full rounded-full transition-all duration-500 ease-out'
          style={{ width: `${percent}%` }}
        />
      </div>
    </CardFrame>
  );
}

function formatReminderTime(timestamp) {
  if (!timestamp) return null;
  return new Date(timestamp * 1000).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function ScheduleReminder({ inCard, reminder, onRefill, onTomorrow }) {
  let detail = `Next reminder ${formatReminderTime(reminder.nextReminderAt)}.`;
  if (!reminder.clockReady) {
    detail = 'Waiting for clock sync.';
  } else if (reminder.scheduleDue) {
    const suffix = reminder.daysSinceRefill === 1 ? '' : 's';
    detail = `${reminder.daysSinceRefill} day${suffix} since the last refill.`;
  }

  return (
    <CardFrame inCard={inCard}>
      <ReminderHeader
        color='text-info'
        status={reminder.scheduleDue ? 'Refill reminder' : 'Scheduled'}
      />
      <div className='text-sm font-semibold tabular-nums'>{detail}</div>
      <div className='flex items-center gap-2'>
        {reminder.scheduleDue && (
          <button type='button' className='btn btn-sm bg-white text-gray-900' onClick={onTomorrow}>
            Tomorrow
          </button>
        )}
        <button type='button' className='btn btn-primary btn-sm flex-1' onClick={onRefill}>
          Water refilled
        </button>
      </div>
    </CardFrame>
  );
}

function CriticalConfirmation({ onCancel, onConfirm }) {
  return (
    <div className='space-y-2'>
      <p className='text-error text-xs font-semibold'>Continue without refilling?</p>
      <p className='text-base-content/70 text-xs'>
        Running the tank dry can put air in the pressure-sensor line and require it to be bled
        again.
      </p>
      <div className='flex items-center gap-2'>
        <button
          type='button'
          className='btn btn-sm border-gray-200 bg-white text-gray-900 hover:bg-gray-100'
          onClick={onCancel}
        >
          Go back
        </button>
        <button type='button' className='btn btn-error btn-sm flex-1' onClick={onConfirm}>
          Proceed anyway
        </button>
      </div>
    </div>
  );
}

function UsageActions({ critical, reminder, onLater, onRefill, onResetCalibration }) {
  const [confirmCritical, setConfirmCritical] = useState(false);
  const proceed = () => {
    setConfirmCritical(false);
    onLater();
  };

  if (critical && confirmCritical) {
    return <CriticalConfirmation onCancel={() => setConfirmCritical(false)} onConfirm={proceed} />;
  }

  const laterClass = critical
    ? 'btn btn-sm border-gray-500 bg-gray-500 text-white hover:bg-gray-600'
    : 'btn btn-error btn-sm';

  return (
    <div className='flex items-center gap-2'>
      {reminder.warningPending && (
        <button
          type='button'
          className={laterClass}
          onClick={() => (critical ? setConfirmCritical(true) : onLater())}
        >
          {critical ? 'Not now' : 'Later'}
        </button>
      )}
      <button type='button' className='btn btn-primary btn-sm flex-1' onClick={onRefill}>
        Water refilled
      </button>
      <button
        type='button'
        className='btn btn-ghost btn-square btn-sm'
        onClick={onResetCalibration}
        disabled={!reminder.calibrated}
        aria-label='Reset water reminder calibration'
        title='Reset calibration'
      >
        <FontAwesomeIcon icon={faRotateLeft} />
      </button>
    </div>
  );
}

function UsageReminder({ inCard, reminder, onLater, onRefill, onResetCalibration }) {
  const severity = reminder.severity ?? 0;
  const drinkSuffix = reminder.drinks === 1 ? '' : 's';
  const countDetail = `${reminder.drinks} drink${drinkSuffix} since the last refill.`;
  const detail = reminder.pumpLed
    ? 'Recent water use suggests the tank may be getting low.'
    : countDetail;

  return (
    <CardFrame inCard={inCard}>
      <ReminderHeader color={severityColors[severity]} status={severityLabels[severity]} />
      <div className='text-sm'>
        <div className='font-semibold tabular-nums'>{detail}</div>
        {severity === 0 && (
          <div className='text-base-content/55 text-xs'>
            {reminder.calibrated
              ? 'Also accounts for brewing, steaming, and flushing.'
              : 'Learning your water use after each refill.'}
          </div>
        )}
      </div>
      <UsageActions
        critical={severity === 2}
        reminder={reminder}
        onLater={onLater}
        onRefill={onRefill}
        onResetCalibration={onResetCalibration}
      />
    </CardFrame>
  );
}

export function WaterLevelCard({
  waterLevelPercent,
  reminder,
  onLater,
  onRefill,
  onResetCalibration,
  onTomorrow,
  inCard = false,
}) {
  if (waterLevelPercent !== null) {
    return <PhysicalWaterLevel inCard={inCard} waterLevelPercent={waterLevelPercent} />;
  }
  if (reminder.mode === 1) {
    return (
      <ScheduleReminder
        inCard={inCard}
        reminder={reminder}
        onRefill={onRefill}
        onTomorrow={onTomorrow}
      />
    );
  }
  return (
    <UsageReminder
      inCard={inCard}
      reminder={reminder}
      onLater={onLater}
      onRefill={onRefill}
      onResetCalibration={onResetCalibration}
    />
  );
}

WaterLevelCard.propTypes = {
  waterLevelPercent: PropTypes.number,
  reminder: PropTypes.object,
  onLater: PropTypes.func,
  onRefill: PropTypes.func,
  onResetCalibration: PropTypes.func,
  onTomorrow: PropTypes.func,
  inCard: PropTypes.bool,
};
