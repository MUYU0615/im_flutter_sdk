import { existsSync, rmSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { readManifest, resolveManifestPath, rewriteManifestTools } from '../shared/manifest.js';
import { resolveProjectRoot } from '../shared/project-root.js';
import { resolveRequestedTools } from '../shared/tool-resolution.js';
import type {
  CommandIO,
  RemoveAction,
  RemoveCommandOptions,
  RemoveResult,
  ToolManifestEntry,
} from '../shared/types.js';

const pruneEmptyParents = (startDir: string, projectRoot: string): void => {
  let currentDir = startDir;
  while (currentDir.startsWith(projectRoot) && currentDir !== projectRoot) {
    try {
      rmSync(currentDir, { recursive: false });
    } catch {
      break;
    }
    currentDir = dirname(currentDir);
  }
};

export const runRemove = (
  options: RemoveCommandOptions,
  io?: CommandIO
): RemoveResult => {
  const projectRoot = resolveProjectRoot(options.cwd);
  const manifest = readManifest(projectRoot);
  if (!manifest) {
    throw new Error('未找到已安装的 AI kit manifest，无法执行 remove。');
  }

  const resolvedTools = resolveRequestedTools(projectRoot, options.tool, manifest);
  const toolSet = new Set(resolvedTools);
  const actions: RemoveAction[] = [];
  const nextToolEntries: ToolManifestEntry[] = [];

  for (const entry of manifest.tools) {
    if (!toolSet.has(entry.tool)) {
      nextToolEntries.push(entry);
      continue;
    }

    for (const relativePath of entry.files) {
      const absolutePath = resolvePath(projectRoot, relativePath);
      const exists = existsSync(absolutePath);
      if (!options.dryRun && exists) {
        rmSync(absolutePath, { force: true });
        pruneEmptyParents(dirname(absolutePath), projectRoot);
      }
      actions.push({
        tool: entry.tool,
        relativePath,
        status: options.dryRun ? 'skip' : exists ? 'remove' : 'missing',
      });
    }
  }

  const manifestPath = resolveManifestPath(projectRoot);
  if (!options.dryRun) {
    rewriteManifestTools(projectRoot, nextToolEntries);
  }

  io?.stdout(`projectRoot=${projectRoot}`);
  io?.stdout(`resolvedTools=${resolvedTools.join(',')}`);
  for (const action of actions) {
    io?.stdout(`[${action.tool}] ${action.status}: ${action.relativePath}`);
  }
  if (options.dryRun) {
    io?.stdout('dry-run 完成，未删除文件。');
  } else {
    io?.stdout(nextToolEntries.length > 0 ? `manifest: ${manifestPath}` : 'manifest 已清理。');
  }

  return {
    projectRoot,
    manifestPath,
    dryRun: options.dryRun,
    resolvedTools,
    actions,
    removedFileCount: actions.filter(action => action.status === 'remove').length,
  };
};
