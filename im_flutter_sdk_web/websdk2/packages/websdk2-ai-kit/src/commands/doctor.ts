import { existsSync } from 'node:fs';
import { resolveProjectRoot } from '../shared/project-root.js';
import { readManifest, resolveManifestPath } from '../shared/manifest.js';
import { readPackageMeta } from '../shared/package-meta.js';
import { buildGeneratedFiles } from '../shared/generated-files.js';
import { SUPPORTED_TOOLS } from '../shared/constants.js';
import { detectProjectTools } from '../shared/tool-detection.js';
import type { CommandIO, DoctorOptions, DoctorResult, SupportedTool } from '../shared/types.js';

const inspectTool = (
  projectRoot: string,
  tool: SupportedTool,
  detectedTools: ReadonlySet<SupportedTool>
): DoctorResult['tools'][number] => {
  const files = buildGeneratedFiles(projectRoot, tool).map(file => {
    return {
      path: file.relativePath,
      exists: existsSync(file.absolutePath),
    };
  });

  return {
    tool,
    detected: detectedTools.has(tool),
    installed: files.every(file => file.exists),
    files,
  };
};

export const runDoctor = (options: DoctorOptions, io?: CommandIO): DoctorResult => {
  const projectRoot = resolveProjectRoot(options.cwd);
  const manifestPath = resolveManifestPath(projectRoot);
  const manifest = readManifest(projectRoot);
  const detectedTools = detectProjectTools(projectRoot);
  const detectedSet = new Set(detectedTools);
  const tools = SUPPORTED_TOOLS.map(tool => inspectTool(projectRoot, tool, detectedSet));
  const currentVersion = readPackageMeta().version;
  const installedVersion = manifest?.packageVersion ?? null;
  const outdated = installedVersion !== null && installedVersion !== currentVersion;

  io?.stdout(`projectRoot=${projectRoot}`);
  io?.stdout(`manifest=${existsSync(manifestPath) ? 'present' : 'missing'} path=${manifestPath}`);
  io?.stdout(`detectedTools=${detectedTools.join(',') || '[none]'}`);
  if (manifest) {
    io?.stdout(`package=${manifest.packageName}@${installedVersion}`);
    io?.stdout(`currentVersion=${currentVersion} outdated=${outdated ? 'yes' : 'no'}`);
  }
  for (const tool of tools) {
    io?.stdout(
      `[${tool.tool}] detected=${tool.detected ? 'yes' : 'no'} installed=${tool.installed ? 'yes' : 'no'}`
    );
    for (const file of tool.files) {
      io?.stdout(`  - ${file.exists ? 'present' : 'missing'} ${file.path}`);
    }
  }

  return {
    projectRoot,
    manifestPath,
    manifestExists: existsSync(manifestPath),
    manifest,
    detectedTools,
    tools,
  };
};
