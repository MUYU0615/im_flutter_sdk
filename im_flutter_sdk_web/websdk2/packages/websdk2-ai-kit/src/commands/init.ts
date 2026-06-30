import { runInitInstall } from '../shared/install-engine.js';
import type { CommandIO, InitCommandOptions, InstallResult } from '../shared/types.js';

export const runInit = (
  options: InitCommandOptions,
  io?: CommandIO
): InstallResult => {
  return runInitInstall(options, io);
};
