import Card from '../../components/Card.jsx';

export function ProfileAddCard() {
  return (
    <Card sm={12} role='listitem'>
      <a
        href='/profiles/new'
        className='text-base-content hover:text-primary flex cursor-pointer flex-col items-center justify-center gap-2 p-4 transition-colors'
      >
        <i className='fa fa-plus text-4xl' aria-hidden='true' />
        <span className='text-base font-medium'>Add new profile</span>
      </a>
    </Card>
  );
}
