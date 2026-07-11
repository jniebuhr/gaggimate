// GitHub-style activity heatmap: rolling 12-month view of daily shot counts with streak tracking
import { useState, useMemo, useRef, useEffect } from 'preact/hooks';
import { getDayStartLocalMs, getIsoWeekStartLocalMs, formatDateLocal } from '../utils/trendBuckets';
import { CardTitle } from '../../../components/CardTitle';

const DAY_LABELS = [
  { dow: 0, label: 'M' },
  { dow: 2, label: 'W' },
  { dow: 4, label: 'F' },
];
const MS_PER_DAY = 86400000;

const TOOLTIP_DATE_OPTIONS = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
const MONTH_LABEL_OPTIONS = { month: 'short', year: '2-digit' };

const SHOT_COLOR = 'var(--statistics-trend-shots-brown, #8B5E3C)';
const FUTURE_FILL = 'fill-base-content/[0.03]';
const EMPTY_FILL = 'fill-base-content/[0.06]';
const SHOT_FILL_OPACITY = [0.4, 0.6, 0.8, 1];

function computeStreaks(dayMap, startMs, todayMs) {
  const totalDaysToToday = Math.round((todayMs - startMs) / MS_PER_DAY) + 1;
  let longest = 0;
  let streak = 0;

  const cursor = new Date(startMs);
  for (let i = 0; i < totalDaysToToday; i++) {
    if ((dayMap.get(cursor.getTime()) || 0) > 0) {
      streak++;
      if (streak > longest) longest = streak;
    } else {
      streak = 0;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  // Current streak: count back from today until the first gap.
  let current = 0;
  const back = new Date(todayMs);
  if ((dayMap.get(back.getTime()) || 0) === 0) {
    back.setDate(back.getDate() - 1);
  }
  for (let i = 0; i < totalDaysToToday; i++) {
    if ((dayMap.get(back.getTime()) || 0) > 0) {
      current++;
    } else {
      break;
    }
    back.setDate(back.getDate() - 1);
  }

  return { longest, current };
}

function buildHeatmapData(trends) {
  const dayMap = new Map();
  let earliestAllTime = Infinity;
  for (const entry of trends) {
    if (!entry.timestamp) continue;
    const dayMs = getDayStartLocalMs(entry.timestamp);
    if (dayMs == null) continue;
    dayMap.set(dayMs, (dayMap.get(dayMs) || 0) + 1);
    if (dayMs < earliestAllTime) earliestAllTime = dayMs;
  }

  if (dayMap.size === 0) return null;

  const todayMs = getDayStartLocalMs(Date.now());

  const endDate = new Date(todayMs);
  const endDow = (endDate.getDay() + 6) % 7;
  endDate.setDate(endDate.getDate() + (6 - endDow)); // forward to Sunday of current week
  const endMs = endDate.getTime();

  // GitHub-style rolling window: one year back, Monday-aligned via shared utility.
  const startDate = new Date(todayMs);
  startDate.setFullYear(startDate.getFullYear() - 1);
  const startMs = getIsoWeekStartLocalMs(startDate.getTime());

  const totalDays = Math.round((endMs - startMs) / MS_PER_DAY) + 1;
  const weeks = Math.ceil(totalDays / 7);

  let totalShots = 0;
  let daysWithShots = 0;
  let earliestShot = null;

  const cells = [];
  const cursor = new Date(startMs);
  for (let i = 0; i < totalDays; i++) {
    const dayMs = cursor.getTime();
    const count = dayMap.get(dayMs) || 0;
    cells.push({ dayMs, count, week: Math.floor(i / 7), dow: i % 7 });
    if (dayMs <= todayMs && count > 0) {
      totalShots += count;
      daysWithShots++;
      if (earliestShot == null) earliestShot = dayMs;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  const monthLabels = [];
  let lastMonth = -1;
  const weekCursor = new Date(startMs);
  for (let w = 0; w < weeks; w++) {
    const month = weekCursor.getMonth();
    if (month !== lastMonth) {
      monthLabels.push({
        week: w,
        label: formatDateLocal(weekCursor.getTime(), MONTH_LABEL_OPTIONS),
      });
      lastMonth = month;
    }
    weekCursor.setDate(weekCursor.getDate() + 7);
  }

  const daysFromFirst =
    earliestShot != null ? Math.round((todayMs - earliestShot) / MS_PER_DAY) + 1 : 0;
  const dailyAvg = daysFromFirst > 0 ? totalShots / daysFromFirst : 0;

  // Streaks deliberately run over the full history, not just visible year.
  const streaks = computeStreaks(dayMap, earliestAllTime, todayMs);
  return {
    cells,
    monthLabels,
    weeks,
    todayMs,
    stats: {
      totalShots,
      daysWithShots,
      dailyAvg,
      longestStreak: streaks.longest,
      currentStreak: streaks.current,
    },
  };
}

export function ActivityHeatmap({ trends }) {
  const [tooltip, setTooltip] = useState(null);
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const data = useMemo(() => buildHeatmapData(trends || []), [trends]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.getBoundingClientRect().width);
    update();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(update);
      observer.observe(el);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    if (!tooltip) return;
    const dismiss = () => setTooltip(null);
    const onPointerDown = e => {
      if (!containerRef.current?.contains(e.target)) setTooltip(null);
    };
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [!!tooltip]);

  if (!data || data.stats.totalShots === 0) return null;

  const { weeks } = data;
  const labelWidth = 20;
  const availableWidth = containerWidth > 0 ? containerWidth - labelWidth : 0;
  const cellGap = 2;
  const cellSize =
    availableWidth > 0 ? Math.max(8, Math.floor(availableWidth / weeks - cellGap)) : 11;
  const step = cellSize + cellGap;
  const topPadding = 16;
  const svgWidth = labelWidth + weeks * step;
  const svgHeight = topPadding + 7 * step;

  return (
    <div ref={containerRef}>
      <CardTitle className='mb-2 px-0.5 py-1'>Activity Heatmap</CardTitle>
      <div className='overflow-x-auto'>
        <svg
          width={svgWidth}
          height={svgHeight + 4}
          className='block'
          style={{ minWidth: svgWidth }}
        >
          {data.monthLabels.map((m, i) => (
            <text
              key={i}
              x={labelWidth + m.week * step}
              y={10}
              style={{ fontSize: '10px', fill: 'var(--statistics-trend-axis-tick, #888)' }}
            >
              {m.label}
            </text>
          ))}

          {DAY_LABELS.map(({ dow, label }) => (
            <text
              key={dow}
              x={0}
              y={topPadding + dow * step + cellSize - 1}
              style={{ fontSize: '10px', fill: 'var(--statistics-trend-shots-brown, #8B5E3C)' }}
            >
              {label}
            </text>
          ))}

          {data.cells.map((cell, i) => {
            const x = labelWidth + cell.week * step;
            const y = topPadding + cell.dow * step;
            const isFuture = cell.dayMs > data.todayMs;
            const hasShots = !isFuture && cell.count > 0;
            const makeTooltip = e => ({
              cell,
              x: e.clientX,
              y: e.clientY,
              onLeft: e.clientX > window.innerWidth / 2,
            });
            const handleHover = e => {
              if (isFuture || e.pointerType !== 'mouse') return;
              setTooltip(makeTooltip(e));
            };

            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={cellSize}
                height={cellSize}
                rx={2}
                className={hasShots ? undefined : isFuture ? FUTURE_FILL : EMPTY_FILL}
                style={{
                  cursor: isFuture ? 'default' : 'pointer',
                  ...(hasShots && {
                    fill: SHOT_COLOR,
                    fillOpacity:
                      SHOT_FILL_OPACITY[Math.min(cell.count, SHOT_FILL_OPACITY.length) - 1],
                  }),
                }}
                onPointerEnter={handleHover}
                onPointerMove={handleHover}
                onPointerLeave={e => {
                  if (e.pointerType !== 'mouse') return;
                  setTooltip(null);
                }}
                onPointerUp={e => {
                  // Touch/pen have no hover: tap to show, tap the same cell again to hide.
                  if (isFuture || e.pointerType === 'mouse') return;
                  setTooltip(prev =>
                    prev && prev.cell.dayMs === cell.dayMs ? null : makeTooltip(e),
                  );
                }}
              />
            );
          })}
        </svg>
      </div>

      <div className='mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs'>
        <span className='opacity-60'>
          Daily average:{' '}
          <span className='text-base-content font-bold'>
            {data.stats.dailyAvg.toFixed(1)} shots
          </span>
        </span>
        <span className='opacity-60'>
          Days active:{' '}
          <span className='text-base-content font-bold'>{data.stats.daysWithShots}</span>
        </span>
        <span className='opacity-60'>
          Longest streak:{' '}
          <span className='text-base-content font-bold'>
            {data.stats.longestStreak} {data.stats.longestStreak === 1 ? 'day' : 'days'}
          </span>
        </span>
        <span className='opacity-60'>
          Current streak:{' '}
          <span className='text-base-content font-bold'>
            {data.stats.currentStreak} {data.stats.currentStreak === 1 ? 'day' : 'days'}
          </span>
        </span>
      </div>

      {tooltip && (
        <div
          className='bg-base-300 text-base-content pointer-events-none fixed z-50 rounded-md px-2.5 py-1.5 text-xs shadow-lg'
          style={{
            ...(tooltip.onLeft
              ? { right: window.innerWidth - tooltip.x + 12 }
              : { left: tooltip.x + 12 }),
            top: tooltip.y > 48 ? tooltip.y - 36 : tooltip.y + 16,
          }}
        >
          <div className='font-semibold'>
            {tooltip.cell.count} {tooltip.cell.count === 1 ? 'shot' : 'shots'}
          </div>
          <div className='opacity-60'>
            {formatDateLocal(tooltip.cell.dayMs, TOOLTIP_DATE_OPTIONS)}
          </div>
        </div>
      )}
    </div>
  );
}
