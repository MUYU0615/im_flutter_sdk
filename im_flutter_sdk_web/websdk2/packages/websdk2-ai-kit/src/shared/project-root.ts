import { existsSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';

const PROJECT_ROOT_MARKERS = ['.git', 'package.json'] as const;

export const resolveProjectRoot = (cwd?: string): string => {
  let currentDir = resolvePath(cwd ?? process.cwd());
  while (true) {
    const hasMarker = PROJECT_ROOT_MARKERS.some(marker => {
      return existsSync(resolvePath(currentDir, marker));
    });
    if (hasMarker) {
      return currentDir;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      return resolvePath(cwd ?? process.cwd());
    }
    currentDir = parentDir;
  }
};
