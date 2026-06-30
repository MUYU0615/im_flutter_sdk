import { runUpdateInstall } from '../shared/install-engine.js';
import type { CommandIO, InstallResult, UpdateCommandOptions } from '../shared/types.js';

export const runUpdate = (
  options: UpdateCommandOptions,
  io?: CommandIO
): InstallResult => {
  return runUpdateInstall(options, io);
};
