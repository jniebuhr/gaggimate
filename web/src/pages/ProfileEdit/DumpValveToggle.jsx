export function DumpValveToggle({ value, onChange }) {
  const open = !!value;
  return (
    <div className='form-control'>
      <fieldset>
        <legend className='mb-2 block text-sm font-medium'>Dump valve</legend>
        <div className='join' role='group' aria-label='Dump valve state selection'>
          <button
            type='button'
            className={`join-item btn btn-sm ${!open ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => onChange(0)}
            aria-pressed={!open}
            aria-label='Dump valve closed'
          >
            Closed
          </button>
          <button
            type='button'
            className={`join-item btn btn-sm ${open ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => onChange(1)}
            aria-pressed={open}
            aria-label='Dump valve open'
          >
            Open
          </button>
        </div>
      </fieldset>
    </div>
  );
}
