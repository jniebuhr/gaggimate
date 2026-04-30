import { useMemo, useState } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import { StatisticsView } from './components/StatisticsView';
import { parseStatisticsProfileRouteParams } from './utils/statisticsRoute';

// Statistics entry page: resolves prefill context from route deep links first,
// then falls back to sessionStorage compatibility, then a plain GM default.
export function StatisticsPage() {
  const { params } = useRoute();
  const [sessionInitialContext] = useState(() => {
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
  const routeInitialContext = useMemo(() => parseStatisticsProfileRouteParams(params), [params]);
  // Route-based deep links are canonical and should win over transient session state.
  const initialContext = routeInitialContext || sessionInitialContext || { source: 'gaggimate' };

  return (
    <div className='flex flex-col gap-6 pb-20'>
      <div>
        <h1 className='font-nd-mono text-[20px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'>
          Statistics
        </h1>
        <p className='font-nd-mono text-[13px] text-[var(--text-disabled,#666)] mt-2 max-w-xl'>
          Analyze shot performance metrics, trends, and per-profile/per-phase statistics.
        </p>
      </div>

      <div className='w-full'>
        <StatisticsView initialContext={initialContext} />
      </div>
    </div>
  );
}
