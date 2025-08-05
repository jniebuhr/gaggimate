import Card from '../../components/Card.jsx';

export function ProfileTypeSelection({ onSelect }) {
  return (
    <>
      <Card xs={12} md={6} title="Simple Profile">
        <div 
          className="flex flex-col gap-2 items-center justify-center p-4 cursor-pointer text-base-content hover:text-primary transition-colors"
          onClick={() => onSelect('standard')}
        >
          <i className="fa fa-diagram-next text-5xl" />
          <span className="text-lg font-medium">Simple profile</span>
          <span className="text-sm text-center text-base-content/70">
            Supports creating of profiles with different brew phases and targets.
          </span>
        </div>
      </Card>

      <Card xs={12} md={6} title="Pro Profile">
        <div className="flex flex-col gap-2 items-center justify-center p-4 text-base-content/40 cursor-not-allowed">
          <span className="text-sm text-base-content/60 font-bold">Coming soon</span>
          <i className="fa fa-chart-simple text-5xl" />
          <span className="text-lg">Pro profile</span>
          <span className="text-sm text-center text-base-content/60">
            Supports advanced pressure and flow controlled phases with ramps, different targets and further visualization.
          </span>
        </div>
      </Card>
    </>
  );
}
