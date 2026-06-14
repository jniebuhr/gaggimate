import Section from '../Card.jsx';

export function AnalysisSkeleton() {
  return (
    <div className='space-y-4 sm:space-y-6'>
      {/* Filters/Actions area skeleton */}
      <div className='flex flex-wrap items-center justify-between gap-4'>
        <div className='flex gap-2'>
          <div className='skeleton h-10 w-24 rounded-lg opacity-80'></div>
          <div className='skeleton h-10 w-24 rounded-lg opacity-80'></div>
        </div>
        <div className='skeleton h-10 w-36 rounded-lg opacity-80'></div>
      </div>

      {/* Main card representation */}
      <Section>
        {/* Table skeleton */}
        <div className='w-full overflow-x-auto'>
          <table className='table w-full'>
            <thead>
              <tr>
                {Array.from({ length: 5 }).map((_, i) => (
                  <th key={i}>
                    <div className='skeleton h-4 w-16 rounded opacity-50'></div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j}>
                      <div
                        className={`skeleton h-4 rounded opacity-40 ${j === 0 ? 'w-24' : j === 1 ? 'w-12' : j === 2 ? 'w-16' : 'w-20'}`}
                      ></div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
