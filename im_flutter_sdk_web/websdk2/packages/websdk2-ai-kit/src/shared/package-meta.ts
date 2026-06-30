import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

interface PackageMeta {
  readonly name: string;
  readonly version: string;
}

const findPackageMetaPath = (): string => {
  const currentFile = fileURLToPath(import.meta.url);
  let currentDir = dirname(currentFile);
  while (true) {
    const candidate = resolvePath(currentDir, 'package.json');
    if (existsSync(candidate)) {
      const raw = readFileSync(candidate, 'utf8');
      const parsed = JSON.parse(raw) as Partial<PackageMeta>;
      if (parsed.name === '@easemob/im-sdk-web-ai-kit') {
        return candidate;
      }
    }
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      throw new Error('未找到 AI kit package.json');
    }
    currentDir = parentDir;
  }
};

export const resolvePackageRoot = (): string => {
  return dirname(findPackageMetaPath());
};

export const readPackageMeta = (): PackageMeta => {
  const raw = readFileSync(findPackageMetaPath(), 'utf8');
  const parsed = JSON.parse(raw) as Partial<PackageMeta>;
  if (!parsed.name || !parsed.version) {
    throw new Error('AI kit package.json 缺少 name/version');
  }
  return {
    name: parsed.name,
    version: parsed.version,
  };
};
