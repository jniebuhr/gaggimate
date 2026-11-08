export function TooltipShotBadge({ shotNumber, color, className }) {
  if (shotNumber !== null && shotNumber !== undefined) {
    return (
      <span
        className={[
          'analyzer-compare-shot-badge',
          className,
          shotNumber === 2 ? 'analyzer-compare-shot-badge--striped' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ '--analyzer-compare-shot-color': color || 'var(--color-primary)' }}
      >
        {shotNumber}
      </span>
    );
  }
  return null;
}
