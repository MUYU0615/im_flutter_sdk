import type {
  DoctorOptions,
  InitCommandOptions,
  ParsedCliCommand,
  RemoveCommandOptions,
  RequestedTool,
  UpdateCommandOptions,
} from './types.js';

const readValue = (args: ReadonlyArray<string>, index: number, option: string): string => {
  const value = args[index + 1];
  if (!value) {
    throw new Error(`缺少 ${option} 的值`);
  }
  return value;
};

const normalizeTool = (value: string): RequestedTool => {
  if (
    value === 'cursor' ||
    value === 'codex' ||
    value === 'agent' ||
    value === 'all' ||
    value === 'auto'
  ) {
    return value;
  }
  throw new Error(`不支持的 --tool: ${value}`);
};

const parseSharedFlags = (
  args: ReadonlyArray<string>
): { tool: RequestedTool; cwd?: string; dryRun: boolean; force: boolean } => {
  let tool: RequestedTool = 'auto';
  let cwd: string | undefined;
  let dryRun = false;
  let force = false;

  for (let index = 0; index < args.length; index += 1) {
    const currentArg = args[index];
    if (currentArg === '--tool') {
      tool = normalizeTool(readValue(args, index, '--tool'));
      index += 1;
      continue;
    }
    if (currentArg === '--cwd') {
      cwd = readValue(args, index, '--cwd');
      index += 1;
      continue;
    }
    if (currentArg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (currentArg === '--force') {
      force = true;
      continue;
    }
    throw new Error(`未知参数: ${currentArg}`);
  }

  return {
    tool,
    cwd,
    dryRun,
    force,
  };
};

const parseInitOptions = (args: ReadonlyArray<string>): InitCommandOptions => {
  return parseSharedFlags(args);
};

const parseUpdateOptions = (args: ReadonlyArray<string>): UpdateCommandOptions => {
  const parsed = parseSharedFlags(args);
  return {
    tool: parsed.tool,
    cwd: parsed.cwd,
    dryRun: parsed.dryRun,
  };
};

const parseRemoveOptions = (args: ReadonlyArray<string>): RemoveCommandOptions => {
  const parsed = parseSharedFlags(args);
  return {
    tool: parsed.tool,
    cwd: parsed.cwd,
    dryRun: parsed.dryRun,
  };
};

const parseDoctorOptions = (args: ReadonlyArray<string>): DoctorOptions => {
  let cwd: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const currentArg = args[index];
    if (currentArg === '--cwd') {
      cwd = readValue(args, index, '--cwd');
      index += 1;
      continue;
    }
    throw new Error(`未知参数: ${currentArg}`);
  }

  return { cwd };
};

export const parseCliArgs = (rawArgs: ReadonlyArray<string>): ParsedCliCommand => {
  const [commandName, ...restArgs] = rawArgs;
  if (!commandName || commandName === 'help' || commandName === '--help' || commandName === '-h') {
    return { name: 'help' };
  }
  if (commandName === 'init' || commandName === 'setup-skills') {
    return {
      name: 'init',
      initOptions: parseInitOptions(restArgs),
    };
  }
  if (commandName === 'update') {
    return {
      name: 'update',
      updateOptions: parseUpdateOptions(restArgs),
    };
  }
  if (commandName === 'remove') {
    return {
      name: 'remove',
      removeOptions: parseRemoveOptions(restArgs),
    };
  }
  if (commandName === 'doctor') {
    return {
      name: 'doctor',
      doctorOptions: parseDoctorOptions(restArgs),
    };
  }
  throw new Error(`未知命令: ${commandName}`);
};

export const buildHelpText = (): string => {
  return [
    'websdk2-ai-kit',
    '',
    '用法:',
    '  websdk2-ai-kit init [--tool <auto|cursor|codex|agent|all>] [--cwd <path>] [--dry-run] [--force]',
    '  websdk2-ai-kit update [--tool <auto|cursor|codex|agent|all>] [--cwd <path>] [--dry-run]',
    '  websdk2-ai-kit remove [--tool <auto|cursor|codex|agent|all>] [--cwd <path>] [--dry-run]',
    '  websdk2-ai-kit doctor [--cwd <path>]',
  ].join('\n');
};
