import { fmt } from '../utils/format';
import { STATISTICS_SECTION_TITLE_CLASS } from './statisticsUi';

export function ProfileGroupTable({ profileGroups, showTitle = true }) {
  if (!profileGroups || profileGroups.length === 0) return null;

  return (
    <div>
      {showTitle && (
        <h3 className={`mb-2 ${STATISTICS_SECTION_TITLE_CLASS}`}>Per-profile statistics</h3>
      )}
      <div className='border-base-content/10 overflow-x-auto rounded-2xl border bg-base-100/35 shadow-sm'>
        <table className='table-xs table w-full min-w-[50rem] text-[11px]'>
          <thead className='bg-base-200/92 sticky top-0 z-10 backdrop-blur-sm'>
            <tr className='text-xs opacity-60'>
              <th>Profile</th>
              <th className='text-right'>Shots</th>
              <th className='text-right'>Avg Duration</th>
              <th className='text-right'>Avg Weight</th>
              <th className='text-right'>Avg Water</th>
              <th className='text-right'>Avg Dose In</th>
              <th className='text-right'>Avg Pressure</th>
              <th className='text-right'>Avg Flow</th>
            </tr>
          </thead>
          <tbody>
            {profileGroups.map(group => (
              <tr key={group.profileName}>
                <td className='font-semibold'>{group.profileName}</td>
                <td className='text-right font-mono'>{group.shotCount}</td>
                <td className='text-right font-mono'>{fmt(group.avgDuration)}s</td>
                <td className='text-right font-mono'>{fmt(group.avgWeight)}g</td>
                <td className='text-right font-mono'>{fmt(group.avgWater)}ml</td>
                <td className='text-right font-mono'>{fmt(group.avgDoseIn)}g</td>
                <td className='text-right font-mono'>{fmt(group.metrics.p?.avg)} bar</td>
                <td className='text-right font-mono'>{fmt(group.metrics.f?.avg)} ml/s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
