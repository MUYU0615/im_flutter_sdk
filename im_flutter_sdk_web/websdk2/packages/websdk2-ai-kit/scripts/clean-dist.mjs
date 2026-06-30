import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = resolve(fileURLToPath(new URL('.', import.meta.url)));
const packageRoot = resolve(scriptDir, '..');

rmSync(resolve(packageRoot, 'dist'), { recursive: true, force: true });
