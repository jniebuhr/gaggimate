import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGears } from '@fortawesome/free-solid-svg-icons/faGears';
import { faTag } from '@fortawesome/free-solid-svg-icons/faTag';
import { faPenToSquare } from '@fortawesome/free-solid-svg-icons/faPenToSquare';
import { faYinYang } from '@fortawesome/free-solid-svg-icons/faYinYang';
import { faWeightScale } from '@fortawesome/free-solid-svg-icons/faWeightScale';
import { CardTitle } from '../../../../components/CardTitle';
import { getNotesTasteStyle } from '../../utils/analyzerUtils';
import { ShotMainInfoCard } from './ShotMainInfoCard';
import { MetricValueGrid } from './ShotMetricCards';
import { ShotRatioCard, useRatioCardState } from './ShotRatioCard';

const tasteOptions = [
  { value: 'bitter', label: 'Bitter' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'sour', label: 'Sour' },
];

const fieldLabelClass =
  'text-base-content/55 mb-0.5 flex items-center gap-1.5 text-xs leading-tight font-medium';
const inputClass =
  'border-base-content/10 bg-base-100/80 text-base-content input input-xs min-h-8 w-full rounded-md text-xs lg:min-h-7 xl:min-h-8';
const textareaClass =
  'border-base-content/10 bg-base-100/80 text-base-content textarea textarea-bordered textarea-xs min-h-[5rem] w-full rounded-md !text-xs leading-relaxed lg:min-h-[4rem] xl:min-h-[5rem]';

function getSelectedTasteButtonStyle(taste) {
  const tasteStyle = getNotesTasteStyle(taste);
  if (!tasteStyle) return undefined;
  return {
    '--shot-details-taste-selected-bg': tasteStyle.selectedBackground,
  };
}

function DetailField({ icon, label, children, className = '', action = null }) {
  return (
    <div className={className}>
      <div className={`${fieldLabelClass} justify-between`}>
        <span className='flex min-w-0 items-center gap-1.5'>
          {icon ? <FontAwesomeIcon icon={icon} className='text-[0.7rem]' /> : null}
          {label}
        </span>
        {action}
      </div>
      {children}
    </div>
  );
}

export function ShotDetailsCard({ entry, isCompare }) {
  const {
    flushSave,
    handleFieldChange,
    handleRatioCommit,
    loading,
    notes,
    isEditingRatio,
    sliderRatio,
    sliderTouched,
    updateAndSave,
    setIsEditingRatio,
    setSliderRatio,
    setSliderTouched,
  } = useRatioCardState({
    currentShot: entry.shot,
    entryKey: entry.key,
  });
  const duplicateMobileSummaryClass = isCompare ? '' : 'hidden lg:flex';
  const duplicateMobileRatioClass = isCompare ? '' : 'hidden sm:flex';
  const duplicateMobileMetricsClass = isCompare ? 'hidden lg:block' : 'hidden sm:block';

  return (
    <section className='relative flex h-full flex-col gap-3'>
      <ShotMainInfoCard
        entry={entry}
        isCompare={isCompare}
        notes={notes}
        loading={loading}
        onRatingChange={value => updateAndSave('rating', value)}
        className={duplicateMobileSummaryClass || 'flex'}
      />

      <ShotRatioCard
        notes={notes}
        isEditingRatio={isEditingRatio}
        sliderRatio={sliderRatio}
        sliderTouched={sliderTouched}
        onSliderInput={value => {
          setSliderRatio(value);
          if (!sliderTouched) setSliderTouched(true);
        }}
        onSliderActivate={() => {
          if (!sliderTouched) setSliderTouched(true);
        }}
        onRatioCommit={handleRatioCommit}
        onEditRatio={() => {
          setSliderTouched(true);
          setIsEditingRatio(true);
        }}
        className={duplicateMobileRatioClass}
      />

      <div className={duplicateMobileMetricsClass}>
        <div className='app-card-surface min-w-0 flex-col rounded-xl p-3 lg:p-2.5 xl:p-3'>
          <CardTitle className='mb-3'>Shot Metrics</CardTitle>
          <MetricValueGrid
            total={entry.results?.total}
            excludeKeys={['duration', 'w', 'tt']}
            flat
          />
        </div>
      </div>

      <div className='app-card-surface flex flex-1 flex-col gap-3 rounded-xl p-3 lg:p-2.5 xl:p-3'>
        <CardTitle>Shot Notes</CardTitle>
        <div className='grid grid-cols-2 gap-3'>
          <DetailField icon={faWeightScale} label='Dose In'>
            <input
              type='number'
              step='0.1'
              className={inputClass}
              value={notes.doseIn || ''}
              onInput={event => handleFieldChange('doseIn', event.target.value)}
              onBlur={flushSave}
              placeholder='18.0'
            />
          </DetailField>
          <DetailField icon={faWeightScale} label='Dose Out'>
            <input
              type='number'
              step='0.1'
              className={inputClass}
              value={notes.doseOut || ''}
              onInput={event => handleFieldChange('doseOut', event.target.value)}
              onBlur={flushSave}
              placeholder='36.0'
            />
          </DetailField>
          <DetailField icon={faGears} label='Grind' className='col-span-2'>
            <input
              type='text'
              className={inputClass}
              value={notes.grindSetting || ''}
              onInput={event => handleFieldChange('grindSetting', event.target.value)}
              onBlur={flushSave}
              placeholder='2.5'
            />
          </DetailField>
          <DetailField icon={faTag} label='Beans' className='col-span-2'>
            <input
              type='text'
              className={inputClass}
              value={notes.beanType || ''}
              onInput={event => handleFieldChange('beanType', event.target.value)}
              onBlur={flushSave}
              placeholder='Single Origin, Blend...'
            />
          </DetailField>
          <DetailField icon={faYinYang} label='Balance / Taste' className='col-span-2'>
            <div className='bg-base-200/70 flex w-full min-w-0 rounded-full p-0.5'>
              {tasteOptions.map(option => (
                <button
                  key={option.value}
                  type='button'
                  className={`flex min-w-0 flex-1 cursor-pointer items-center justify-center rounded-full px-2 py-1 text-xs transition-all duration-200 ${
                    notes.balanceTaste === option.value
                      ? 'text-base-content bg-[var(--shot-details-taste-selected-bg)] font-medium'
                      : 'text-base-content/60 hover:text-base-content'
                  }`}
                  style={getSelectedTasteButtonStyle(option.value)}
                  onClick={() => updateAndSave('balanceTaste', option.value)}
                >
                  <span className='truncate'>{option.label}</span>
                </button>
              ))}
            </div>
          </DetailField>
        </div>
        <DetailField
          icon={faPenToSquare}
          label='Notes'
          className='flex min-h-0 flex-1 flex-col'
          action={
            <span className='text-base-content/45 text-xs'>{(notes.notes || '').length}/200</span>
          }
        >
          <textarea
            className={`${textareaClass} flex-1`}
            value={notes.notes || ''}
            maxLength={200}
            onInput={event => handleFieldChange('notes', event.target.value)}
            onBlur={flushSave}
            placeholder='Tasting notes, brewing observations...'
          />
        </DetailField>
      </div>
    </section>
  );
}
