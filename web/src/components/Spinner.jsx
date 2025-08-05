export function Spinner({ size = 8 }) {
  const sizeMap = {
    4: 'loading-xs',
    8: 'loading-md',
    12: 'loading-lg',
    16: 'loading-xl',
  };

  return (
    <output
      className={`loading loading-spinner ${sizeMap[size] || 'loading-md'}`}
      aria-label='Loading'
    />
  );
}
