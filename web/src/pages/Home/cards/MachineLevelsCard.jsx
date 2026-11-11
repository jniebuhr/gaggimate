import PropTypes from 'prop-types';
import { Trans, useLingui } from '@lingui/react/macro';

export function MachineLevelsCard({
  hasTankLevel,
  tankLevelOK,
  hasSteamLevel,
  steamBoilerLow,
  inCard = false,
}) {
  const { t } = useLingui();
  const levels = [
    {
      label: t`Water Tank`,
      present: hasTankLevel,
      known: tankLevelOK != null,
      low: tankLevelOK === false,
    },
    {
      label: t`Steam Boiler`,
      present: hasSteamLevel,
      known: steamBoilerLow != null,
      low: steamBoilerLow === true,
    },
  ].filter(level => level.present);
  if (!levels.length) return null;

  return (
    <div
      className={
        inCard ? 'flex flex-col gap-2' : 'card bg-base-100 flex flex-col gap-2 rounded-xl p-3'
      }
    >
      <div className='text-base-content/50 text-[0.6rem] font-semibold tracking-wider uppercase'>
        <Trans>Water Levels</Trans>
      </div>
      <dl className='grid grid-cols-1 gap-2 text-sm sm:grid-cols-2' aria-live='polite'>
        {levels.map(({ label, known, low }) => (
          <div
            key={label}
            className='bg-base-200/60 flex items-center justify-between gap-3 rounded-lg p-3'
          >
            <dt>{label}</dt>
            <dd
              className={`text-xs font-semibold ${!known ? 'text-base-content/50' : low ? 'text-error' : 'text-success'}`}
            >
              {!known ? t`Unknown` : low ? t`Low` : t`OK`}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

MachineLevelsCard.propTypes = {
  hasTankLevel: PropTypes.bool,
  tankLevelOK: PropTypes.bool,
  hasSteamLevel: PropTypes.bool,
  steamBoilerLow: PropTypes.bool,
  inCard: PropTypes.bool,
};
