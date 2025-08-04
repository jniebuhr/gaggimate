import Card from '../../components/Card.jsx';

export function ProfileTypeSelection({ onSelect }) {
  return (
    <>
      <Card sm={6}>
        <div className="tooltip tooltip-top" data-tip="Create a simple profile with basic brew phases">
          <div
            className="flex flex-col gap-3 items-center justify-center p-6 cursor-pointer text-base-content hover:text-primary hover:bg-base-content/5 transition-colors"
            onClick={() => onSelect('standard')}
          >
            <i className="fa fa-diagram-next text-5xl" />
            <span className="text-lg font-medium">Simple profile</span>
            <span className="text-sm text-center text-base-content/70">
              Supports creating of profiles with different brew phases and targets.
            </span>
          </div>
        </div>
      </Card>

      <Card sm={6}>
        <div className="tooltip tooltip-top" data-tip="Advanced profiles coming soon">
          <div className="flex flex-col gap-3 items-center justify-center p-6 text-base-content/40 cursor-not-allowed">
            <span className="text-sm text-base-content/60 font-bold">Coming soon</span>
            <i className="fa fa-chart-simple text-5xl" />
            <span className="text-lg">Pro profile</span>
            <span className="text-sm text-center text-base-content/60">
              Supports advanced pressure and flow controlled phases with ramps, different targets and further visualization.
            </span>
          </div>
        </div>
      </Card>
    </>
  );
}
