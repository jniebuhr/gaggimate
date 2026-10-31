import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons/faTrashCan';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';

export const TargetTypes = [
  {
    label: msg`Water drawn`,
    type: 'pumped',
    operator: 'gte',
    unit: 'ml',
  },
  {
    label: msg`Weight reached`,
    type: 'volumetric',
    operator: 'gte',
    unit: 'g',
  },
  {
    label: msg`Ratio reached`,
    type: 'ratio',
    operator: 'gte',
    unit: '1:',
    unitPosition: 'left',
  },
  {
    label: msg`Pressure above`,
    type: 'pressure',
    operator: 'gte',
    unit: 'bar',
  },
  {
    label: msg`Pressure below`,
    type: 'pressure',
    operator: 'lte',
    unit: 'bar',
  },
  {
    label: msg`Flow above`,
    type: 'flow',
    operator: 'gte',
    unit: 'ml/s',
  },
  {
    label: msg`Flow below`,
    type: 'flow',
    operator: 'lte',
    unit: 'ml/s',
  },
];

export function ExtendedPhaseTarget({ onChange, target, index, onRemove }) {
  const { t, i18n } = useLingui();
  const targetType =
    TargetTypes.find(tt => tt.type === target.type && tt.operator === (target.operator || 'gte')) ||
    TargetTypes[0];
  const unit = targetType.unit;
  return (
    <>
      <div className='grid grid-cols-1 gap-4'>
        <div className='form-control'>
          <label htmlFor={`phase-${index}-target-value`} className='mb-2 block text-sm font-medium'>
            {i18n._(targetType.label)}
          </label>
          <div className='flex flex-row gap-2'>
            <div className='input-group flex-grow'>
              <label htmlFor={`phase-${index}-target-value`} className='input w-full'>
                {targetType.unitPosition === 'left' && (
                  <span aria-label={targetType.unit}>{targetType.unit}</span>
                )}
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
                  aria-label={t`Target value in ${unit}`}
                  min='0'
                  step='0.1'
                />
                {targetType.unitPosition !== 'left' && (
                  <span aria-label={targetType.unit}>{targetType.unit}</span>
                )}
              </label>
            </div>
            <button
              type='button'
              className={`join-item btn btn-outline text-error`}
              aria-label={t`Remove target`}
              onClick={() => onRemove()}
            >
              <FontAwesomeIcon icon={faTrashCan} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
