// Notice styled like the dashboard's process cards (ProfileCard) instead of a daisyUI alert.
// Status colors are pastels in the light theme; titles mix them with the text color so they stay readable in both themes.
const TONES = {
  primary: { card: 'bg-primary/10 border-primary/30', title: 'text-primary' },
  success: {
    card: 'bg-success/15 border-success/60',
    title: 'text-[color-mix(in_oklch,var(--color-success)_45%,var(--color-base-content))]',
  },
  warning: {
    card: 'bg-warning/20 border-warning',
    title: 'text-[color-mix(in_oklch,var(--color-warning)_35%,var(--color-base-content))]',
  },
  error: {
    card: 'bg-error/15 border-error/60',
    title: 'text-[color-mix(in_oklch,var(--color-error)_50%,var(--color-base-content))]',
  },
};

export function InfoNote({ title, tone = 'primary', children }) {
  const style = TONES[tone] || TONES.primary;
  return (
    <div className={`card ${style.card} flex flex-col gap-1 rounded-xl border p-3`}>
      {title && (
        <div className={`${style.title} text-[0.65rem] font-semibold tracking-wider uppercase`}>
          {title}
        </div>
      )}
      {children && <div className='text-base-content text-sm'>{children}</div>}
    </div>
  );
}
