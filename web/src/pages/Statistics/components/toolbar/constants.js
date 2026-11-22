// Constants for StatisticsToolbar: mode/date options and run button tone class
import { msg } from '@lingui/core/macro';

export const MODE_OPTIONS = [
  { value: 'all', label: msg({ message: 'All', context: 'statistics mode' }) },
  { value: 'profile', label: msg`By Profile` },
  { value: 'shots', label: msg`By Shots` },
];

export const STATISTICS_RUN_BUTTON_TONE_CLASS =
  'bg-success text-success-content hover:bg-success/92 hover:text-success-content';

export const STATISTICS_TOP_ROW_CONTROL_HEIGHT_CLASS =
  'btn btn-md h-10 min-h-10 border-none shadow-none';

export const WARNING_ORANGE_TEXT_STYLE = { color: 'var(--analyzer-warning-orange)' };

export const WARNING_ORANGE_TEXT_MUTED_STYLE = {
  color: 'color-mix(in srgb, var(--analyzer-warning-orange) 70%, var(--color-base-content) 30%)',
};

export const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
export const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;
