import { MAX_AUTO_DETECTED_DOSE_GRAMS } from './constants';
import { cleanName } from './formatting';

export function resolveProfileFieldValue(profile) {
  if (!profile || typeof profile !== 'object') return '';
  return (
    profile.label ||
    profile.data?.label ||
    profile.name ||
    profile.data?.name ||
    profile.fileName ||
    profile.data?.fileName ||
    profile.exportName ||
    profile.data?.exportName ||
    ''
  );
}

export const getProfileDisplayLabel = (profile, fallback = 'Unknown') => {
  if (typeof profile === 'string') {
    return cleanName(profile).trim() || fallback;
  }
  const rawLabel = resolveProfileFieldValue(profile) || fallback;
  return cleanName(String(rawLabel)).trim() || fallback;
};

function isDigitChar(char) {
  return char >= '0' && char <= '9';
}

function isAsciiLetterChar(char) {
  return char >= 'a' && char <= 'z';
}

function isWhitespaceChar(char) {
  return char === ' ' || char === '\n' || char === '\r' || char === '\t';
}

function skipWhitespaceForward(text, index) {
  let cursor = index;
  while (cursor < text.length && isWhitespaceChar(text[cursor])) {
    cursor += 1;
  }
  return cursor;
}

function skipWhitespaceBackward(text, index) {
  let cursor = index;
  while (cursor >= 0 && isWhitespaceChar(text[cursor])) {
    cursor -= 1;
  }
  return cursor;
}

function readAsciiWordForward(text, index) {
  let cursor = index;
  while (cursor < text.length && isAsciiLetterChar(text[cursor])) {
    cursor += 1;
  }
  return text.slice(index, cursor);
}

function readAsciiWordBackward(text, index) {
  let cursor = index;
  while (cursor >= 0 && isAsciiLetterChar(text[cursor])) {
    cursor -= 1;
  }
  return text.slice(cursor + 1, index + 1);
}

function readDoseNumberToken(text, index) {
  let cursor = index;
  let seenDecimalSeparator = false;

  while (cursor < text.length) {
    const char = text[cursor];
    if (isDigitChar(char)) {
      cursor += 1;
      continue;
    }

    const nextChar = text[cursor + 1];
    const previousChar = text[cursor - 1];
    if (
      char === '.' &&
      !seenDecimalSeparator &&
      isDigitChar(previousChar) &&
      isDigitChar(nextChar)
    ) {
      seenDecimalSeparator = true;
      cursor += 1;
      continue;
    }

    break;
  }

  if (cursor === index) return null;

  return {
    raw: text.slice(index, cursor),
    end: cursor,
  };
}

const RANGE_SEPARATOR_CHARS = new Set(['-', '–', '—', '−']);

function isRangeValueBefore(text, numberStart) {
  const previousTokenIndex = skipWhitespaceBackward(text, numberStart - 1);
  if (previousTokenIndex < 0) return false;

  const previousChar = text[previousTokenIndex];
  if (RANGE_SEPARATOR_CHARS.has(previousChar)) {
    const beforeSeparatorIndex = skipWhitespaceBackward(text, previousTokenIndex - 1);
    return (
      beforeSeparatorIndex >= 0 &&
      (isDigitChar(text[beforeSeparatorIndex]) || text[beforeSeparatorIndex] === 'g')
    );
  }

  if (!isAsciiLetterChar(previousChar)) return false;

  const previousWord = readAsciiWordBackward(text, previousTokenIndex);
  if (previousWord !== 'to') return false;

  const beforeWordIndex = skipWhitespaceBackward(text, previousTokenIndex - previousWord.length);
  return beforeWordIndex >= 0 && isDigitChar(text[beforeWordIndex]);
}

function isRangeValueAfter(text, unitIndex) {
  const nextTokenIndex = skipWhitespaceForward(text, unitIndex + 1);
  if (nextTokenIndex >= text.length) return false;

  const nextChar = text[nextTokenIndex];
  if (RANGE_SEPARATOR_CHARS.has(nextChar)) {
    const afterSeparatorIndex = skipWhitespaceForward(text, nextTokenIndex + 1);
    return afterSeparatorIndex < text.length && isDigitChar(text[afterSeparatorIndex]);
  }

  if (!isAsciiLetterChar(nextChar)) return false;

  const nextWord = readAsciiWordForward(text, nextTokenIndex);
  if (nextWord !== 'to') return false;

  const afterWordIndex = skipWhitespaceForward(text, nextTokenIndex + nextWord.length);
  return afterWordIndex < text.length && isDigitChar(text[afterWordIndex]);
}

function readDoseCandidate(text, startIndex) {
  const numberToken = readDoseNumberToken(text, startIndex);
  if (!numberToken) {
    return { nextIndex: startIndex + 1, value: null };
  }

  const unitIndex = skipWhitespaceForward(text, numberToken.end);
  if (unitIndex >= text.length || text[unitIndex] !== 'g') {
    return {
      nextIndex: Math.max(startIndex + 1, numberToken.end),
      value: null,
    };
  }

  const charAfterUnit = text[unitIndex + 1];
  if (charAfterUnit && (isAsciiLetterChar(charAfterUnit) || isDigitChar(charAfterUnit))) {
    return {
      nextIndex: unitIndex + 1,
      value: null,
    };
  }

  if (isRangeValueBefore(text, startIndex) || isRangeValueAfter(text, unitIndex)) {
    return {
      nextIndex: unitIndex + 1,
      value: null,
    };
  }

  const value = Number.parseFloat(numberToken.raw);
  return {
    nextIndex: unitIndex + 1,
    value:
      Number.isFinite(value) && value > 0 && value <= MAX_AUTO_DETECTED_DOSE_GRAMS ? value : null,
  };
}

export const detectDoseFromProfileName = profileName => {
  if (!profileName) return null;

  const lower = profileName.toLowerCase();
  const candidates = [];

  let cursor = 0;
  while (cursor < lower.length) {
    if (!isDigitChar(lower[cursor])) {
      cursor += 1;
      continue;
    }

    const candidate = readDoseCandidate(lower, cursor);
    if (candidate.value !== null) {
      candidates.push(candidate.value);
    }
    cursor = candidate.nextIndex;
  }

  return candidates.length === 1 ? candidates[0] : null;
};
