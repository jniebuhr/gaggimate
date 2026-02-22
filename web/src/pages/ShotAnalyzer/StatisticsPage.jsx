import { useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { StatisticsView } from './components/statistics/StatisticsView';

export function StatisticsPage() {
  const location = useLocation();

  const [initialContext] = useState(() => {
    try {
      const raw = sessionStorage.getItem('statsInitialContext');
      if (raw) {
        sessionStorage.removeItem('statsInitialContext');
        return JSON.parse(raw);
      }
    } catch {
      // ignore
    }
    return null;
  });

  return (
    <div className='pb-20'>
      <div className='mb-4 flex flex-row items-center gap-2'>
        <h2 className='flex-grow text-2xl font-bold sm:text-3xl'>Statistics</h2>
      </div>

      <div className='container mx-auto max-w-7xl'>
        <StatisticsView
          onBack={() => location.route('/analyzer')}
          initialContext={initialContext}
        />
      </div>
    </div>
  );
}
