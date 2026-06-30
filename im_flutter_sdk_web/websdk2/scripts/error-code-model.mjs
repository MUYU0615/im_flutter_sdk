import fs from 'node:fs/promises';
import { getLocalizedApiEntry, getLocalizedCommonEntry } from './error-message-locale.mjs';

export const readApiErrors = async () => {
  const dataPath = new URL('../src/rest/api-errors.json', import.meta.url);
  return JSON.parse(await fs.readFile(dataPath, 'utf8'));
};

export const parseRange = range => {
  const values = new Set();
  if (typeof range !== 'string' || range.trim() === '') {
    return values;
  }

  for (const rawPart of range.split(',')) {
    const part = rawPart.trim();
    if (part === '') {
      continue;
    }

    const rangeMatch = part.match(/^(-?\d+)-(-?\d+)$/);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      const min = Math.min(start, end);
      const max = Math.max(start, end);
      for (let value = min; value <= max; value += 1) {
        values.add(value);
      }
      continue;
    }

    if (/^-?\d+$/.test(part)) {
      values.add(Number(part));
    }
  }

  return values;
};

export const rangeCoversCode = (range, code) => parseRange(range).has(code);

const toSource = (scope, section, key) =>
  scope === 'common' ? `common.${section}.${key}` : `apis.${section}.${key}`;

const collectApiLocalErrorEntries = (apiName, definition, localePack) => {
  const entries = [];
  for (const [methodName, errors] of Object.entries(definition.localErrors ?? {})) {
    for (const [key, entry] of Object.entries(errors)) {
      const localized = localePack
        ? getLocalizedApiEntry(localePack, apiName, key, methodName)
        : {};
      entries.push({
        scope: 'api',
        section: apiName,
        key: `${methodName}.${key}`,
        code: entry.code,
        canonicalCode: entry.canonicalCode ?? entry.code,
        message: localized.message ?? entry.message,
        reason: localized.reason ?? entry.reason,
        action: localized.action ?? entry.action,
        retryable: entry.retryable,
        httpStatus: entry.httpStatus,
        aliases: entry.aliases ?? [],
        source: toSource('api', apiName, `${methodName}.${key}`),
      });
    }
  }
  return entries;
};

export const collectErrorEntries = (apiErrors, localePack) => {
  const entries = [];

  for (const [category, definition] of Object.entries(apiErrors.common)) {
    for (const [key, entry] of Object.entries(definition.errors)) {
      const localized = localePack ? getLocalizedCommonEntry(localePack, category, key) : {};
      entries.push({
        scope: 'common',
        section: category,
        key,
        code: entry.code,
        canonicalCode: entry.canonicalCode ?? entry.code,
        message: localized.message ?? entry.message,
        reason: localized.reason ?? entry.reason,
        action: localized.action ?? entry.action,
        retryable: entry.retryable,
        httpStatus: entry.httpStatus,
        aliases: entry.aliases ?? [],
        source: toSource('common', category, key),
      });
    }
  }

  for (const [apiName, definition] of Object.entries(apiErrors.apis)) {
    entries.push(...collectApiLocalErrorEntries(apiName, definition, localePack));
    for (const [key, entry] of Object.entries(definition.errors)) {
      const localized = localePack ? getLocalizedApiEntry(localePack, apiName, key) : {};
      entries.push({
        scope: 'api',
        section: apiName,
        key,
        code: entry.code,
        canonicalCode: entry.canonicalCode ?? entry.code,
        message: localized.message ?? entry.message,
        reason: localized.reason ?? entry.reason,
        action: localized.action ?? entry.action,
        retryable: entry.retryable,
        httpStatus: entry.httpStatus,
        aliases: entry.aliases ?? [],
        source: toSource('api', apiName, key),
      });
    }
  }

  return entries;
};

export const groupByCanonicalCode = entries => {
  const groups = new Map();
  for (const entry of entries) {
    const group = groups.get(entry.canonicalCode) ?? [];
    group.push(entry);
    groups.set(entry.canonicalCode, group);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left - right)
    .map(([code, groupEntries]) => [
      code,
      groupEntries.sort((left, right) => {
        if (left.scope !== right.scope) {
          return left.scope.localeCompare(right.scope);
        }
        return left.source.localeCompare(right.source);
      }),
    ]);
};
