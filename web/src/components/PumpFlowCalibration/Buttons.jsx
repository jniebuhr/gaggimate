export function PrimaryButton({ children, className = '', ...rest }) {
  return (
    <button type='button' className={`btn btn-primary ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className = '', ...rest }) {
  return (
    <button type='button' className={`btn btn-ghost ${className}`} {...rest}>
      {children}
    </button>
  );
}
