import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import type { AiKitManifest, SupportedTool, ToolManifestEntry } from './types.js';
import { MANIFEST_RELATIVE_PATH } from './constants.js';
import { readPackageMeta } from './package-meta.js';

export const resolveManifestPath = (projectRoot: string): string => {
  return resolvePath(projectRoot, MANIFEST_RELATIVE_PATH);
};

export const readManifest = (projectRoot: string): AiKitManifest | null => {
  const manifestPath = resolveManifestPath(projectRoot);
  if (!existsSync(manifestPath)) {
    return null;
  }

  const raw = readFileSync(manifestPath, 'utf8');
  return JSON.parse(raw) as AiKitManifest;
};

const mergeToolEntries = (
  existing: ReadonlyArray<ToolManifestEntry>,
  nextFilesByTool: ReadonlyMap<SupportedTool, ReadonlyArray<string>>
): ReadonlyArray<ToolManifestEntry> => {
  const merged = new Map<SupportedTool, Set<string>>();

  for (const entry of existing) {
    merged.set(entry.tool, new Set(entry.files));
  }

  for (const [tool, files] of nextFilesByTool.entries()) {
    const currentFiles = merged.get(tool) ?? new Set<string>();
    for (const file of files) {
      currentFiles.add(file);
    }
    merged.set(tool, currentFiles);
  }

  return Array.from(merged.entries()).map(([tool, files]) => {
    return {
      tool,
      files: Array.from(files).sort(),
    };
  });
};

export const writeManifest = (
  projectRoot: string,
  filesByTool: ReadonlyMap<SupportedTool, ReadonlyArray<string>>
): string => {
  const manifestPath = resolveManifestPath(projectRoot);
  const existingManifest = readManifest(projectRoot);
  const packageMeta = readPackageMeta();
  const manifest: AiKitManifest = {
    packageName: packageMeta.name,
    packageVersion: packageMeta.version,
    installedAt: new Date().toISOString(),
    projectRoot,
    tools: mergeToolEntries(existingManifest?.tools ?? [], filesByTool),
  };

  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifestPath;
};

export const rewriteManifestTools = (
  projectRoot: string,
  tools: ReadonlyArray<ToolManifestEntry>
): string | null => {
  const manifestPath = resolveManifestPath(projectRoot);
  if (tools.length === 0) {
    if (existsSync(manifestPath)) {
      rmSync(manifestPath, { force: true });
    }
    return null;
  }

  const packageMeta = readPackageMeta();
  const manifest: AiKitManifest = {
    packageName: packageMeta.name,
    packageVersion: packageMeta.version,
    installedAt: new Date().toISOString(),
    projectRoot,
    tools,
  };

  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifestPath;
};
