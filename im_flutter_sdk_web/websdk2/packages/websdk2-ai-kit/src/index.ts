export { runCli } from './cli.js';
export { runDoctor } from './commands/doctor.js';
export { runInit } from './commands/init.js';
export { runRemove } from './commands/remove.js';
export { runSetupSkills } from './commands/setup-skills.js';
export { runUpdate } from './commands/update.js';
export { buildHelpText, parseCliArgs } from './shared/args.js';
export type {
  AiKitManifest,
  CommandIO,
  DoctorOptions,
  DoctorResult,
  InitCommandOptions,
  InstallResult,
  ParsedCliCommand,
  RemoveCommandOptions,
  RemoveResult,
  SupportedTool,
  UpdateCommandOptions,
} from './shared/types.js';
