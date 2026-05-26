export function SettingsFormField({
  label,
  htmlFor,
  helpText,
  children,
  className = '',
  noMargin = false,
}) {
  return (
    <div className={`form-control ${noMargin ? '' : 'mb-3'} ${className}`}>
      <label htmlFor={htmlFor} className='mb-1 block text-sm font-medium'>
        {label}
      </label>
      {children}
      {helpText && <div className='mt-1 text-xs opacity-70'>{helpText}</div>}
    </div>
  );
}

export function InputGroupField({
  label,
  htmlFor,
  unit,
  unitAriaLabel,
  helpText,
  children,
  noMargin = false,
}) {
  return (
    <div className={`form-control ${noMargin ? '' : 'mb-3'}`}>
      <label htmlFor={htmlFor} className='mb-1 block text-sm font-medium'>
        {label}
      </label>
      <div className='input-group'>
        <label htmlFor={htmlFor} className='input w-full'>
          {children}
          <span aria-label={unitAriaLabel}>{unit}</span>
        </label>
      </div>
      {helpText && <div className='mt-1 text-xs opacity-70'>{helpText}</div>}
    </div>
  );
}

export function ToggleField({ label, htmlFor, checked, onChange, helpText }) {
  return (
    <div className='form-control'>
      <label htmlFor={htmlFor} className='label cursor-pointer'>
        <span className='label-text text-sm font-medium'>{label}</span>
        <input
          id={htmlFor}
          name={htmlFor}
          type='checkbox'
          className='toggle toggle-primary'
          checked={checked}
          onChange={onChange}
        />
      </label>
      {helpText && <div className='mt-1 text-xs opacity-70'>{helpText}</div>}
    </div>
  );
}
