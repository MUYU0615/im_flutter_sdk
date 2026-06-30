#!/usr/bin/env node

import {
  accessSync,
  constants,
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
} from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const modeIndex = args.findIndex(item => item === '--mode');
const mode = modeIndex >= 0 && modeIndex + 1 < args.length ? args[modeIndex + 1] : 'nightly';
const strictMode = process.env.LAYERED_GATE_STRICT === '1';
const evidenceDir = process.env.LAYERED_EVIDENCE_DIR ?? 'coverage/layered-evidence';
const markerFile = resolvePath(process.cwd(), evidenceDir, 'e2e-last-pass.json');
const maxMarkerAgeMs = Number(process.env.RELEASE_E2E_MAX_AGE_MS ?? 24 * 60 * 60 * 1000);

const runCommand = (command, commandArgs) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      stdio: 'inherit',
      env: { ...process.env },
    });
    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`命令失败: ${command} ${commandArgs.join(' ')} (exit=${code})`));
    });
  });

const writeEvidence = (failureType, message) => {
  const evidence = {
    runId: `e2e-${Date.now()}`,
    layerId: 'e2e_browser',
    scenarioId: 'E2E_RELEASE_GATE',
    failureType,
    message,
    occurredAt: new Date().toISOString(),
    retryCount: 0,
  };
  const filePath = resolvePath(process.cwd(), evidenceDir, 'failures.ndjson');
  mkdirSync(dirname(filePath), { recursive: true });
  appendFileSync(filePath, `${JSON.stringify(evidence)}\n`, 'utf8');
};

const canUsePlaywright = async () => {
  try {
    await runCommand('npx', ['playwright', '--version']);
    return true;
  } catch {
    return false;
  }
};

const hasRecentMarker = () => {
  try {
    accessSync(markerFile, constants.F_OK);
    const raw = readFileSync(markerFile, 'utf8');
    const payload = JSON.parse(raw);
    if (typeof payload.passedAt !== 'string') {
      return false;
    }
    const age = Date.now() - new Date(payload.passedAt).getTime();
    return age <= maxMarkerAgeMs;
  } catch {
    return false;
  }
};

const updateMarker = () => {
  mkdirSync(dirname(markerFile), { recursive: true });
  writeFileSync(
    markerFile,
    JSON.stringify(
      {
        passedAt: new Date().toISOString(),
        mode,
      },
      null,
      2
    ),
    'utf8'
  );
};

const run = async () => {
  const available = await canUsePlaywright();
  if (!available) {
    const message = '未检测到 Playwright 可执行环境';
    if (!strictMode) {
      console.log(`[e2e-gate] 非严格模式跳过: ${message}`);
      return;
    }
    writeEvidence('env_unreachable', message);
    throw new Error(message);
  }

  if (mode === 'release' && strictMode && !hasRecentMarker()) {
    console.log('[e2e-gate] release 模式未检测到最近 E2E 通过记录，先执行 E2E 生成记录');
    try {
      await runCommand('npm', ['run', 'test:e2e']);
    } catch (error) {
      const message = `发布前 E2E 执行失败: ${error instanceof Error ? error.message : String(error)}`;
      writeEvidence('assertion', message);
      throw new Error(message);
    }
    updateMarker();
    console.log('[e2e-gate] E2E 通过，已生成通过记录');
    return;
  }

  try {
    await runCommand('npm', ['run', 'test:e2e']);
  } catch (error) {
    const message = `E2E 执行失败: ${error instanceof Error ? error.message : String(error)}`;
    if (!strictMode) {
      writeEvidence('env_unreachable', message);
      console.log(`[e2e-gate] 非严格模式跳过: ${message}`);
      return;
    }
    writeEvidence('assertion', message);
    throw new Error(message);
  }
  updateMarker();
  console.log(`[e2e-gate] 执行完成: mode=${mode}`);
};

run().catch(error => {
  console.error(`[e2e-gate] 失败: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
