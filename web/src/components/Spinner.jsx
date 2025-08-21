export function Spinner({ size = 8 }) {
  const sizeMap = {
    4: 'loading-xs',
    8: 'loading-md',
    12: 'loading-lg',
    16: 'loading-xl',
  };

  return (
    <span
      className={`loading loading-spinner ${sizeMap[size] || 'loading-md'}`}
      role='status'
      aria-label='Loading'
    />
  );
}
