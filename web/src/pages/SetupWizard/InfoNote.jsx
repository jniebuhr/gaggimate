// Notice styled like the dashboard's active-brew card (ProfileCard) instead of a daisyUI alert.
export function InfoNote({ title, children }) {
  return (
    <div className='card bg-primary/10 border-primary/30 flex flex-col gap-1 rounded-xl border p-3'>
      {title && (
        <div className='text-primary text-[0.65rem] font-semibold tracking-wider uppercase'>
          {title}
        </div>
      )}
      <div className='text-base-content text-sm'>{children}</div>
    </div>
  );
}
