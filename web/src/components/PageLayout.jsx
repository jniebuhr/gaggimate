export default function PageLayout({ variant = 'wide', fill = false, children, className = '' }) {
  const widthClass = variant === 'narrow' ? 'mx-auto max-w-4xl w-full' : 'w-full';
  // fill: stretch short settings tabs so the save bar sits at the screen bottom.
  // Grid is required — flex children do not grow into a min-height.
  const layoutClass = fill
    ? 'grid min-h-[calc(100dvh_-_max(1rem,env(safe-area-inset-top))_-_1rem)] w-full min-w-0 grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] gap-8 pb-0 lg:gap-10'
    : 'flex flex-col gap-8 pb-20 lg:gap-10';

  return <div className={`${widthClass} ${layoutClass} ${className}`}>{children}</div>;
}
