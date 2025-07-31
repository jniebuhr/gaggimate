export default function Card(props) {
  let spanClass = props.className || '';
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
          <div className="card-header px-4 sm:px-6 pt-4 sm:pt-6">
            <h2 className="card-title text-lg sm:text-xl">{props.title}</h2>
          </div>
        )}

        <div className="card-body p-2 sm:p-6 flex flex-col gap-2">{props.children}</div>
      </div>
    </>
  );
}
