import { runInit } from './init.js';
import type { CommandIO, InitCommandOptions, InstallResult } from '../shared/types.js';

export const runSetupSkills = (
  options: InitCommandOptions,
  io?: CommandIO
): InstallResult => {
  return runInit(options, io);
};
