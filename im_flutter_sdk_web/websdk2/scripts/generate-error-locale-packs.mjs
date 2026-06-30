#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  SUPPORTED_ERROR_MESSAGE_LOCALES,
  assertLocalePackHasNoChinese,
  buildErrorLocalePack,
  getErrorLocalePackPath,
  writeErrorLocalePack,
} from './error-message-locale.mjs';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const SOURCE_PATH = path.resolve(ROOT, 'src/rest/api-errors.json');

const source = JSON.parse(await fs.readFile(SOURCE_PATH, 'utf8'));

for (const lang of SUPPORTED_ERROR_MESSAGE_LOCALES) {
  const outputPath = await writeErrorLocalePack(source, lang);
  if (lang === 'en-US') {
    assertLocalePackHasNoChinese(buildErrorLocalePack(source, lang), getErrorLocalePackPath(lang));
  }
  process.stdout.write(`Generated ${path.relative(ROOT, outputPath)}\n`);
}
