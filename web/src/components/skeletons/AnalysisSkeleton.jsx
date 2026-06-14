import Section from '../Card.jsx';

export function AnalysisSkeleton() {
  return (
    <div className='space-y-4 sm:space-y-6'>
      {/* Filters/Actions area skeleton */}
      <div className='flex flex-wrap items-center justify-between gap-4'>
        <div className='flex gap-2'>
          <div className='h-10 w-24 skeleton rounded-lg opacity-80'></div>
          <div className='h-10 w-24 skeleton rounded-lg opacity-80'></div>
        </div>
        <div className='h-10 w-36 skeleton rounded-lg opacity-80'></div>
      </div>

      {/* Main card representation */}
      <Section>
        {/* Table skeleton */}
        <div className='overflow-x-auto w-full'>
          <table className='table w-full'>
            <thead>
              <tr>
                {Array.from({ length: 5 }).map((_, i) => (
                  <th key={i}>
                    <div className='h-4 w-16 skeleton rounded opacity-50'></div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j}>
                      <div className={`h-4 skeleton rounded opacity-40 ${j === 0 ? 'w-24' : j === 1 ? 'w-12' : j === 2 ? 'w-16' : 'w-20'}`}></div>
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
