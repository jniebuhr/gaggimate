import Card from '../../components/Card.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArchive } from '@fortawesome/free-solid-svg-icons/faArchive';
import { faLeaf } from '@fortawesome/free-solid-svg-icons/faLeaf';
import { faPen } from '@fortawesome/free-solid-svg-icons/faPen';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons/faTrashCan';
import { faX } from '@fortawesome/free-solid-svg-icons/faX';
import { faCheck } from '@fortawesome/free-solid-svg-icons/faCheck';

export function BeanManagerCard({
  beans,
  draft,
  editing,
  onDraftChange,
  onSubmit,
  onEdit,
  onDelete,
  onArchiveToggle,
  onCancel,
  busy,
}) {
  return (
    <div className='flex flex-col gap-5'>
      {/* Bean form */}
      <div className='nd-card p-4'>
        <div className='mb-4 font-nd-mono text-[13px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'>
          {editing ? 'Edit Bean' : 'Add New Bean'}
        </div>
        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='flex flex-col gap-2'>
            <label className='font-nd-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'>
              Coffee Name
            </label>
            <input
              type='text'
              value={draft.name}
              onInput={e => onDraftChange('name', e.target.value)}
              className='nd-input'
              placeholder='Colombia Pink Bourbon'
            />
          </div>
          <div className='flex flex-col gap-2'>
            <label className='font-nd-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'>
              Roaster
            </label>
            <input
              type='text'
              value={draft.roaster}
              onInput={e => onDraftChange('roaster', e.target.value)}
              className='nd-input'
              placeholder='Dak, Sey, Onyx...'
            />
          </div>
          <div className='flex flex-col gap-2'>
            <label className='font-nd-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'>
              Roast Level
            </label>
            <input
              type='text'
              value={draft.roastLevel}
              onInput={e => onDraftChange('roastLevel', e.target.value)}
              className='nd-input'
              placeholder='Light, Medium...'
            />
          </div>
          <div className='flex flex-col gap-2'>
            <label className='font-nd-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'>
              Roast Date
            </label>
            <input
              type='date'
              value={draft.roastDate || ''}
              onInput={e => onDraftChange('roastDate', e.target.value)}
              className='nd-input'
            />
          </div>
          <div className='flex flex-col gap-2'>
            <label className='font-nd-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'>
              Origin
            </label>
            <input
              type='text'
              value={draft.origin || ''}
              onInput={e => onDraftChange('origin', e.target.value)}
              className='nd-input'
              placeholder='Colombia, Ethiopia, Brazil...'
            />
          </div>
          <div className='flex flex-col gap-2'>
            <label className='font-nd-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'>
              Process
            </label>
            <input
              type='text'
              value={draft.process || ''}
              onInput={e => onDraftChange('process', e.target.value)}
              className='nd-input'
              placeholder='Washed, Natural, Honey...'
            />
          </div>
          <div className='flex flex-col gap-2'>
            <label className='font-nd-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'>
              Quantity (g)
            </label>
            <input
              type='number'
              min='0'
              step='0.1'
              value={draft.quantity ?? ''}
              onInput={e => onDraftChange('quantity', e.target.value)}
              className='nd-input'
              placeholder='250'
            />
          </div>
          <div className='flex flex-col gap-2 sm:col-span-2'>
            <label className='font-nd-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'>
              Notes
            </label>
            <textarea
              value={draft.notes}
              onInput={e => onDraftChange('notes', e.target.value)}
              className='nd-input'
              style={{ minHeight: '80px', resize: 'vertical' }}
              placeholder='Tasting notes, brew notes, reminders...'
            />
          </div>
        </div>

        <div className='mt-4 flex items-center justify-between gap-4'>
          <p className='font-nd-mono text-[13px] text-[var(--text-disabled,#666)]'>
            Save beans here so profile selection can ask which coffee you are using.
          </p>
          <div className='flex gap-2'>
            {editing && (
              <button type='button' onClick={onCancel} className='nd-action-btn nd-action-btn--text'>
                <FontAwesomeIcon icon={faX} />
                Cancel
              </button>
            )}
            <button
              type='button'
              onClick={onSubmit}
              className='nd-action-btn nd-action-btn--primary nd-action-btn--text'
              disabled={busy}
            >
              <FontAwesomeIcon icon={faCheck} />
              {editing ? 'Update Bean' : 'Save Bean'}
            </button>
          </div>
        </div>
      </div>

      {/* Bean list */}
      <div className='flex flex-col gap-3'>
        {beans.length === 0 ? (
          <div className='nd-card p-6 text-center'>
            <div className='mb-3 text-4xl text-[var(--text-disabled,#666)]'>
              <FontAwesomeIcon icon={faLeaf} />
            </div>
            <div className='font-nd-mono text-[14px] text-[var(--text-primary,#e8e8e8)]'>
              No beans saved yet
            </div>
            <div className='font-nd-mono text-[13px] text-[var(--text-disabled,#666)] mt-1'>
              Add your first bean above
            </div>
          </div>
        ) : (
          beans.map(bean => (
            <div key={bean.id} className='nd-card p-4'>
              <div className='flex items-start justify-between gap-4'>
                <div className='flex items-start gap-3'>
                  <div className='flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--home-surface-muted,rgba(5,5,5,0.95))] text-[var(--text-secondary,#999)]'>
                    <FontAwesomeIcon icon={faLeaf} />
                  </div>
                  <div>
                    <div className='font-nd-mono text-[14px] text-[var(--text-primary,#e8e8e8)]'>
                      {bean.name}
                    </div>
                    <div className='font-nd-mono text-[13px] text-[var(--text-disabled,#666)] mt-1'>
                      {[bean.roaster, bean.roastLevel].filter(Boolean).join(' • ') || 'Bean details'}
                    </div>
                    <div className='mt-2 flex flex-wrap gap-2'>
                      {bean.roastDate && (
                        <span className='font-nd-mono text-[11px] text-[var(--text-disabled,#666)]'>
                          Roast {bean.roastDate}
                        </span>
                      )}
                      {bean.origin && (
                        <span className='font-nd-mono text-[11px] text-[var(--text-disabled,#666)]'>
                          {bean.origin}
                        </span>
                      )}
                      {bean.process && (
                        <span className='font-nd-mono text-[11px] text-[var(--text-disabled,#666)]'>
                          {bean.process}
                        </span>
                      )}
                      {bean.quantity !== null && bean.quantity !== undefined && bean.quantity !== '' && (
                        <span className='font-nd-mono text-[11px] text-[var(--color-warning,#d4a843)]'>
                          {bean.quantity}g left
                        </span>
                      )}
                      {bean.archived && (
                        <span className='font-nd-mono text-[11px] text-[var(--color-warning,#d4a843)]'>
                          Archived
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className='flex items-center gap-2'>
                  <button
                    type='button'
                    onClick={() => onArchiveToggle(bean)}
                    className='nd-action-btn'
                    style={{ width: '36px', height: '36px' }}
                    title={bean.archived ? 'Restore bean' : 'Archive bean'}
                    disabled={busy}
                  >
                    <FontAwesomeIcon icon={faArchive} />
                  </button>
                  <button
                    type='button'
                    onClick={() => onEdit(bean)}
                    className='nd-action-btn'
                    style={{ width: '36px', height: '36px' }}
                    disabled={busy}
                  >
                    <FontAwesomeIcon icon={faPen} />
                  </button>
                  <button
                    type='button'
                    onClick={() => onDelete(bean.id)}
                    className='nd-action-btn'
                    style={{ width: '36px', height: '36px' }}
                    disabled={busy}
                  >
                    <FontAwesomeIcon icon={faTrashCan} />
                  </button>
                </div>
              </div>
              {bean.notes && (
                <p className='mt-3 font-nd-mono text-[13px] text-[var(--text-disabled,#666)] border-t border-[var(--home-border,#222)] pt-3'>
                  {bean.notes}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
