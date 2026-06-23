import { useRef, useState } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons/faChevronDown';
import { faChevronUp } from '@fortawesome/free-solid-svg-icons/faChevronUp';
import { faLock } from '@fortawesome/free-solid-svg-icons/faLock';
import { faXmark } from '@fortawesome/free-solid-svg-icons/faXmark';

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

export function SortableConfigurator({ order, definitions, hidden, onOrderChange, emptyMessage, extraControls }) {
  const orderRef = useRef(order);
  orderRef.current = order;

  const draggingIdRef = useRef(null);
  const draggingSourceRef = useRef(null);
  const [draggingId, setDraggingId] = useState(null);
  const [draggingSource, setDraggingSource] = useState(null);
  const dragOverInfoRef = useRef(null);
  const [dragOverInfo, setDragOverInfo] = useState(null);

  const updateDragOver = info => {
    dragOverInfoRef.current = info;
    setDragOverInfo(info);
  };

  const startDrag = (e, id, source) => {
    draggingIdRef.current = id;
    draggingSourceRef.current = source;
    setDraggingId(id);
    setDraggingSource(source);
    e.dataTransfer.effectAllowed = 'move';
  };

  const endDrag = () => {
    draggingIdRef.current = null;
    draggingSourceRef.current = null;
    setDraggingId(null);
    setDraggingSource(null);
    updateDragOver(null);
  };

  const move = (id, dir) => {
    const idx = order.indexOf(id);
    if (idx === -1) return;
    const next = [...order];
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= next.length) return;
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    onOrderChange(next);
  };

  const remove = id => {
    const def = definitions.find(d => d.id === id);
    if (def?.required) return;
    onOrderChange(order.filter(oid => oid !== id));
  };

  const add = id => {
    if (order.includes(id)) return;
    onOrderChange([...order, id]);
  };

  return (
    <div className='grid grid-cols-2 gap-3'>
      <div>
        <div className='mb-2 text-xs font-semibold uppercase tracking-wider opacity-50'>Visible</div>
        <div
          className={`flex flex-col gap-1 rounded-lg transition-all duration-200${draggingSource === 'available' ? ' bg-primary/5 ring-1 ring-primary/40' : ''}`}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault();
            const srcId = draggingIdRef.current;
            const src = draggingSourceRef.current;
            if (!srcId || src !== 'available') return;
            const cur = orderRef.current;
            if (!cur.includes(srcId)) onOrderChange([...cur, srcId]);
          }}
        >
          {order.map((id, idx) => {
            const def = definitions.find(d => d.id === id);
            if (!def) return null;
            const isDragging = draggingId === id;
            const overPos = dragOverInfo?.id === id && !isDragging ? dragOverInfo.pos : null;
            return (
              <div
                key={id}
                draggable
                onDragStart={e => startDrag(e, id, 'visible')}
                onDragOver={e => {
                  e.preventDefault();
                  const r = e.currentTarget.getBoundingClientRect();
                  const pos = e.clientY < r.top + r.height / 2 ? 'before' : 'after';
                  if (dragOverInfoRef.current?.id !== id || dragOverInfoRef.current?.pos !== pos) {
                    updateDragOver({ id, pos });
                  }
                }}
                onDragLeave={e => {
                  if (!e.currentTarget.contains(e.relatedTarget)) updateDragOver(null);
                }}
                onDrop={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  const info = dragOverInfoRef.current;
                  updateDragOver(null);
                  const srcId = draggingIdRef.current;
                  const src = draggingSourceRef.current;
                  if (!srcId || !info) return;
                  const cur = orderRef.current;
                  if (src !== 'visible' && cur.includes(srcId)) return;
                  const next = src === 'visible' ? cur.filter(x => x !== srcId) : [...cur];
                  const targetIdx = next.indexOf(info.id);
                  if (targetIdx === -1) return;
                  next.splice(info.pos === 'before' ? targetIdx : targetIdx + 1, 0, srcId);
                  onOrderChange(next);
                }}
                onDragEnd={endDrag}
                className={[
                  'flex min-h-14 items-center gap-2 rounded-lg border border-base-content/10 bg-base-100 px-2 py-1.5 transition-all duration-100',
                  overPos === 'before' && 'border-t-2 border-t-primary',
                  overPos === 'after' && 'border-b-2 border-b-primary',
                  isDragging && 'opacity-40',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className='cursor-grab select-none text-base-content/20'>⠿</span>
                <span className='flex-1 text-sm'>{def.label}</span>
                {extraControls?.(def)}
                <div className='flex flex-col gap-px'>
                  <button
                    type='button'
                    disabled={idx === 0}
                    onClick={() => move(id, 'up')}
                    className='btn btn-ghost btn-xs flex h-5 w-5 items-center justify-center rounded p-0'
                  >
                    <FontAwesomeIcon icon={faChevronUp} className='h-2.5 w-2.5' />
                  </button>
                  <button
                    type='button'
                    disabled={idx === order.length - 1}
                    onClick={() => move(id, 'down')}
                    className='btn btn-ghost btn-xs flex h-5 w-5 items-center justify-center rounded p-0'
                  >
                    <FontAwesomeIcon icon={faChevronDown} className='h-2.5 w-2.5' />
                  </button>
                </div>
                {def.required ? (
                  <div className='flex h-6 w-6 items-center justify-center'>
                    <FontAwesomeIcon icon={faLock} className='h-3 w-3 text-base-content/20' />
                  </div>
                ) : (
                  <button
                    type='button'
                    onClick={() => remove(id)}
                    className='btn btn-ghost btn-xs flex h-6 w-6 items-center justify-center rounded p-0 text-error'
                  >
                    <FontAwesomeIcon icon={faXmark} className='h-3.5 w-3.5' />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className='mb-2 text-xs font-semibold uppercase tracking-wider opacity-50'>
          Hidden / Available
        </div>
        <div className='flex flex-col gap-1'>
          {hidden.map(def => (
            <div
              key={def.id}
              draggable
              onDragStart={e => startDrag(e, def.id, 'available')}
              onDragEnd={endDrag}
              className={`flex min-h-14 cursor-grab items-center gap-2 rounded-lg border border-base-content/10 bg-base-100 px-2 py-1.5 transition-all duration-150${draggingId === def.id ? ' opacity-40' : ''}`}
            >
              <span className='select-none text-base-content/20'>⠿</span>
              <span className='flex-1 text-sm'>{def.label}</span>
              <button
                type='button'
                onClick={() => add(def.id)}
                className='btn btn-ghost btn-xs border border-base-content/20 text-xs'
              >
                + Add
              </button>
            </div>
          ))}
          {hidden.length === 0 && <p className='text-xs opacity-40'>{emptyMessage}</p>}
        </div>
      </div>
    </div>
  );
}
