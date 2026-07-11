import { fmt } from '../utils/format';
import { STATISTICS_SECTION_TITLE_CLASS, STATISTICS_TABLE_NUMBER_CLASS } from './statisticsUi';

export function ProfileGroupTable({ profileGroups, showTitle = true }) {
  if (!profileGroups || profileGroups.length === 0) return null;

  return (
    <div>
      {showTitle && (
        <h3 className={`mb-2 ${STATISTICS_SECTION_TITLE_CLASS}`}>Per-profile statistics</h3>
      )}
      <div className='overflow-x-auto'>
        <table className='table-xs table w-full'>
          <thead>
            <tr className='text-xs opacity-60'>
              <th>Profile</th>
              <th className='text-right'>Shots</th>
              <th className='text-right'>Avg Duration</th>
              <th className='text-right'>Avg Weight</th>
              <th className='text-right'>Avg Pumped Water</th>
              <th className='text-right'>Avg Pressure</th>
              <th className='text-right'>Avg Pump Flow</th>
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
