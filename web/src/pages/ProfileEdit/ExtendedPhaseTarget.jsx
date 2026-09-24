import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons/faTrashCan';
import { InputGroupField } from '../../components/SettingsFormField.jsx';

export const TargetTypes = [
  {
    label: 'Water drawn',
    type: 'pumped',
    operator: 'gte',
    unit: 'ml',
  },
  {
    label: 'Weight reached',
    type: 'volumetric',
    operator: 'gte',
    unit: 'g',
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

export function ExtendedPhaseTarget({ onChange, target, index, phaseIndex = 0, onRemove }) {
  const targetType =
    TargetTypes.find(tt => tt.type === target.type && tt.operator === (target.operator || 'gte')) ||
    TargetTypes[0];
  const fieldId = `phase-${phaseIndex}-target-${index}-value`;
  return (
    <>
      <div className='grid grid-cols-1 gap-4'>
        <div className='flex items-start gap-2'>
          <InputGroupField
            label={targetType.label}
            htmlFor={fieldId}
            unit={targetType.unit}
            unitAriaLabel={targetType.unit}
            noMargin
            className='min-w-0 flex-1'
          >
            <input
              id={fieldId}
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
          </InputGroupField>
          <button
            type='button'
            className={`join-item btn btn-outline text-error`}
            aria-label='Remove target'
            onClick={() => onRemove()}
          >
            <FontAwesomeIcon icon={faTrashCan} />
          </button>
        </div>
      </div>
    </>
  );
}
