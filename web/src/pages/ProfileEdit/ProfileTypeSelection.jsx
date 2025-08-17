import Card from '../../components/Card.jsx';

export function ProfileTypeSelection({ onSelect }) {
  return (
    <div className='grid grid-cols-1 gap-4 lg:grid-cols-10'>
      <Card sm={10} lg={5} title='Simple Profile'>
        <div
          className='text-base-content hover:text-primary flex cursor-pointer flex-col items-center justify-center gap-2 p-4 transition-colors'
          onClick={() => onSelect('standard')}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect('standard');
            }
          }}
          role='button'
          tabIndex={0}
          aria-label='Select simple profile type'
        >
          <i className='fa fa-diagram-next text-5xl' aria-hidden='true' />
          <span className='text-lg font-medium'>Simple profile</span>
          <span className='text-base-content/70 text-center text-sm'>
            Supports creating of profiles with different brew phases and targets.
          </span>
        </div>
      </Card>

      <Card sm={10} lg={5} title='Pro Profile'>
        <div
          className='text-base-content hover:text-primary flex cursor-pointer flex-col items-center justify-center gap-2 p-4 transition-colors'
          onClick={() => onSelect('pro')}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect('pro');
            }
          }}
          role='button'
          tabIndex={1}
          aria-label='Select Pro profile type'
        >
          <i className='fa fa-chart-simple text-5xl' aria-hidden='true' />
          <span className='text-lg'>Pro profile</span>
          <span className='text-base-content/60 text-center text-sm'>
            Supports advanced pressure and flow controlled phases with ramps, different targets and
            further visualization.
          </span>
        </div>
      </Card>
    </div>
  );
}
