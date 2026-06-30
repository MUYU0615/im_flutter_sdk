#!/usr/bin/env node
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { runDoctor } from './commands/doctor.js';
import { runInit } from './commands/init.js';
import { runRemove } from './commands/remove.js';
import { runUpdate } from './commands/update.js';
import { buildHelpText, parseCliArgs } from './shared/args.js';
import type { CommandIO, InitCommandOptions } from './shared/types.js';

const defaultIO: CommandIO = {
  stdout: message => {
    process.stdout.write(`${message}\n`);
  },
  stderr: message => {
    process.stderr.write(`${message}\n`);
  },
};

const confirm = (message: string): Promise<boolean> => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(`${message} [y/N] `, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
};

const runInitWithConfirm = async (
  options: InitCommandOptions,
  io: CommandIO
): Promise<void> => {
  if (options.dryRun || options.force) {
    runInit(options, io);
    return;
  }

  // 先 dry-run 打印计划
  const dryResult = runInit({ ...options, dryRun: true }, io);
  if (dryResult.installedFileCount === 0) {
    return;
  }

  const confirmed = await confirm('确认写入以上文件？');
  if (!confirmed) {
    io.stdout('已取消。');
    return;
  }

  runInit(options, io);
};

export const runCli = async (
  rawArgs: ReadonlyArray<string>,
  io: CommandIO = defaultIO
): Promise<number> => {
  const parsed = parseCliArgs(rawArgs);
  if (parsed.name === 'help') {
    io.stdout(buildHelpText());
    return 0;
  }
  if (parsed.name === 'init') {
    await runInitWithConfirm(parsed.initOptions!, io);
    return 0;
  }
  if (parsed.name === 'update') {
    runUpdate(parsed.updateOptions!, io);
    return 0;
  }
  if (parsed.name === 'remove') {
    runRemove(parsed.removeOptions!, io);
    return 0;
  }
  runDoctor(parsed.doctorOptions!, io);
  return 0;
};

const isMainModule = (): boolean => {
  const currentFile = fileURLToPath(import.meta.url);
  return process.argv[1] === currentFile;
};

if (isMainModule()) {
  runCli(process.argv.slice(2)).then(
    exitCode => {
      process.exitCode = exitCode;
    },
    error => {
      defaultIO.stderr(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  );
}
