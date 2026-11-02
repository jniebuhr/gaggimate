import { useLingui } from '@lingui/react/macro';

/**
 * @param {object} props
 * @param {number} [props.size] - 4, 8, 12 or 16
 * @param {string} [props.className]
 */
export function Spinner({ size = 8, className = '' }) {
  const { t } = useLingui();
  const sizeMap = {
    4: 'loading-xs',
    8: 'loading-md',
    12: 'loading-lg',
    16: 'loading-xl',
  };

  return (
    <span
      className={`loading loading-spinner ${sizeMap[size] || 'loading-md'} ${className}`}
      role='status'
      aria-label={t`Loading`}
    />
  );
}
