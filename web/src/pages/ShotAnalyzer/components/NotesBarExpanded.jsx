/**
 * NotesBarExpanded.jsx
 * Expandable panel below NotesBar.
 * View mode: shows notes text, balance/taste, and an edit button.
 */

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEdit } from '@fortawesome/free-solid-svg-icons/faEdit';
import { faSave } from '@fortawesome/free-solid-svg-icons/faSave';
import { faTimes } from '@fortawesome/free-solid-svg-icons/faTimes';
import { faCircleNotch } from '@fortawesome/free-solid-svg-icons/faCircleNotch';

const tasteOptions = [
  { value: 'bitter', label: 'Bitter', color: 'border-orange-500 text-orange-500' },
  { value: 'balanced', label: 'Balanced', color: 'border-green-500 text-green-500' },
  { value: 'sour', label: 'Sour', color: 'border-yellow-500 text-yellow-500' },
];

export function NotesBarExpanded({
  currentShot,
  notes,
  isEditing,
  saving,
  onInputChange,
  onEdit,
  onSave,
  onCancel,
  onCollapse,
  isExpanded = false,
}) {
  const borderClasses = 'border-base-content/5 border-t';

  const labelCls = 'text-base-content/50 text-[10px] font-semibold uppercase tracking-wider';
  const inputCls = 'input input-sm border-base-content/20 bg-base-100 w-full text-sm';

  // Render stars (editable in edit mode)
  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <button
          key={i}
          type='button'
          disabled={!isEditing}
          onClick={() => isEditing && onInputChange('rating', i)}
          className={`text-xl ${i <= notes.rating ? 'text-yellow-400' : 'text-base-content/20'} ${
            isEditing ? 'cursor-pointer hover:text-yellow-300' : 'cursor-default'
          }`}
        >
          ★
        </button>,
      );
    }
    return <div className='flex gap-0.5'>{stars}</div>;
  };

  return (
    <div
      className={`transition-all duration-200 ${borderClasses}`}
    >
      <div className='px-4 py-3'>
        {isEditing ? (
          /* ── EDIT MODE: Vertical layout ── */
          <div className='space-y-4'>
            {/* Row 1: Rating + Balance/Taste */}
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <div className={`${labelCls} mb-1.5`}>Rating</div>
                {renderStars()}
              </div>
              <div>
                <div className={`${labelCls} mb-1.5`}>Balance / Taste</div>
                <div className='flex gap-1'>
                  {tasteOptions.map(opt => (
                    <button
                      key={opt.value}
                      type='button'
                      onClick={() => onInputChange('balanceTaste', opt.value)}
                      className={`flex-1 rounded-md border-2 px-2 py-1.5 text-xs font-medium transition-all ${
                        notes.balanceTaste === opt.value
                          ? `${opt.color} bg-base-100`
                          : 'border-base-content/10 text-base-content/40 hover:border-base-content/30'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 2: Dose In, Dose Out, Ratio */}
            <div className='grid grid-cols-3 gap-3'>
              <div>
                <div className={`${labelCls} mb-1`}>Dose In (g)</div>
                <input
                  type='number'
                  step='0.1'
                  className={inputCls}
                  value={notes.doseIn}
                  onChange={e => onInputChange('doseIn', e.target.value)}
                  placeholder='18.0'
                />
              </div>
              <div>
                <div className={`${labelCls} mb-1`}>Dose Out (g)</div>
                <input
                  type='number'
                  step='0.1'
                  className={inputCls}
                  value={notes.doseOut}
                  onChange={e => onInputChange('doseOut', e.target.value)}
                  placeholder='36.0'
                />
              </div>
              <div>
                <div className={`${labelCls} mb-1`}>Ratio</div>
                <div className='input input-sm bg-base-200/50 border-base-content/10 w-full text-sm'>
                  {notes.ratio ? `1:${notes.ratio}` : '—'}
                </div>
              </div>
            </div>

            {/* Row 3: Bean Type, Grind Setting */}
            <div className='grid grid-cols-2 gap-3'>
              <div>
                <div className={`${labelCls} mb-1`}>Bean Type</div>
                <input
                  type='text'
                  className={inputCls}
                  value={notes.beanType}
                  onChange={e => onInputChange('beanType', e.target.value)}
                  placeholder='e.g., Single Origin, Blend'
                />
              </div>
              <div>
                <div className={`${labelCls} mb-1`}>Grind Setting</div>
                <input
                  type='text'
                  className={inputCls}
                  value={notes.grindSetting}
                  onChange={e => onInputChange('grindSetting', e.target.value)}
                  placeholder='e.g., Eureka Zero 11.1'
                />
              </div>
            </div>

            {/* Row 4: Notes Textarea */}
            <div>
              <div className='mb-1 flex items-center justify-between'>
                <div className={labelCls}>Notes</div>
                <span className='text-base-content/40 text-xs'>
                  {(notes.notes || '').length}/200
                </span>
              </div>
              <textarea
                className='textarea textarea-bordered textarea-sm w-full text-sm'
                rows='3'
                value={notes.notes}
                maxLength={200}
                onChange={e => onInputChange('notes', e.target.value)}
                placeholder='Tasting notes, brewing observations...'
              />
            </div>

            {/* Action Buttons */}
            <div className='flex justify-end gap-2 pt-1'>
              <button className='btn btn-sm btn-ghost' onClick={onCancel} disabled={saving}>
                <FontAwesomeIcon icon={faTimes} className='mr-1' />
                Cancel
              </button>
              <button
                className='btn btn-sm btn-primary'
                onClick={onSave}
                disabled={saving || currentShot?.source === 'temp'}
                title={
                  currentShot?.source === 'temp'
                    ? 'Not available for temporary shots'
                    : 'Save notes'
                }
              >
                {saving ? (
                  <FontAwesomeIcon icon={faCircleNotch} spin className='mr-1' />
                ) : (
                  <FontAwesomeIcon icon={faSave} className='mr-1' />
                )}
                Save
              </button>
            </div>
          </div>
        ) : (
          /* ── VIEW MODE: Notes text + edit button ── */
          <div className='flex items-start gap-3'>
            <div
              className='bg-base-200/50 min-h-[2rem] min-w-0 flex-1 cursor-pointer rounded-md px-3 py-2 text-xs hover:bg-base-200/80'
              onClick={onCollapse}
              title='Click to collapse'
            >
              {notes.notes || 'No notes added'}
            </div>
            <button
              className='btn btn-sm btn-outline flex-shrink-0'
              onClick={onEdit}
              title='Edit notes'
            >
              <FontAwesomeIcon icon={faEdit} className='mr-1' />
              Edit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
