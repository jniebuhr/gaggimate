import Card from '../../components/Card.jsx';

export function ProfileAddCard() {
  return (
    <li>
      <Card sm={12}>
        <button
          onClick={() => window.location.href = '/profiles/new'}
          className='text-base-content hover:text-primary flex cursor-pointer flex-col items-center justify-center gap-2 p-4 transition-colors w-full'
          aria-label='Create new profile'
        >
          <i className='fa fa-plus text-4xl' aria-hidden='true' />
          <span className='text-base font-medium'>Add new profile</span>
        </button>
      </Card>
    </li>
  );
}
