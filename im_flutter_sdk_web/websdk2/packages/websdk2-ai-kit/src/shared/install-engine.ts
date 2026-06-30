import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { buildGeneratedFiles } from './generated-files.js';
import { readManifest, resolveManifestPath, writeManifest } from './manifest.js';
import { resolveProjectRoot } from './project-root.js';
import { resolveRequestedTools } from './tool-resolution.js';
import { detectProjectTools } from './tool-detection.js';
import type {
  CommandIO,
  GeneratedFile,
  InitCommandOptions,
  InstallAction,
  InstallResult,
  SupportedTool,
  UpdateCommandOptions,
} from './types.js';

const resolveInstallTools = (
  projectRoot: string,
  options: InitCommandOptions | UpdateCommandOptions
): ReadonlyArray<SupportedTool> => {
  const manifest = readManifest(projectRoot);
  if (options.tool !== 'auto') {
    return resolveRequestedTools(projectRoot, options.tool, manifest);
  }

  const manifestTools = (manifest?.tools ?? []).map(entry => entry.tool);
  const detectedTools = detectProjectTools(projectRoot);
  const mergedTools = Array.from(new Set([...detectedTools, ...manifestTools]));
  if (mergedTools.length > 0) {
    return mergedTools;
  }

  throw new Error(
    '未检测到受支持的 AI 工具目录，请先创建 .cursor/.codex/.agent，或使用 --tool 显式指定。'
  );
};

const applyGeneratedFile = (
  file: GeneratedFile,
  force: boolean,
  dryRun: boolean
): InstallAction => {
  const exists = existsSync(file.absolutePath);
  if (exists && !force) {
    return {
      tool: file.tool,
      relativePath: file.relativePath,
      status: 'skip',
    };
  }

  if (!dryRun) {
    mkdirSync(dirname(file.absolutePath), { recursive: true });
    writeFileSync(file.absolutePath, file.content, 'utf8');
  }

  return {
    tool: file.tool,
    relativePath: file.relativePath,
    status: exists ? 'overwrite' : 'create',
  };
};

const groupInstalledFiles = (
  actions: ReadonlyArray<InstallAction>
): ReadonlyMap<SupportedTool, ReadonlyArray<string>> => {
  const grouped = new Map<SupportedTool, string[]>();
  for (const action of actions) {
    if (action.status === 'skip') {
      continue;
    }
    const files = grouped.get(action.tool) ?? [];
    files.push(action.relativePath);
    grouped.set(action.tool, files);
  }
  return grouped;
};

const runInstall = (
  options: InitCommandOptions | UpdateCommandOptions,
  force: boolean,
  io?: CommandIO
): InstallResult => {
  const projectRoot = resolveProjectRoot(options.cwd);
  const resolvedTools = resolveInstallTools(projectRoot, options);
  const generatedFiles = resolvedTools.flatMap(tool => buildGeneratedFiles(projectRoot, tool));
  const actions = generatedFiles.map(file => applyGeneratedFile(file, force, options.dryRun));
  const manifestPath = resolveManifestPath(projectRoot);
  const installedFilesByTool = groupInstalledFiles(actions);

  if (!options.dryRun && installedFilesByTool.size > 0) {
    writeManifest(projectRoot, installedFilesByTool);
  }

  io?.stdout(`projectRoot=${projectRoot}`);
  io?.stdout(`resolvedTools=${resolvedTools.join(',')}`);
  for (const action of actions) {
    io?.stdout(`[${action.tool}] ${action.status}: ${action.relativePath}`);
  }
  if (options.dryRun) {
    io?.stdout('dry-run 完成，未写入文件。');
  } else if (installedFilesByTool.size === 0) {
    io?.stdout(force ? '未生成新的写入动作。' : '未写入新文件；如需覆盖现有文件，请添加 --force。');
  } else {
    io?.stdout(`manifest: ${manifestPath}`);
  }

  return {
    projectRoot,
    manifestPath,
    dryRun: options.dryRun,
    resolvedTools,
    actions,
    installedFileCount: actions.filter(action => action.status !== 'skip').length,
  };
};

export const runInitInstall = (
  options: InitCommandOptions,
  io?: CommandIO
): InstallResult => {
  return runInstall(options, options.force, io);
};

export const runUpdateInstall = (
  options: UpdateCommandOptions,
  io?: CommandIO
): InstallResult => {
  const projectRoot = resolveProjectRoot(options.cwd);
  const manifest = readManifest(projectRoot);
  const resolvedTools = resolveInstallTools(projectRoot, options);
  const generatedFiles = resolvedTools.flatMap(tool => buildGeneratedFiles(projectRoot, tool));
  const currentPaths = new Set(generatedFiles.map(f => f.relativePath));

  // 清理 manifest 中记录但当前版本不再生成的旧文件
  if (manifest && !options.dryRun) {
    for (const entry of manifest.tools) {
      if (!new Set(resolvedTools).has(entry.tool)) {
        continue;
      }
      for (const oldPath of entry.files) {
        if (!currentPaths.has(oldPath)) {
          const abs = resolvePath(projectRoot, oldPath);
          if (existsSync(abs)) {
            rmSync(abs, { force: true });
            io?.stdout(`[${entry.tool}] remove(obsolete): ${oldPath}`);
          }
        }
      }
    }
  }

  const actions = generatedFiles.map(file => applyGeneratedFile(file, true, options.dryRun));
  const manifestPath = resolveManifestPath(projectRoot);
  const installedFilesByTool = groupInstalledFiles(actions);

  if (!options.dryRun && installedFilesByTool.size > 0) {
    writeManifest(projectRoot, installedFilesByTool);
  }

  io?.stdout(`projectRoot=${projectRoot}`);
  io?.stdout(`resolvedTools=${resolvedTools.join(',')}`);
  for (const action of actions) {
    io?.stdout(`[${action.tool}] ${action.status}: ${action.relativePath}`);
  }
  if (options.dryRun) {
    io?.stdout('dry-run 完成，未写入文件。');
  } else if (installedFilesByTool.size === 0) {
    io?.stdout('未生成新的写入动作。');
  } else {
    io?.stdout(`manifest: ${manifestPath}`);
  }

  return {
    projectRoot,
    manifestPath,
    dryRun: options.dryRun,
    resolvedTools,
    actions,
    installedFileCount: actions.filter(action => action.status !== 'skip').length,
  };
};
