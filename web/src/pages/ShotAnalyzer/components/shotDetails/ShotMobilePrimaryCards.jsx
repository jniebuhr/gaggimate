import { ShotMainInfoCard } from './ShotMainInfoCard';
import { ShotRatioCard, useRatioCardState } from './ShotRatioCard';

export function ShotMobilePrimaryCards({ entry, index = 0 }) {
  const {
    loading,
    notes,
    isEditingRatio,
    sliderRatio,
    sliderTouched,
    updateAndSave,
    handleRatioCommit,
    setIsEditingRatio,
    setSliderRatio,
    setSliderTouched,
  } = useRatioCardState({
    currentShot: entry?.shot,
    entryKey: entry?.key || entry?.shot?.id || entry?.shotName || index,
  });

  return (
    <div className='shot-mobile-primary-cards flex flex-col lg:hidden'>
      <ShotMainInfoCard
        entry={entry}
        notes={notes}
        loading={loading}
        onRatingChange={value => updateAndSave('rating', value)}
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
        className='sm:hidden'
      />
    </div>
  );
}
