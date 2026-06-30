#!/usr/bin/env node
// @ts-check
/* eslint-disable @typescript-eslint/explicit-function-return-type -- JS runner scripts use JSDoc types under @ts-check. */

import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { spawn } from 'node:child_process';

/**
 * @typedef {'assertion' | 'env_unreachable' | 'timeout' | 'protocol_mismatch'} FailureType
 */

const strictMode =
  process.env.LAYERED_GATE_STRICT === '1' || process.env.REAL_ENV_GATE_STRICT === '1';
const maxRetries = Number(process.env.REAL_ENV_RETRY_MAX ?? 2);
const retryDelayMs = Number(process.env.REAL_ENV_RETRY_DELAY_MS ?? 3000);
const evidenceDir = process.env.LAYERED_EVIDENCE_DIR ?? 'coverage/layered-evidence';
const requiredKeys = ['EASEMOB_APPKEY', 'EASEMOB_USERID', 'EASEMOB_TOKEN'];

/**
 * @param {string} message
 * @returns {void}
 */
const writeStdout = message => {
  process.stdout.write(`${message}\n`);
};

/**
 * @param {string} message
 * @returns {void}
 */
const writeStderr = message => {
  process.stderr.write(`${message}\n`);
};

/**
 * @param {number} delayMs
 * @returns {Promise<void>}
 */
const sleep = async delayMs =>
  new Promise(resolve => {
    setTimeout(resolve, delayMs);
  });

/**
 * @param {FailureType} failureType
 * @param {string} message
 * @param {number} retryCount
 * @returns {void}
 */
const writeEvidence = (failureType, message, retryCount) => {
  const evidence = {
    runId: `real-env-${Date.now()}`,
    layerId: 'smoke_real_env',
    scenarioId: 'REAL_ENV_UNREACHABLE_RETRY_BLOCK',
    failureType,
    message,
    occurredAt: new Date().toISOString(),
    retryCount,
  };
  const filePath = resolvePath(process.cwd(), evidenceDir, 'failures.ndjson');
  mkdirSync(dirname(filePath), { recursive: true });
  appendFileSync(filePath, `${JSON.stringify(evidence)}\n`, 'utf8');
};

/** @returns {Promise<void>} */
const runVitest = () =>
  new Promise((resolve, reject) => {
    const child = spawn(
      'npm',
      [
        'run',
        'test:run',
        '--',
        'tests/smoke/real-env/real-env-core-path.test.ts',
        'tests/smoke/real-env/real-env-retry.test.ts',
        'tests/contract/real-env-gate-evidence.contract.test.ts',
      ],
      {
        stdio: 'inherit',
        env: {
          ...process.env,
          REAL_ENV_GATE_STRICT: strictMode ? '1' : (process.env.REAL_ENV_GATE_STRICT ?? '0'),
          REAL_ENV_ENABLE: '1',
        },
      }
    );
    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`real-env suite failed with exit=${code}`));
    });
  });

/** @returns {Promise<void>} */
const run = async () => {
  const missing = requiredKeys.filter(key => !(process.env[key] ?? '').trim());
  if (missing.length > 0) {
    const message = `缺少真实环境凭证: ${missing.join(', ')}`;
    if (!strictMode) {
      writeStdout(`[real-env-smoke] 非严格模式跳过: ${message}`);
      return;
    }
    writeEvidence('env_unreachable', message, 0);
    throw new Error(message);
  }

  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      await runVitest();
      writeStdout(`[real-env-smoke] 核心链路执行成功，重试次数: ${attempt}`);
      return;
    } catch (error) {
      if (attempt === maxRetries) {
        const message = `真实环境 smoke 核心链路重试失败: ${error instanceof Error ? error.message : String(error)}`;
        writeEvidence('env_unreachable', message, attempt);
        throw new Error(message);
      }
      await sleep(retryDelayMs);
      attempt += 1;
    }
  }
};

run().catch(error => {
  writeStderr(
    `[real-env-smoke] 执行失败: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
});
