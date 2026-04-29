import Card from '../../components/Card.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';

export function ProfileAddCard() {
  return (
    <Card sm={12} role='listitem'>
      <a
        href='/profiles/new'
        className='nd-card flex cursor-pointer flex-col items-center justify-center gap-3 p-6 transition-colors'
        style={{ borderStyle: 'dashed' }}
      >
        <div className='text-3xl text-[var(--text-disabled,#666)]'>
          <FontAwesomeIcon icon={faPlus} />
        </div>
        <span className='font-nd-mono text-[14px] text-[var(--text-secondary,#999)] uppercase tracking-[0.08em]'>
          Add new profile
        </span>
      </a>
    </Card>
  );
}
