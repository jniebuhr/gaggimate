import { Trans } from '@lingui/react/macro';
import { fmt } from '../utils/format';
import { STATISTICS_SECTION_TITLE_CLASS, STATISTICS_TABLE_NUMBER_CLASS } from './statisticsUi';

export function ProfileGroupTable({ profileGroups, showTitle = true }) {
  if (!profileGroups || profileGroups.length === 0) return null;

  return (
    <div>
      {showTitle && (
        <h3 className={`mb-2 ${STATISTICS_SECTION_TITLE_CLASS}`}>
          <Trans>Per-profile statistics</Trans>
        </h3>
      )}
      <div className='overflow-x-auto'>
        <table className='table-xs table w-full'>
          <thead>
            <tr className='text-xs opacity-60'>
              <th>
                <Trans>Profile</Trans>
              </th>
              <th className='text-right'>
                <Trans>Shots</Trans>
              </th>
              <th className='text-right'>
                <Trans>Avg Duration</Trans>
              </th>
              <th className='text-right'>
                <Trans>Avg Weight</Trans>
              </th>
              <th className='text-right'>
                <Trans>Avg Pumped Water</Trans>
              </th>
              <th className='text-right'>
                <Trans>Avg Pressure</Trans>
              </th>
              <th className='text-right'>
                <Trans>Avg Pump Flow</Trans>
              </th>
            </tr>
          </thead>
          <tbody>
            {profileGroups.map(group => (
              <tr key={group.profileName}>
                <td className='font-semibold'>{group.profileName}</td>
                <td className={STATISTICS_TABLE_NUMBER_CLASS}>{group.shotCount}</td>
                <td className={STATISTICS_TABLE_NUMBER_CLASS}>{fmt(group.avgDuration)}s</td>
                <td className={STATISTICS_TABLE_NUMBER_CLASS}>{fmt(group.avgWeight)}g</td>
                <td className={STATISTICS_TABLE_NUMBER_CLASS}>{fmt(group.avgWater)}ml</td>
                <td className={STATISTICS_TABLE_NUMBER_CLASS}>{fmt(group.metrics.p?.avg)} bar</td>
                <td className={STATISTICS_TABLE_NUMBER_CLASS}>{fmt(group.metrics.f?.avg)} ml/s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
