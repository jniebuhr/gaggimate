// Statistics DSL parser/compiler used by the toolbar query input.
// Semantics:
// - free-text clauses combine with AND
// - repeated field clauses combine with OR (except date clauses, which combine with AND)
// - date expressions are evaluated in local/browser time
const SUPPORTED_FIELDS = new Set(['name', 'profile', 'id', 'source', 'date']);
const SOURCE_ALIASES = {
  gm: 'gaggimate',
  gaggimate: 'gaggimate',
  web: 'browser',
  browser: 'browser',
  src: 'both',
  both: 'both',
};

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function splitQueryClauses(queryString) {
  const input = String(queryString ?? '');
  const parts = [];
  let current = '';
  let inQuotes = false;

  // Split on semicolons, but keep quoted text intact so exact matches can contain ';'.
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const prev = i > 0 ? input[i - 1] : '';

    if (char === '"' && prev !== '\\') {
      inQuotes = !inQuotes;
      current += char;
      continue;
    }

    if (char === ';' && !inQuotes) {
      parts.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  if (current.length > 0 || input.endsWith(';')) {
    parts.push(current);
  }

  return parts;
}

function parseQuotedOrPlainValue(rawValue) {
  const trimmed = String(rawValue ?? '').trim();
  if (!trimmed) {
    return { error: 'Empty value.' };
  }

  const startsQuote = trimmed.startsWith('"');
  const endsQuote = trimmed.endsWith('"');

  if (startsQuote || endsQuote) {
    if (!(startsQuote && endsQuote) || trimmed.length < 2) {
      return { error: 'Unclosed quoted value.' };
    }
    const inner = trimmed.slice(1, -1).replaceAll('\\"', '"').replaceAll('\\\\', '\\');
    return { value: inner.trim(), exact: true };
  }

  return { value: trimmed, exact: false };
}

export function parseStatisticsQuery(queryString) {
  const clauses = [];
  const errors = [];
  const warnings = [];

  const rawClauses = splitQueryClauses(queryString);
  rawClauses.forEach((rawClause, index) => {
    const raw = String(rawClause ?? '');
    const trimmed = raw.trim();
    if (!trimmed) return;

    const fieldMatch = trimmed.match(/^([a-zA-Z]+)\s*:\s*(\S.*)$/);
    if (!fieldMatch) {
      const freeValue = parseQuotedOrPlainValue(trimmed);
      if (freeValue.error) {
        errors.push({
          code: 'invalid_free_text',
          message: `Query clause ${index + 1}: ${freeValue.error}`,
          raw: trimmed,
        });
        return;
      }
      clauses.push({
        field: '__free',
        op: null,
        value: freeValue.value,
        exact: freeValue.exact,
        raw: trimmed,
      });
      return;
    }

    const [, fieldRaw, valueRaw] = fieldMatch;
    const field = normalizeText(fieldRaw);

    if (!SUPPORTED_FIELDS.has(field)) {
      warnings.push({
        code: 'unknown_field',
        message: `Unknown field "${fieldRaw}". Supported: name, profile, id, source, date.`,
        raw: trimmed,
      });
      return;
    }

    if (field === 'date') {
      const dateMatch = /^(>=|<=|>|<|=)\s*(\S.*)$/.exec(String(valueRaw ?? '').trim());
      if (!dateMatch) {
        errors.push({
          code: 'date_operator_required',
          message: `date: requires an operator (>, >=, <, <=, =). Example: date:>h-7d`,
          raw: trimmed,
        });
        return;
      }

      const [, op, expr] = dateMatch;
      const exprTrimmed = String(expr ?? '').trim();
      if (!exprTrimmed) {
        errors.push({
          code: 'date_expression_missing',
          message: 'date: expression is empty.',
          raw: trimmed,
        });
        return;
      }

      clauses.push({
        field: 'date',
        op,
        value: exprTrimmed,
        exact: false,
        raw: trimmed,
      });
      return;
    }

    const parsedValue = parseQuotedOrPlainValue(valueRaw);
    if (parsedValue.error) {
      errors.push({
        code: 'invalid_field_value',
        message: `Invalid value for ${field}: ${parsedValue.error}`,
        raw: trimmed,
      });
      return;
    }

    clauses.push({
      field,
      op: null,
      value: parsedValue.value,
      exact: parsedValue.exact,
      raw: trimmed,
    });
  });

  return { clauses, errors, warnings };
}

function normalizeEpochInputToMs(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;

  // Heuristic: GM timestamps are usually seconds, browser uploadedAt is milliseconds.
  if (numeric > 1e12) return Math.round(numeric);
  if (numeric > 1e9) return Math.round(numeric * 1000);
  return null;
}

export function resolveShotEffectiveTimestampMs(shotMeta, dateBasisMode = 'auto') {
  const shotTsMs = normalizeEpochInputToMs(shotMeta?.timestamp ?? shotMeta?.shotDate);
  const uploadTsMs = normalizeEpochInputToMs(shotMeta?.uploadedAt);

  if (dateBasisMode === 'shot') return shotTsMs;
  if (dateBasisMode === 'upload') return uploadTsMs;
  return shotTsMs ?? uploadTsMs;
}

function parseAbsoluteLocalDateExpression(expr) {
  const match = String(expr ?? '')
    .trim()
    .match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (!match) return null;

  const [, dayRaw, monthRaw, yearRaw, hourRaw, minuteRaw] = match;
  const day = Number(dayRaw);
  const month = Number(monthRaw);
  const year = yearRaw.length === 2 ? 2000 + Number(yearRaw) : Number(yearRaw);
  const hasTime = hourRaw !== undefined && minuteRaw !== undefined;
  const hour = hasTime ? Number(hourRaw) : 0;
  const minute = hasTime ? Number(minuteRaw) : 0;

  if (
    !Number.isInteger(day) ||
    !Number.isInteger(month) ||
    !Number.isInteger(year) ||
    day < 1 ||
    day > 31 ||
    month < 1 ||
    month > 12 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return { error: 'Invalid date or time value.' };
  }

  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    return { error: 'Invalid calendar date.' };
  }

  return { valueMs: date.getTime(), hasTime };
}

