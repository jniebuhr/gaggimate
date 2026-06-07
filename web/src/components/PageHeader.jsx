export default function PageHeader({ title, actions, className = '', noStack = false }) {
  const flexClasses = noStack
    ? 'flex flex-row items-center justify-between gap-4'
    : 'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between';

  return (
    <div className={`${flexClasses} ${className}`}>
      <h1 className="text-2xl font-bold sm:text-3xl text-base-content tracking-tight">
        {title}
      </h1>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
