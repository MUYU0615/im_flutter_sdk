#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const RUNTIME_DIR = path.resolve(ROOT, 'src/rest/error-maps');
const GENERATED_ERROR_CODES = path.resolve(ROOT, 'src/utils/error-codes.generated.ts');
const LOCALIZED_FIELD_PATTERN = /"(reason|action|summary|runtimeMessage)"\s*:/;
const HAN_PATTERN = /[\u4e00-\u9fff]/;

const walk = async dir => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const filePath = path.resolve(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(filePath)));
    } else if (entry.isFile() && filePath.endsWith('.ts')) {
      files.push(filePath);
    }
  }
  return files;
};

const assertGeneratedFresh = () => {
  const result = spawnSync('node', ['scripts/generate-runtime-error-maps.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }

  const diff = spawnSync(
    'git',
    [
      'diff',
      '--exit-code',
      '--',
      'src/rest/error-maps',
      'src/utils/error-codes.generated.ts',
    ],
    { cwd: ROOT, encoding: 'utf8' }
  );
  if (diff.status !== 0) {
    process.stderr.write(diff.stdout);
    process.stderr.write(diff.stderr);
    process.stderr.write('[Runtime Error Maps] Generated files are stale.\n');
    process.exit(diff.status ?? 1);
  }
};

const main = async () => {
  assertGeneratedFresh();

  const files = [...(await walk(RUNTIME_DIR)), GENERATED_ERROR_CODES];
  const failures = [];
  for (const file of files) {
    const relative = path.relative(ROOT, file);
    const content = await fs.readFile(file, 'utf8');
    if (LOCALIZED_FIELD_PATTERN.test(content)) {
      failures.push(`${relative} contains localized text field`);
    }
    if (HAN_PATTERN.test(content)) {
      failures.push(`${relative} contains Chinese characters`);
    }
  }

  if (failures.length > 0) {
    process.stderr.write('[Runtime Error Maps] 发现以下问题：\n');
    for (const failure of failures) {
      process.stderr.write(`- ${failure}\n`);
    }
    process.exit(1);
  }

  process.stdout.write('[Runtime Error Maps] 通过\n');
};

await main();
