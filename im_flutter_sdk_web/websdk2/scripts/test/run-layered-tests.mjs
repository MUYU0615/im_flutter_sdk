#!/usr/bin/env node
// @ts-check
/* eslint-disable @typescript-eslint/explicit-function-return-type -- JS runner scripts use JSDoc types under @ts-check. */

import { spawn } from 'node:child_process';

/**
 * @typedef {'pr_gate' | 'nightly_full' | 'release_gate'} PolicyId
 * @typedef {readonly [string, ReadonlyArray<string>]} CommandStep
 */

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

const args = process.argv.slice(2);

/**
 * @param {string} name
 * @param {string} fallback
 * @returns {string}
 */
const getArgValue = (name, fallback) => {
  const index = args.findIndex(item => item === `--${name}`);
  if (index === -1 || index + 1 >= args.length) {
    return fallback;
  }
  return args[index + 1];
};

const policy = getArgValue('policy', 'pr_gate');
const strictMode = process.env.LAYERED_GATE_STRICT === '1';

/**
 * @param {string} value
 * @returns {value is PolicyId}
 */
const isPolicyId = value => {
  return value === 'pr_gate' || value === 'nightly_full' || value === 'release_gate';
};

/**
 * @param {string} command
 * @param {ReadonlyArray<string>} commandArgs
 * @param {Record<string, string>} [envPatch]
 * @returns {Promise<void>}
 */
const runCommand = (command, commandArgs, envPatch = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      stdio: 'inherit',
      env: { ...process.env, ...envPatch },
    });
    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`命令执行失败: ${command} ${commandArgs.join(' ')} (exit=${code})`));
    });
  });

/** @type {Readonly<Record<PolicyId, ReadonlyArray<CommandStep>>>} */
const policySteps = {
  pr_gate: [
    ['npm', ['run', 'test:run', '--', 'tests/unit']],
    [
      'npm',
      [
        'run',
        'test:run',
        '--',
        'tests/integration',
        'tests/contract/mock-failure-evidence.contract.test.ts',
        'tests/contract/release-gate-e2e.contract.test.ts',
      ],
    ],
  ],
  nightly_full: [
    ['npm', ['run', 'test:run', '--', 'tests/unit']],
    [
      'npm',
      [
        'run',
        'test:run',
        '--',
        'tests/integration',
        'tests/contract/mock-failure-evidence.contract.test.ts',
        'tests/contract/release-gate-e2e.contract.test.ts',
      ],
    ],
    ['node', ['scripts/test/run-e2e-gate.mjs', '--mode', 'nightly']],
  ],
  release_gate: [
    ['npm', ['run', 'test:run', '--', 'tests/unit']],
    [
      'npm',
      [
        'run',
        'test:run',
        '--',
        'tests/integration',
        'tests/contract/mock-failure-evidence.contract.test.ts',
      ],
    ],
    ['node', ['scripts/test/run-e2e-gate.mjs', '--mode', 'release']],
  ],
};

if (!isPolicyId(policy)) {
  writeStderr(`[layered] 未知策略: ${policy}`);
  process.exit(1);
}

/** @returns {Promise<void>} */
const run = async () => {
  writeStdout(`[layered] policy=${policy} strict=${strictMode ? '1' : '0'}`);
  for (const [command, commandArgs] of policySteps[policy]) {
    await runCommand(command, commandArgs, {
      LAYERED_GATE_STRICT: strictMode ? '1' : (process.env.LAYERED_GATE_STRICT ?? '0'),
    });
  }
  writeStdout(`[layered] 策略执行完成: ${policy}`);
};

/**
 * @param {unknown} error
 * @returns {void}
 */
const handleFatalError = error => {
  writeStderr(`[layered] 执行失败: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
};

run().catch(handleFatalError);
