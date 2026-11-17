import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Trans, useLingui } from '@lingui/react/macro';
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons/faChevronLeft';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons/faChevronRight';
import { faChartArea } from '@fortawesome/free-solid-svg-icons/faChartArea';
import { faChartSimple } from '@fortawesome/free-solid-svg-icons/faChartSimple';
import { faCircleNotch } from '@fortawesome/free-solid-svg-icons/faCircleNotch';
import { faEquals } from '@fortawesome/free-solid-svg-icons/faEquals';
import { faFileImport } from '@fortawesome/free-solid-svg-icons/faFileImport';

export function ActionBarNavigationButtons({
  navButtonClasses,
  canGoPrev,
  canGoNext,
  currentIndex,
  onNavigateToIndex,
}) {
  const { t } = useLingui();
  return (
    <div className='flex shrink-0 items-center gap-1'>
      <button
        type='button'
        className={navButtonClasses}
        disabled={!canGoPrev}
        onClick={() => canGoPrev && onNavigateToIndex(currentIndex - 1, -1)}
        title={t`Previous shot`}
      >
        <FontAwesomeIcon icon={faChevronLeft} />
      </button>

      <button
        type='button'
        className={navButtonClasses}
        disabled={!canGoNext}
        onClick={() => canGoNext && onNavigateToIndex(currentIndex + 1, 1)}
        title={t`Next shot`}
      >
        <FontAwesomeIcon icon={faChevronRight} />
      </button>
    </div>
  );
}

export function ActionBarCompareButton({
  actionButtonClasses,
  compareAvailable,
  compareMode,
  onCompareModeToggle,
}) {
  const { t } = useLingui();
  return (
    <button
      type='button'
      className={`${actionButtonClasses} ${compareMode ? 'text-primary opacity-100' : ''}`}
      disabled={!compareAvailable}
      onClick={event => {
        event.preventDefault();
        event.stopPropagation();
        onCompareModeToggle?.();
      }}
      title={compareMode ? t`Disable compare mode` : t`Enable compare mode`}
    >
      <FontAwesomeIcon icon={faEquals} className='text-sm' />
      <span>
        <Trans context='compare mode'>Compare</Trans>
      </span>
    </button>
  );
}

export function ActionBarStatisticsAction({
  actionButtonClasses,
  compareMode,
  statisticsAvailable,
  statsHref,
  onShowStats,
}) {
  const { t } = useLingui();
  const statisticsIcon = compareMode ? faChartArea : faChartSimple;
  const content = (
    <>
      <FontAwesomeIcon icon={statisticsIcon} className='text-sm' />
      <span>{compareMode ? <Trans>Multi-Compare</Trans> : <Trans>Profile Stats</Trans>}</span>
    </>
  );

  if (statisticsAvailable) {
    return (
      <a
        href={statsHref || '/statistics'}
        className={actionButtonClasses}
        onClick={event => {
          event.stopPropagation();
          onShowStats?.();
        }}
        title={t`Open statistics`}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type='button'
      className={actionButtonClasses}
      disabled
      title={t`Load a profile to open statistics`}
    >
      {content}
    </button>
  );
}

export function ActionBarImportActions({ actionButtonClasses, handleImportClick, isImporting }) {
  const { t } = useLingui();
  return (
    <div className='ml-auto flex shrink-0 items-center'>
      <button
        type='button'
        className={`${actionButtonClasses} max-sm:px-1`}
        onClick={handleImportClick}
        disabled={isImporting}
        title={t`Open shot or profile`}
        aria-label={isImporting ? t`Opening shot or profile` : t`Open shot or profile`}
      >
        <FontAwesomeIcon
          icon={isImporting ? faCircleNotch : faFileImport}
          spin={isImporting}
          className='text-sm'
        />
        <span className='hidden sm:inline'>
          <Trans>Open</Trans>
        </span>
      </button>
    </div>
  );
}
