import Section from '../Card.jsx';

const HEADERS = ['col1', 'col2', 'col3', 'col4', 'col5'];
const ROWS = ['row1', 'row2', 'row3', 'row4', 'row5', 'row6'];
const WIDTH_CLASSES = ['w-24', 'w-12', 'w-16', 'w-20', 'w-20'];

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
                {HEADERS.map(h => (
                  <th key={h}>
                    <div className='skeleton h-4 w-16 rounded opacity-50'></div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(r => (
                <tr key={r}>
                  {HEADERS.map((h, j) => (
                    <td key={h}>
                      <div
                        className={`skeleton h-4 rounded opacity-40 ${WIDTH_CLASSES[j] || 'w-20'}`}
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
