#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { spawn } from 'node:child_process';

const ROOT_PACKAGE_PATH = resolvePath(process.cwd(), 'package.json');
const AI_KIT_PACKAGE_PATH = resolvePath(
  process.cwd(),
  'packages/websdk2-ai-kit/package.json'
);
const AI_KIT_DIR = resolvePath(process.cwd(), 'packages/websdk2-ai-kit');
const LOCAL_NPM_CACHE = resolvePath(process.cwd(), '.cache/npm-release');

const args = process.argv.slice(2);
const command = args[0] ?? 'help';
const dryRun = args.includes('--dry-run');

const writeStdout = message => {
  process.stdout.write(`${message}\n`);
};

const writeStderr = message => {
  process.stderr.write(`${message}\n`);
};

const runCommand = (commandName, commandArgs, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(commandName, commandArgs, {
      stdio: 'inherit',
      cwd: options.cwd ?? process.cwd(),
      env: {
        ...process.env,
        npm_config_cache: LOCAL_NPM_CACHE,
        ...(options.env ?? {}),
      },
    });
    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(`命令执行失败: ${commandName} ${commandArgs.join(' ')} (exit=${code})`)
      );
    });
  });

const readPackageVersion = packagePath => {
  if (!existsSync(packagePath)) {
    throw new Error(`未找到 package.json: ${packagePath}`);
  }

  const raw = readFileSync(packagePath, 'utf8');
  const parsed = JSON.parse(raw);
  if (typeof parsed.version !== 'string' || parsed.version.trim() === '') {
    throw new Error(`package.json 缺少有效 version: ${packagePath}`);
  }
  if (typeof parsed.name !== 'string' || parsed.name.trim() === '') {
    throw new Error(`package.json 缺少有效 name: ${packagePath}`);
  }
  return {
    name: parsed.name,
    version: parsed.version.trim(),
  };
};

export const ensureAiKitVersionAligned = () => {
  const rootPackage = readPackageVersion(ROOT_PACKAGE_PATH);
  const aiKitPackage = readPackageVersion(AI_KIT_PACKAGE_PATH);

  if (rootPackage.version !== aiKitPackage.version) {
    throw new Error(
      `版本不一致: root=${rootPackage.version}, ai-kit=${aiKitPackage.version}。请先同步 package.json 版本号。`
    );
  }

  return {
    rootPackage,
    aiKitPackage,
  };
};

export const runAiKitReleaseCheck = async () => {
  const { rootPackage, aiKitPackage } = ensureAiKitVersionAligned();
  writeStdout(
    `[ai-kit-release] version aligned: ${rootPackage.name}@${rootPackage.version} / ${aiKitPackage.name}@${aiKitPackage.version}`
  );
  await runCommand('npm', ['run', 'build:ai-kit']);
  await runCommand('npm', ['run', 'test:ai-kit']);
};

export const runAiKitPack = async () => {
  ensureAiKitVersionAligned();
  await runCommand('npm', ['pack', ...(dryRun ? ['--dry-run'] : [])], {
    cwd: AI_KIT_DIR,
  });
};

export const runAiKitPublish = async () => {
  ensureAiKitVersionAligned();
  await runCommand(
    'npm',
    ['publish', '--access', 'public', ...(dryRun ? ['--dry-run'] : [])],
    { cwd: AI_KIT_DIR }
  );
};

const printHelp = () => {
  writeStdout('ai-kit-release');
  writeStdout('');
  writeStdout('用法:');
  writeStdout('  node scripts/release/ai-kit-release.mjs check');
  writeStdout('  node scripts/release/ai-kit-release.mjs pack [--dry-run]');
  writeStdout('  node scripts/release/ai-kit-release.mjs publish [--dry-run]');
};

const main = async () => {
  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }
  if (command === 'check') {
    await runAiKitReleaseCheck();
    return;
  }
  if (command === 'pack') {
    await runAiKitPack();
    return;
  }
  if (command === 'publish') {
    await runAiKitPublish();
    return;
  }

  throw new Error(`未知命令: ${command}`);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    writeStderr(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
