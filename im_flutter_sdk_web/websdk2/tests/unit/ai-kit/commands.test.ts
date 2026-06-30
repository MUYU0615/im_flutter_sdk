// @vitest-environment node
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runDoctor } from '../../../packages/websdk2-ai-kit/src/commands/doctor.js';
import { runInit } from '../../../packages/websdk2-ai-kit/src/commands/init.js';
import { runRemove } from '../../../packages/websdk2-ai-kit/src/commands/remove.js';
import { runUpdate } from '../../../packages/websdk2-ai-kit/src/commands/update.js';
import { buildGeneratedFiles } from '../../../packages/websdk2-ai-kit/src/shared/generated-files.js';

const tempDirs: string[] = [];

const createProjectRoot = (): string => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'websdk2-ai-kit-'));
  tempDirs.push(projectRoot);
  return projectRoot;
};

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('ai-kit commands', () => {
  it('dry-run init 不应写入文件', () => {
    const projectRoot = createProjectRoot();
    mkdirSync(join(projectRoot, '.cursor'), { recursive: true });

    const result = runInit({
      tool: 'auto',
      cwd: projectRoot,
      dryRun: true,
      force: false,
    });

    expect(result.installedFileCount).toBe(buildGeneratedFiles(projectRoot, 'cursor').length);
    expect(result.resolvedTools).toEqual(['cursor']);
    expect(runDoctor({ cwd: projectRoot }).manifestExists).toBe(false);
    expect(runDoctor({ cwd: projectRoot }).tools.find(tool => tool.tool === 'cursor')?.installed).toBe(false);
  });

  it('应写入 manifest 并可被 doctor 识别', () => {
    const projectRoot = createProjectRoot();
    mkdirSync(join(projectRoot, '.agent'), { recursive: true });

    const installResult = runInit({
      tool: 'auto',
      cwd: projectRoot,
      dryRun: false,
      force: false,
    });
    const doctorResult = runDoctor({ cwd: projectRoot });
    const expectedFiles = buildGeneratedFiles(projectRoot, 'agent')
      .map(file => file.relativePath)
      .sort();

    expect(installResult.installedFileCount).toBe(expectedFiles.length);
    expect(doctorResult.manifestExists).toBe(true);
    expect(doctorResult.detectedTools).toEqual(['agent']);
    expect(doctorResult.manifest?.tools).toEqual([
      {
        tool: 'agent',
        files: expectedFiles,
      },
    ]);

    const manifestText = readFileSync(installResult.manifestPath, 'utf8');
    expect(manifestText).toContain('"packageName": "@easemob/im-sdk-web-ai-kit"');
  });

  it('update 应强制覆盖已安装文件', () => {
    const projectRoot = createProjectRoot();
    mkdirSync(join(projectRoot, '.codex'), { recursive: true });

    runInit({
      tool: 'auto',
      cwd: projectRoot,
      dryRun: false,
      force: false,
    });

    const updateResult = runUpdate({
      tool: 'auto',
      cwd: projectRoot,
      dryRun: false,
    });

    expect(updateResult.resolvedTools).toEqual(['codex']);
    expect(updateResult.actions.every(action => action.status === 'overwrite')).toBe(true);
  });

  it('remove 只删除 manifest 管理的文件', () => {
    const projectRoot = createProjectRoot();
    mkdirSync(join(projectRoot, '.cursor'), { recursive: true });

    runInit({
      tool: 'auto',
      cwd: projectRoot,
      dryRun: false,
      force: false,
    });

    const removeResult = runRemove({
      tool: 'auto',
      cwd: projectRoot,
      dryRun: false,
    });

    expect(removeResult.resolvedTools).toEqual(['cursor']);
    expect(removeResult.removedFileCount).toBe(buildGeneratedFiles(projectRoot, 'cursor').length);
    expect(runDoctor({ cwd: projectRoot }).manifestExists).toBe(false);
  });
});
