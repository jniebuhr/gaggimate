// Shared constants for Home page components
export const MODE_LABELS = ['STANDBY', 'BREW', 'STEAM', 'WATER', 'GRIND'];
export const MODE_SUBTITLES = {
  0: 'System idle',
  1: 'Ready to extract',
  2: 'Steam staging',
  3: 'Water ready',
  4: 'Grind staging',
};

// Format number with optional decimal places
export function formatNumber(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : '0.0';
}

// Stat row component — Space Mono label left, value right
// valueColor: string (CSS class) or boolean (true=highlighted, false=dimmed)
export function StatRow({ label, value, valueColor }) {
  const colorClass = typeof valueColor === 'boolean'
    ? (valueColor ? 'text-[var(--text-primary,#e8e8e8)]' : 'text-[var(--text-secondary,#999)]')
    : (valueColor || 'text-[var(--text-primary,#e8e8e8)]');
  return (
    <div className='flex items-center justify-between border-b border-[var(--home-border,#222)] py-3 last:border-b-0'>
      <span className='font-nd-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'>
        {label}
      </span>
      <span className={`font-nd-mono text-[13px] font-700 ${colorClass}`}>
        {value}
      </span>
    </div>
  );
}