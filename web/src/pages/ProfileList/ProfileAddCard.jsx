import Card from '../../components/Card.jsx';

export function ProfileAddCard() {
  return (
    <Card sm={12} role="listitem">
      <a 
        href="/profiles/new"
        className="flex flex-col gap-2 items-center justify-center p-4 cursor-pointer text-base-content hover:text-primary transition-colors"
        aria-label="Create new profile"
        role="button"
        tabIndex={0}
      >
        <i className="fa fa-plus text-4xl" aria-hidden="true" />
        <span className="text-base font-medium">Add new profile</span>
      </a>
    </Card>
  );
}