export function parseDateExpressionToEpochMs(expr, now = new Date()) {
  const trimmed = String(expr ?? '').trim();
  if (!trimmed) {
    return { valueMs: null, hasTime: false, error: 'Empty date expression.' };
  }

  // `h` means "now" for historical reasons; both `d` and legacy `t` are accepted as day suffixes.
  const relativeMatch = trimmed.match(/^h(?:\s*([+-])\s*(\d+)\s*[dt])?$/i);
  if (relativeMatch) {
    const [, sign, amountRaw] = relativeMatch;
    const baseMs = now instanceof Date ? now.getTime() : Date.now();
    if (!sign || !amountRaw) {
      return { valueMs: baseMs, hasTime: true, error: null };
    }

    const amount = Number(amountRaw);
    if (!Number.isFinite(amount)) {
      return { valueMs: null, hasTime: false, error: 'Invalid relative day value.' };
    }
    const deltaMs = amount * 24 * 60 * 60 * 1000;
    const next = sign === '+' ? baseMs + deltaMs : baseMs - deltaMs;
    return { valueMs: next, hasTime: true, error: null };
  }

  const absolute = parseAbsoluteLocalDateExpression(trimmed);
  if (!absolute) {
    return {
      valueMs: null,
      hasTime: false,
      error: 'Unsupported date expression. Use DD.MM.YYYY, optional HH:MM, or h-7d.',
    };
  }
  if (absolute.error) {
    return { valueMs: null, hasTime: false, error: absolute.error };
  }

  return { valueMs: absolute.valueMs, hasTime: absolute.hasTime, error: null };
}

function getDayBounds(ms) {
  const date = new Date(ms);
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0).getTime();
  const end = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  ).getTime();
  return { start, end };
}

function matchesTextClause(values, clause) {
  const needle = normalizeText(clause?.value);
  if (!needle) return true;

  const normalizedValues = values.map(normalizeText).filter(Boolean);
  if (clause.exact) {
    return normalizedValues.some(value => value === needle);
  }
  return normalizedValues.some(value => value.includes(needle));
}

function getTextValuesForField(shotMeta, field) {
  switch (field) {
    case 'name':
      return [
        shotMeta?.name,
        shotMeta?.label,
        shotMeta?.title,
        shotMeta?.fileName,
        shotMeta?.exportName,
      ];
    case 'profile':
      return [shotMeta?.profile, shotMeta?.profileName];
    case 'id':
      return [shotMeta?.id];
    case 'source':
      return [shotMeta?.source];
    case '__free':
      return [
        shotMeta?.name,
        shotMeta?.label,
        shotMeta?.title,
        shotMeta?.profile,
        shotMeta?.id,
        shotMeta?.source,
      ];
    default:
      return [];
  }
}

