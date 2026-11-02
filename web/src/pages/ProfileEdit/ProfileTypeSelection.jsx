import Card from '../../components/Card.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDiagramNext } from '@fortawesome/free-solid-svg-icons/faDiagramNext';
import { faChartSimple } from '@fortawesome/free-solid-svg-icons/faChartSimple';
import { Trans, useLingui } from '@lingui/react/macro';

export function ProfileTypeSelection({ onSelect }) {
  const { t } = useLingui();
  return (
    <div className='grid grid-cols-1 gap-4 lg:grid-cols-10'>
      <Card sm={10} lg={5} title={t`Simple Profile`}>
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
          aria-label={t`Select simple profile type`}
        >
          <FontAwesomeIcon icon={faDiagramNext} className='text-5xl' />
          <span className='text-lg font-medium'>
            <Trans>Simple profile</Trans>
          </span>
          <span className='text-base-content/70 text-center text-sm'>
            <Trans>Supports creating of profiles with different brew phases and targets.</Trans>
          </span>
        </div>
      </Card>

      <Card sm={10} lg={5} title={t`Pro Profile`}>
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
          aria-label={t`Select Pro profile type`}
        >
          <FontAwesomeIcon icon={faChartSimple} className='text-5xl' />
          <span className='text-lg'>
            <Trans>Pro profile</Trans>
          </span>
          <span className='text-base-content/60 text-center text-sm'>
            <Trans>
              Supports advanced pressure and flow controlled phases with ramps, different targets
              and further visualization.
            </Trans>
          </span>
        </div>
      </Card>
    </div>
  );
}
