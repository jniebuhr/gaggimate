import Card from '../../components/Card.jsx';

export function ProfileAddCard() {
  return (
    <Card sm={12}>
      <a 
        href="/profiles/new"
        className="flex flex-col gap-2 items-center justify-center p-4 cursor-pointer text-base-content hover:text-primary transition-colors"
      >
        <i className="fa fa-plus text-4xl" />
        <span className="text-base font-medium">Add new profile</span>
      </a>
    </Card>
  );
}
