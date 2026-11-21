// Coffee grinder glyph (hopper, body, grounds cup) sized like a Font Awesome icon and tinted with currentColor.
export function GrinderIcon({ className = '' }) {
  return (
    <svg
      viewBox='56 16 400 480'
      className={`svg-inline--fa ${className}`}
      fill='currentColor'
      role='img'
      aria-hidden='true'
    >
      <path d='M112 32h288c13 0 22 12 19 24l-34 128c-4 14-16 24-31 24H158c-15 0-27-10-31-24L93 56c-3-12 6-24 19-24z' />
      <path d='M176 240h160c18 0 32 14 32 32v80H144v-80c0-18 14-32 32-32zm80 36a36 36 0 1 0 0 72 36 36 0 1 0 0-72z' />
      <path d='M104 384h304c13 0 24 11 24 24v48c0 13-11 24-24 24H104c-13 0-24-11-24-24v-48c0-13 11-24 24-24z' />
    </svg>
  );
}
