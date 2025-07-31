import Card from '../../components/Card.jsx';

export function ProfileAddCard() {
  return (
    <Card sm={12}>
      <a
        href="/profiles/new"
        className="flex flex-col gap-3 items-center justify-center cursor-pointer text-base-content hover:text-primary hover:bg-base-content/5 transition-colors"
      >
        <i className="fa fa-plus text-4xl" />
        <span className="text-base font-medium">Add new</span>
      </a>
    </Card>
  );
}
