// @vitest-environment node

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import viteConfigFactory from '../../vite.config';

interface PackageExportsEntry {
  readonly import?: string;
  readonly require?: string;
  readonly types?: string;
}

interface PackageJsonShape {
  readonly exports?: Record<string, PackageExportsEntry>;
}

const PACKAGE_JSON_PATH = resolve(process.cwd(), 'package.json');
const MANAGERS_DIR = resolve(process.cwd(), 'src/managers');
const KNOWN_MANAGER_NAMES = [
  'chat',
  'chat-thread',
  'chatroom',
  'contact',
  'group',
  'presence',
  'push',
  'user-info',
] as const;

const getManagerNamesFromSource = (): string[] => {
  return readdirSync(MANAGERS_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .filter(name => {
      try {
        readFileSync(resolve(MANAGERS_DIR, name, 'index.ts'), 'utf8');
        return true;
      } catch {
        return false;
      }
    })
    .sort();
};

const getPackageExports = (): Record<string, PackageExportsEntry> => {
  const content = readFileSync(PACKAGE_JSON_PATH, 'utf8');
  const pkg = JSON.parse(content) as PackageJsonShape;
  return pkg.exports ?? {};
};

const getModuleEntries = (): Record<string, string> => {
  const configFactory = viteConfigFactory as (
    env: { command: 'build' | 'serve'; mode: string }
  ) => {
    readonly build?: {
      readonly lib?: {
        readonly entry?: Record<string, string>;
      };
    };
  };
  const config = configFactory({ command: 'build', mode: 'production' });
  return config.build?.lib?.entry ?? {};
};

describe('manager exports contract', () => {
  it('源码中存在 index.ts 的 manager 入口必须全部出现在已知公开列表中', () => {
    expect(getManagerNamesFromSource()).toEqual([...KNOWN_MANAGER_NAMES]);
  });

  it('package.json exports 必须覆盖所有 manager 子路径', () => {
    const exportsMap = getPackageExports();

    for (const managerName of KNOWN_MANAGER_NAMES) {
      expect(exportsMap[`./managers/${managerName}`]).toEqual({
        import: `./dist/managers/${managerName}/index.js`,
        require: `./dist/managers/${managerName}/index.cjs`,
        types: `./dist/managers/${managerName}/index.d.ts`,
      });
    }

    expect(exportsMap['./managers/channel']).toBeUndefined();
  });

  it('vite 多入口构建必须覆盖所有 manager 子路径', () => {
    const moduleEntries = getModuleEntries();

    for (const managerName of KNOWN_MANAGER_NAMES) {
      expect(moduleEntries[`managers/${managerName}/index`]).toBe(
        resolve(process.cwd(), `src/managers/${managerName}/index.ts`)
      );
    }

    expect(moduleEntries['managers/channel/index']).toBeUndefined();
  });
});
