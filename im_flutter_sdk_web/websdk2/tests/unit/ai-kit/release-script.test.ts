// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_CWD = process.cwd();
const tempDirs: string[] = [];

const createWorkspace = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'ai-kit-release-'));
  tempDirs.push(dir);
  mkdirSync(join(dir, 'packages/websdk2-ai-kit'), { recursive: true });
  return dir;
};

const writePackageJson = (filePath: string, name: string, version: string): void => {
  writeFileSync(
    filePath,
    `${JSON.stringify(
      {
        name,
        version,
      },
      null,
      2
    )}\n`,
    'utf8'
  );
};

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.chdir(ORIGINAL_CWD);
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
  vi.resetModules();
});

describe('ai-kit release script', () => {
  it('版本一致时应通过校验', async () => {
    const workspace = createWorkspace();
    writePackageJson(join(workspace, 'package.json'), 'im-sdk-web', '1.2.3');
    writePackageJson(
      join(workspace, 'packages/websdk2-ai-kit/package.json'),
      '@easemob/im-sdk-web-ai-kit',
      '1.2.3'
    );
    process.chdir(workspace);

    const { ensureAiKitVersionAligned } = await import('../../../scripts/release/ai-kit-release.mjs');

    expect(ensureAiKitVersionAligned()).toEqual({
      rootPackage: {
        name: 'im-sdk-web',
        version: '1.2.3',
      },
      aiKitPackage: {
        name: '@easemob/im-sdk-web-ai-kit',
        version: '1.2.3',
      },
    });
  });

  it('版本不一致时应抛错', async () => {
    const workspace = createWorkspace();
    writePackageJson(join(workspace, 'package.json'), 'im-sdk-web', '1.2.3');
    writePackageJson(
      join(workspace, 'packages/websdk2-ai-kit/package.json'),
      '@easemob/im-sdk-web-ai-kit',
      '1.2.4'
    );
    process.chdir(workspace);

    const { ensureAiKitVersionAligned } = await import('../../../scripts/release/ai-kit-release.mjs');

    expect(() => ensureAiKitVersionAligned()).toThrow('版本不一致');
  });
});
