export default function Card(props) {
  let spanClass = '';
  if (props.xs) {
    spanClass += ` col-span-${props.xs}`;
  }
  if (props.sm) {
    spanClass += ` sm:col-span-${props.sm}`;
  }
  if (props.md) {
    spanClass += ` md:col-span-${props.md}`;
  }
  if (props.lg) {
    spanClass += ` lg:col-span-${props.lg}`;
  }
  if (props.xl) {
    spanClass += ` xl:col-span-${props.xl}`;
  }
  return (
    <>
      <div className={`card bg-base-100 shadow-xl ${spanClass}`}>
        {props.title && (
          <div className="card-header px-6 pt-6">
            <h2 className="card-title">{props.title}</h2>
          </div>
        )}

        <div className="card-body lg:p-6 p-2 flex flex-col gap-2">{props.children}</div>
      </div>
    </>
  );
}
