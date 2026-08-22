// Pure helper functions for StatisticsToolbar: label formatting and source label construction
import {
  DATE_ONLY_PATTERN,
  DATE_TIME_PATTERN,
  SEGMENT_BUTTON_BASE_CLASS,
  COMPACT_SEGMENT_BUTTON_BASE_CLASS,
} from './constants';

export function getPrimaryDropdownToneClasses() {
  return 'bg-primary text-primary-content hover:bg-primary/92';
}

export function getNeutralDropdownToneClasses() {
  return 'bg-transparent text-base-content/70 hover:text-base-content';
}

export function getMenuItemClasses({ tone = 'neutral', isActive = false } = {}) {
  if (tone === 'primary') {
    return isActive
      ? 'bg-primary text-primary-content hover:bg-primary/92'
      : 'text-primary hover:bg-primary/12';
  }

  return isActive
    ? 'text-base-content hover:bg-base-content/5'
    : 'text-base-content/75 hover:bg-base-content/5 hover:text-base-content';
}

export function getSegmentButtonClasses({
  isActive,
  disabled = false,
  activeTone = 'primary',
  compact = false,
}) {
  const baseClass = compact ? COMPACT_SEGMENT_BUTTON_BASE_CLASS : SEGMENT_BUTTON_BASE_CLASS;
  let activeClass = 'bg-primary text-primary-content';
  if (activeTone === 'secondary') {
    activeClass = 'bg-secondary text-secondary-content';
  } else if (activeTone === 'calc') {
    activeClass = 'bg-base-100/70 text-base-content';
  } else if (activeTone === 'neutral') {
    activeClass = 'bg-base-content/10 text-base-content';
  }
  const resolvedClass = isActive
    ? activeClass
    : 'bg-base-100/50 text-base-content/75 hover:bg-base-200/70';
  const disabledClass = disabled ? 'pointer-events-none opacity-40' : '';
  return `${baseClass} ${resolvedClass} ${disabledClass}`;
}

export function formatToolbarDateTimeDisplay(value) {
  if (!value) return '';
  const valueText = String(value);
  const dateOnlyMatch = DATE_ONLY_PATTERN.exec(valueText);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return `${day}.${month}.${year}`;
  }
  const match = DATE_TIME_PATTERN.exec(valueText);
  if (match) {
    const [, year, month, day, hour, minute] = match;
    return `${day}.${month}.${year}, ${hour}:${minute}`;
  }
  const parsed = new Date(value);
  const time = parsed.getTime();
  if (!Number.isFinite(time)) return value;
  try {
    return parsed.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return value;
  }
}

export function getDateRangeDisplay({
  dateFromLocal,
  dateToLocal,
  dateFromPreviewLocal,
  dateToPreviewLocal,
}) {
  const hasManualDateFilter = Boolean(dateFromLocal || dateToLocal);
  const fromValue = hasManualDateFilter ? dateFromLocal : dateFromPreviewLocal;
  const toValue = hasManualDateFilter ? dateToLocal : dateToPreviewLocal;
  const fromText = formatToolbarDateTimeDisplay(fromValue);
  const toText = formatToolbarDateTimeDisplay(toValue);

  if (hasManualDateFilter) {
    if (fromText && toText) {
      return { label: 'Date Range', fromText, toText, isAuto: false };
    }
    if (fromText) {
      return { label: 'From', fromText, toText: '', isAuto: false };
    }
    if (toText) {
      return { label: 'To', fromText: '', toText, isAuto: false };
    }
    return { label: 'Date Range', fromText: 'No dates', toText: '', isAuto: false };
  }

  if (fromText || toText) {
    return { label: 'Auto Range', fromText: fromText || 'No date', toText, isAuto: true };
  }

  return { label: 'Auto Range', fromText: 'No dates', toText: '', isAuto: true };
}

export function formatCountLabel(value, singular, plural) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return `0 ${plural}`;
  return `${numericValue} ${numericValue === 1 ? singular : plural}`;
}

export function formatCollapsedDateRangeText(startValue, endValue) {
  const fromText = formatToolbarDateTimeDisplay(startValue) || 'No dates';
  const toText = formatToolbarDateTimeDisplay(endValue) || '';
  return toText ? `${fromText} - ${toText}` : fromText;
}

export function getCandidateSummary({ metadataLoading, candidateCount }) {
  if (metadataLoading) {
    return {
      candidateLabel: '...',
      resetAriaCount: 'loading candidates',
    };
  }

  if (Number.isFinite(candidateCount)) {
    return {
      candidateLabel: String(candidateCount),
      resetAriaCount: `${candidateCount} candidates`,
    };
  }

  return {
    candidateLabel: '-',
    resetAriaCount: 'unknown candidates',
  };
}

export function getToolbarMessages({ parseErrors, parseWarnings, metadataError }) {
  const topError = parseErrors[0]?.message || null;
  const topWarning = topError ? null : parseWarnings[0]?.message || null;
  const noticeMessage = topError || metadataError || topWarning || null;
  const noticeTone = topError ? 'error' : 'warning';

  return {
    topError,
    topWarning,
    noticeMessage,
    noticeTone,
  };
}

export function getDateBasisOptionTitle(value) {
  if (value === 'shot') return 'Use shot timestamp only';
  if (value === 'auto') return 'Use shot timestamp, fallback to upload time';
  return 'Use upload time only';
}

export function closeParentDetails(target) {
  const details = target.closest('details');
  if (details) details.open = false;
}

export function closeOpenToolbarDetails(toolbarNode) {
  toolbarNode.querySelectorAll('details[open]').forEach(detailsNode => {
    detailsNode.open = false;
  });
}

export function isToolbarFloatingPanelTarget(target) {
  return target instanceof Element && target.closest('[data-statistics-toolbar-floating-panel]');
}
