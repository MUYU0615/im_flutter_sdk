#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  SUPPORTED_ERROR_MESSAGE_LOCALES,
  assertLocalePackHasNoChinese,
  buildErrorLocalePack,
  getErrorLocalePackPath,
  readErrorLocalePack,
} from './error-message-locale.mjs';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const SOURCE_PATH = path.resolve(ROOT, 'src/rest/api-errors.json');

const source = JSON.parse(await fs.readFile(SOURCE_PATH, 'utf8'));

const assertDeepEqual = (left, right, label) => {
  const leftText = JSON.stringify(left);
  const rightText = JSON.stringify(right);
  if (leftText !== rightText) {
    throw new Error(`${label} is stale. Run npm run errors:locale:gen.`);
  }
};

const assertEntryCoverage = (sourceEntry, localeEntry, label) => {
  for (const field of ['message', 'reason', 'action']) {
    if (typeof sourceEntry[field] === 'string' && typeof localeEntry?.[field] !== 'string') {
      throw new Error(`${label}.${field} is missing in locale pack`);
    }
  }
};

const checkCoverage = localePack => {
  for (const [category, definition] of Object.entries(source.common ?? {})) {
    for (const [key, entry] of Object.entries(definition.errors ?? {})) {
      assertEntryCoverage(entry, localePack.common?.[category]?.errors?.[key], `common.${category}.${key}`);
    }
  }

  for (const [operation, definition] of Object.entries(source.apis ?? {})) {
    if (typeof definition.summary === 'string' && typeof localePack.apis?.[operation]?.summary !== 'string') {
      throw new Error(`apis.${operation}.summary is missing in locale pack`);
    }
    for (const [methodName, methodErrors] of Object.entries(definition.localErrors ?? {})) {
      for (const [key, entry] of Object.entries(methodErrors)) {
        assertEntryCoverage(
          entry,
          localePack.apis?.[operation]?.localErrors?.[methodName]?.[key],
          `apis.${operation}.localErrors.${methodName}.${key}`
        );
      }
    }
    for (const [key, entry] of Object.entries(definition.errors ?? {})) {
      assertEntryCoverage(entry, localePack.apis?.[operation]?.errors?.[key], `apis.${operation}.${key}`);
    }
  }
};

try {
  for (const lang of SUPPORTED_ERROR_MESSAGE_LOCALES) {
    const expected = buildErrorLocalePack(source, lang);
    const actual = await readErrorLocalePack(lang);
    assertDeepEqual(actual, expected, getErrorLocalePackPath(lang));
    checkCoverage(actual);
    if (lang === 'en-US') {
      assertLocalePackHasNoChinese(actual, getErrorLocalePackPath(lang));
    }
  }
  process.stdout.write('[Error Locale Coverage] 通过\n');
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
