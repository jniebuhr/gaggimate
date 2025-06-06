export function ProfileTypeSelection({ onSelect }) {
  return (
    <>
      <div
        className="relative rounded-lg border col-span-6 p-4 flex flex-col gap-2 items-center justify-center border-slate-200 bg-white cursor-pointer text-slate-900 dark:bg-gray-800 dark:border-gray-600 dark:text-indigo-100 hover:bg-indigo-100 hover:text-indigo-600 active:border-indigo-200"
        onClick={() => onSelect('standard')}
      >
        <span>&nbsp;</span>
        <i className="fa fa-diagram-next text-5xl my-4" />
        <span className="text-lg">Simple profile</span>
        <span className="text-sm text-center">
            Supports creating of profiles with different brew phases and targets.
          </span>
      </div>

      <div
        className="relative rounded-lg border col-span-6 flex flex-col gap-2 items-center justify-center border-slate-200 bg-white p-4 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:border-gray-600"
      >
        <span className="text-sm text-gray-600 font-bold">Coming soon</span>
        <i className="fa fa-chart-simple text-5xl my-4" />
        <span className="text-lg">Pro profile</span>
        <span className="text-sm text-center">
            Supports advanced pressure and flow controlled phases with ramps, different targets and further visualization.
        </span>
      </div>
    </>
  );
}
