const TargetTypes = [
  {
    label: 'Volume',
    type: 'volumetric',
    operator: 'gte',
    unit: 'g',
  },
  {
    label: 'Pumped water',
    type: 'pumped',
    operator: 'gte',
    unit: 'ml',
  },
  {
    label: 'Pressure above',
    type: 'pressure',
    operator: 'gte',
    unit: 'bar',
  },
  {
    label: 'Pressure below',
    type: 'pressure',
    operator: 'lte',
    unit: 'bar',
  },
  {
    label: 'Flow above',
    type: 'flow',
    operator: 'gte',
    unit: 'ml/s',
  },
  {
    label: 'Flow below',
    type: 'flow',
    operator: 'lte',
    unit: 'ml/s',
  },
];

export function ExtendedPhaseTarget({ onChange, target, index, onRemove }) {
  const targetType =
    TargetTypes.find(tt => tt.type === target.type && tt.operator === (target.operator || 'gte')) ||
    TargetTypes[0];
  return (
    <>
      <div className='grid grid-cols-1 gap-4'>
        <div className='form-control flex flex-row gap-4'>
          <fieldset className='flex-grow'>
            <div className='join' role='group' aria-label='Pump mode selection'>
              {TargetTypes.map((tt, idx) => (
                <button
                  type='button'
                  className={`join-item btn btn-sm ${target.type === tt.type && (target.operator || 'gte') === tt.operator ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => onChange({ ...target, operator: tt.operator, type: tt.type })}
                  aria-pressed={
                    target.type === tt.type && (target.operator || 'gte') === tt.operator
                  }
                  aria-label={tt.label}
                >
                  {tt.label}
                </button>
              ))}
            </div>
          </fieldset>
          <button
            type='button'
            className={`join-item btn btn-sm btn-outline text-error`}
            aria-label='Remove target'
            onClick={() => onRemove()}
          >
            <i className='fa fa-trash-can' aria-hidden='true' />
          </button>
        </div>
      </div>
      <div className='grid grid-cols-1 gap-4'>
        <div className='form-control'>
          <label htmlFor={`phase-${index}-target-value`} className='mb-2 block text-sm font-medium'>
            Value
          </label>
          <div className='input-group'>
            <label htmlFor={`phase-${index}-target-value`} className='input w-full'>
              <input
                id={`phase-${index}-target-value`}
                className='grow'
                type='number'
                value={target.value || 0}
                onChange={e =>
                  onChange({
                    ...target,
                    value: parseFloat(e.target.value),
                  })
                }
                aria-label={`Target value in ${targetType.unit}`}
                min='0'
                step='0.1'
              />
              <span aria-label={targetType.unit}>{targetType.unit}</span>
            </label>
          </div>
        </div>
      </div>
    </>
  );
}