function normalizeSourceValueForMatch(raw) {
  const value = normalizeText(raw);
  return SOURCE_ALIASES[value] || value;
}

function matchesSourceClause(shotMeta, clause) {
  const source = normalizeSourceValueForMatch(shotMeta?.source);
  const wanted = normalizeSourceValueForMatch(clause?.value);
  if (!wanted || wanted === 'both') return true;
  if (clause.exact) return source === wanted;
  return source.includes(wanted);
}

function compileDateClause(clause, options) {
  const parsed = parseDateExpressionToEpochMs(clause.value, options.now);
  if (parsed.error || !Number.isFinite(parsed.valueMs)) {
    return {
      error: {
        code: 'date_parse_failed',
        message: `Invalid date expression in "${clause.raw}": ${parsed.error || 'Unknown error.'}`,
        raw: clause.raw,
      },
      matcher: null,
    };
  }

  const { valueMs, hasTime } = parsed;
  const bounds = hasTime ? null : getDayBounds(valueMs);
  const op = clause.op;

  const matcher = shotMeta => {
    const ts = resolveShotEffectiveTimestampMs(shotMeta, options.dateBasisMode);
    if (!Number.isFinite(ts)) return false;

    if (!hasTime) {
      if (op === '=') return ts >= bounds.start && ts <= bounds.end;
      if (op === '>') return ts > bounds.end;
      if (op === '>=') return ts >= bounds.start;
      if (op === '<') return ts < bounds.start;
      if (op === '<=') return ts <= bounds.end;
      return false;
    }

    if (op === '=') return ts === valueMs;
    if (op === '>') return ts > valueMs;
    if (op === '>=') return ts >= valueMs;
    if (op === '<') return ts < valueMs;
    if (op === '<=') return ts <= valueMs;
    return false;
  };

  return { matcher, error: null };
}

function matchClauseAgainstShotMeta(shotMeta, clause, ctx) {
  if (clause.field === 'date') {
    return ctx.dateMatchers.every(matcher => matcher(shotMeta));
  }

  if (clause.field === 'source') {
    return matchesSourceClause(shotMeta, clause);
  }

  const values = getTextValuesForField(shotMeta, clause.field);
  return matchesTextClause(values, clause);
}

export function buildShotCandidatePredicate(parsedQuery, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const dateBasisMode = options.dateBasisMode || 'auto';
  const errors = [...(parsedQuery?.errors || [])];
  const warnings = [...(parsedQuery?.warnings || [])];
  const clauses = Array.isArray(parsedQuery?.clauses) ? parsedQuery.clauses : [];

  const freeClauses = [];
  const fieldClauseGroups = new Map();
  const dateMatchers = [];

  for (const clause of clauses) {
    if (!clause) continue;

    if (clause.field === '__free') {
      freeClauses.push(clause);
      continue;
    }

    if (clause.field === 'date') {
      const compiled = compileDateClause(clause, { now, dateBasisMode });
      if (compiled.error) {
        errors.push(compiled.error);
      } else if (compiled.matcher) {
        dateMatchers.push(compiled.matcher);
      }
      continue;
    }

    // Group same-field clauses so the predicate can apply OR within each field.
    const arr = fieldClauseGroups.get(clause.field) || [];
    arr.push(clause);
    fieldClauseGroups.set(clause.field, arr);
  }

  const predicate = shotMeta => {
    if (!shotMeta) return false;

    // Free-text clauses combine with AND.
    for (const clause of freeClauses) {
      if (!matchesTextClause(getTextValuesForField(shotMeta, '__free'), clause)) {
        return false;
      }
    }

    // Same-field OR for text/source fields.
    for (const [, groupClauses] of fieldClauseGroups.entries()) {
      let matched = false;
      for (const clause of groupClauses) {
        if (matchClauseAgainstShotMeta(shotMeta, clause, { dateMatchers })) {
          matched = true;
          break;
        }
      }
      if (!matched) return false;
    }

    // Date clauses are AND-combined to support range expressions.
    for (const matcher of dateMatchers) {
      if (!matcher(shotMeta)) return false;
    }

    return true;
  };

  return { predicate, errors, warnings };
}
