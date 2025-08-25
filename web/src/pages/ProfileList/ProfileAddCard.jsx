import Card from '../../components/Card.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';

export function ProfileAddCard() {
  return (
    <Card sm={12} role='listitem'>
      <a
        href='/profiles/new'
        className='text-base-content hover:text-primary flex cursor-pointer flex-col items-center justify-center gap-2 p-4 transition-colors'
      >
        <FontAwesomeIcon icon={faPlus} className='text-4xl' />
        <span className='text-base font-medium'>Add new profile</span>
      </a>
    </Card>
  );
}
