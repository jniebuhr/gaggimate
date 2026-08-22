// Constants for StatisticsToolbar: source/mode/date options and run button tone class
export const SOURCE_OPTIONS = [
  { value: 'gaggimate', label: 'GM' },
  { value: 'browser', label: 'WEB' },
  { value: 'both', label: 'ALL' },
];

export const MODE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'profile', label: 'By Profile' },
  { value: 'shots', label: 'By Shots' },
];

export const DATE_BASIS_OPTIONS = [
  { value: 'shot', label: 'Shot' },
  { value: 'auto', label: 'Auto' },
  { value: 'upload', label: 'Upload' },
];

export const STATISTICS_RUN_BUTTON_TONE_CLASS =
  'bg-success text-success-content hover:bg-success/92 hover:text-success-content';

export const STATISTICS_TOP_ROW_CONTROL_HEIGHT_CLASS =
  'btn btn-md h-10 min-h-10 border-none shadow-none';

export const SEGMENT_GROUP_CLASS =
  'inline-flex overflow-hidden rounded-lg bg-base-content/4 divide-x divide-base-content/10';

export const SEGMENT_BUTTON_BASE_CLASS =
  'flex h-11 min-h-0 items-center justify-center border-0 px-2 text-xs font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:px-2.5';

export const COMPACT_SEGMENT_BUTTON_BASE_CLASS =
  'flex h-9 min-h-0 items-center justify-center border-0 px-1.5 text-[11px] font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40';

export const WARNING_ORANGE_TEXT_STYLE = { color: 'var(--analyzer-warning-orange)' };

export const WARNING_ORANGE_TEXT_MUTED_STYLE = {
  color: 'color-mix(in srgb, var(--analyzer-warning-orange) 70%, var(--color-base-content) 30%)',
};

export const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
export const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;
