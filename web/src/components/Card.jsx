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
      <div
        className={`overflow-hidden rounded-xl border border-slate-200 bg-white dark:bg-gray-800 dark:border-gray-600 ${spanClass}`}
      >
        {props.title && (
          <div className="px-6 pt-6">
            <h2 className="text-lg font-bold">{props.title}</h2>
          </div>
        )}

        <div className="lg:p-6 p-2 flex flex-col gap-2">{props.children}</div>
      </div>
    </>
  );
}
