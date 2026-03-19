/**
 * Shared hover styling for Shot Analyzer controls.
 * Keeping the interaction shell centralized helps the table, chart, library,
 * and notes controls feel like one system instead of drifting apart over time.
 */

const joinClasses = (...classes) => classes.filter(Boolean).join(' ');

const baseInteractiveClasses =
  'transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-30';
const hoverShellClasses = 'hover:bg-base-content/5';

export const ANALYZER_COMPACT_CONTROL_HEIGHT_CLASS = 'h-5 min-h-0';
export const ANALYZER_COMPACT_ICON_BUTTON_CLASS = `${ANALYZER_COMPACT_CONTROL_HEIGHT_CLASS} w-6`;
export const ANALYZER_COMPACT_GROUP_CLASSES = 'flex items-center gap-px';
export const ANALYZER_COMPACT_SEGMENTED_GROUP_CLASSES =
  'flex items-center divide-x divide-base-content/10';

const iconToneClasses = {
  neutral: 'text-base-content/55 hover:text-primary',
  subtle: 'text-base-content/35 hover:text-primary',
  success: 'text-base-content/35 hover:text-success',
  error: 'text-base-content/35 hover:text-error',
};

const textToneClasses = {
  neutral: 'text-base-content/70 hover:text-primary',
  success: 'text-base-content/55 hover:text-success',
  error: 'text-base-content/55 hover:text-error',
};

export const joinAnalyzerClasses = (...classes) => joinClasses(...classes);

export function getAnalyzerIconButtonClasses({ tone = 'neutral', className = '' } = {}) {
  return joinClasses(
    'inline-flex items-center justify-center rounded-md',
    baseInteractiveClasses,
    hoverShellClasses,
    iconToneClasses[tone] || iconToneClasses.neutral,
    className,
  );
}

export function getAnalyzerTextButtonClasses({ tone = 'neutral', className = '' } = {}) {
  return joinClasses(
    'inline-flex items-center rounded-md',
    baseInteractiveClasses,
    hoverShellClasses,
    textToneClasses[tone] || textToneClasses.neutral,
    className,
  );
}

export function getAnalyzerSurfaceTriggerClasses({ tone = 'neutral', className = '' } = {}) {
  return joinClasses(
    'rounded-md transition-colors duration-150',
    hoverShellClasses,
    textToneClasses[tone] || textToneClasses.neutral,
    className,
  );
}
