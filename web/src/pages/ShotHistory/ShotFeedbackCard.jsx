import { useMemo } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowDown } from '@fortawesome/free-solid-svg-icons/faArrowDown';
import { faArrowUp } from '@fortawesome/free-solid-svg-icons/faArrowUp';
import { faCircleCheck } from '@fortawesome/free-solid-svg-icons/faCircleCheck';
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons/faCircleInfo';
import { faLeaf } from '@fortawesome/free-solid-svg-icons/faLeaf';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons/faTriangleExclamation';
import { faMugHot } from '@fortawesome/free-solid-svg-icons/faMugHot';
import { analyzeShotFeedback } from './shotFeedback.js';

const COLOR_CLASSES = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  error: 'bg-error/10 text-error',
  info: 'bg-info/10 text-info',
};

const VERDICT_ICON = {
  finer: faArrowDown,
  coarser: faArrowUp,
  good: faCircleCheck,
  under: faArrowDown,
  over: faArrowUp,
  'on-track': faCircleCheck,
  light: faCircleInfo,
  heavy: faCircleInfo,
  balanced: faCircleCheck,
  concentrated: faArrowDown,
  very_concentrated: faArrowDown,
  diluted: faArrowUp,
  very_diluted: faArrowUp,
};

function FeedbackBlock({ item, label }) {
  if (!item) return null;
  const colorClass = COLOR_CLASSES[item.color] || 'bg-base-200 text-base-content';
  const icon = VERDICT_ICON[item.verdict] || faCircleInfo;
  return (
    <div className={`rounded-xl p-3 ${colorClass}`}>
      <div className='mb-1 flex items-center gap-2'>
        <FontAwesomeIcon icon={icon} className='h-3.5 w-3.5 shrink-0' />
        <span className='text-xs font-semibold uppercase tracking-wide opacity-70'>{label}</span>
      </div>
      <p className='font-semibold leading-tight'>{item.label}</p>
      <p className='mt-1 text-xs opacity-80'>{item.message}</p>
    </div>
  );
}

export default function ShotFeedbackCard({ shot, notes, showRoastTips }) {
  const feedback = useMemo(() => analyzeShotFeedback(shot, notes), [shot, notes]);

  if (!feedback.canAnalyze) return null;

  const roastLabel =
    feedback.roastType
      ? feedback.roastType.charAt(0).toUpperCase() + feedback.roastType.slice(1)
      : null;

  return (
    <div className='border-base-content/10 mt-6 border-t-2 pt-6'>
      <div className='mb-4 flex items-center justify-between'>
        <h3 className='text-lg font-semibold'>Shot Feedback</h3>
        {feedback.missingData.length > 0 && (
          <span className='text-base-content/40 text-xs'>
            Add {feedback.missingData.join(' & ')} for full analysis
          </span>
        )}
      </div>

      {/* Main feedback grid */}
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
        <FeedbackBlock item={feedback.grind} label='Grind' />
        <FeedbackBlock item={feedback.extraction} label='Extraction' />
        {feedback.strength
          ? <FeedbackBlock item={feedback.strength} label='Strength' />
          : (
            <div className='bg-base-200 text-base-content/40 rounded-xl p-3'>
              <p className='text-xs font-semibold uppercase tracking-wide'>Strength</p>
              <p className='mt-1 text-sm'>Enter dose in &amp; out for strength analysis</p>
            </div>
          )
        }
      </div>

      {/* Roast tip */}
      {showRoastTips && feedback.roastTip && (
        <div className='bg-success/10 text-success mt-3 flex items-start gap-3 rounded-xl p-3'>
          <FontAwesomeIcon icon={faLeaf} className='mt-0.5 h-4 w-4 shrink-0' />
          <div>
            <p className='text-xs font-semibold uppercase tracking-wide opacity-70'>
              {roastLabel} Roast Tip
            </p>
            <p className='mt-1 text-sm'>{feedback.roastTip}</p>
          </div>
        </div>
      )}

      {/* Advanced hints */}
      {feedback.advancedHints.length > 0 && (
        <div className='bg-warning/10 mt-3 rounded-xl p-3'>
          <div className='mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide opacity-70'>
            <FontAwesomeIcon icon={faTriangleExclamation} className='h-3.5 w-3.5' />
            Hints
          </div>
          <ul className='space-y-1'>
            {feedback.advancedHints.map((hint, i) => (
              <li key={i} className='text-sm'>• {hint.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Closing line */}
      <div className='text-base-content/40 mt-4 flex items-center gap-2 text-xs italic'>
        <FontAwesomeIcon icon={faMugHot} className='h-3.5 w-3.5' />
        <span>Ultimately, it&rsquo;s down to taste — enjoy ☕️</span>
      </div>
    </div>
  );
}
