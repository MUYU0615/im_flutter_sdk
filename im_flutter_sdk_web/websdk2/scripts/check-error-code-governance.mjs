#!/usr/bin/env node
import { collectErrorEntries, readApiErrors, rangeCoversCode } from './error-code-model.mjs';

const failures = [];

const allowedDuplicateCodes = new Set([
  1, 2, 3, 4, 100, 108, 110, 111, 201, 202, 204, 210, 215, 223, 300, 301, 302, 303, 305, 400, 401,
  402, 403, 405, 407, 408, 409, 410, 411, 500, 505, 600, 602, 603, 606, 607, 608, 702, 703,
  704, 707, 900, 1001, 1002, 1100, 1101, 1110, 1111, 1302, 1500, 1501, 1502, 1600,
  1601,
]);

const serverOnlyCodes = new Set([15002, 91101, 91102]);

const requiredPushCodes = {
  TOKEN_UPLOAD_FAILED: 1500,
  SILENT_MODE_OPERATION_FAILED: 1501,
  PUSH_LANGUAGE_OPERATION_FAILED: 1502,
};

const requiredStorageCodes = {
  OPERATION_FAILED: 3,
};

const checkRangeCoverage = apiErrors => {
  const getEntries = definition => {
    const localEntries = Object.values(definition.localErrors ?? {}).flatMap(errors =>
      Object.values(errors)
    );
    return [...Object.values(definition.errors), ...localEntries];
  };

  for (const [scope, definitions] of [
    ['common', apiErrors.common],
    ['apis', apiErrors.apis],
  ]) {
    for (const [name, definition] of Object.entries(definitions)) {
      if (definition.range === '') {
        continue;
      }
      for (const entry of getEntries(definition)) {
        if (!rangeCoversCode(definition.range, entry.code)) {
          failures.push(
            `${scope}.${name} code ${entry.code} is not covered by range "${definition.range}"`
          );
        }
      }
    }
  }
};

const checkPushCodes = apiErrors => {
  const push = apiErrors.common.push?.errors;
  if (!push) {
    failures.push('common.push.errors is missing');
    return;
  }

  for (const [key, expectedCode] of Object.entries(requiredPushCodes)) {
    if (push[key]?.code !== expectedCode) {
      failures.push(`common.push.${key} expected code ${expectedCode}, got ${push[key]?.code}`);
    }
  }

  const entries = collectErrorEntries(apiErrors);
  for (const entry of entries) {
    if (
      entry.code === 1510 ||
      entry.code === 1511 ||
      entry.canonicalCode === 1510 ||
      entry.canonicalCode === 1511
    ) {
      failures.push(`${entry.source} still uses retired Push code ${entry.code}`);
    }
  }
};

const checkStorageCodes = apiErrors => {
  const storage = apiErrors.common.storage?.errors;
  if (!storage) {
    failures.push('common.storage.errors is missing');
    return;
  }

  if ('DATABASE_ERROR' in storage) {
    failures.push('common.storage.errors.DATABASE_ERROR is retired; use OPERATION_FAILED instead');
  }

  for (const [key, expectedCode] of Object.entries(requiredStorageCodes)) {
    if (storage[key]?.code !== expectedCode) {
      failures.push(
        `common.storage.${key} expected code ${expectedCode}, got ${storage[key]?.code}`
      );
    }
  }
};

const checkServerOnlyCodes = apiErrors => {
  for (const entry of collectErrorEntries(apiErrors)) {
    if (serverOnlyCodes.has(entry.code)) {
      failures.push(`${entry.source} exposes server-only code ${entry.code} as public code`);
    }
    if (serverOnlyCodes.has(entry.canonicalCode)) {
      failures.push(
        `${entry.source} exposes server-only code ${entry.canonicalCode} as canonical code`
      );
    }
  }
};

const checkDuplicates = apiErrors => {
  const byCode = new Map();
  for (const entry of collectErrorEntries(apiErrors)) {
    const group = byCode.get(entry.canonicalCode) ?? [];
    group.push(entry);
    byCode.set(entry.canonicalCode, group);
  }

  for (const [code, entries] of byCode.entries()) {
    if (entries.length <= 1 || allowedDuplicateCodes.has(code)) {
      continue;
    }
    failures.push(
      `canonical code ${code} is reused by ${entries.map(entry => entry.source).join(', ')} but is not in the allowed duplicate list`
    );
  }
};

const apiErrors = await readApiErrors();
checkRangeCoverage(apiErrors);
checkPushCodes(apiErrors);
checkStorageCodes(apiErrors);
checkServerOnlyCodes(apiErrors);
checkDuplicates(apiErrors);

if (failures.length > 0) {
  process.stderr.write('[Error Code Governance] 发现以下问题：\n');
  for (const failure of failures) {
    process.stderr.write(`- ${failure}\n`);
  }
  process.exit(1);
}

process.stdout.write('[Error Code Governance] 通过\n');
