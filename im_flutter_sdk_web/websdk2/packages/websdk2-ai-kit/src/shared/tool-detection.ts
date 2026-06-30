import { existsSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { SUPPORTED_TOOLS } from './constants.js';
import type { SupportedTool } from './types.js';

const TOOL_MARKERS: Readonly<Record<SupportedTool, ReadonlyArray<string>>> = {
  cursor: ['.cursor', '.cursorrules'],
  codex: ['.codex'],
  agent: ['.agent'],
};

export const detectProjectTools = (projectRoot: string): ReadonlyArray<SupportedTool> => {
  return SUPPORTED_TOOLS.filter(tool => {
    return TOOL_MARKERS[tool].some(marker => existsSync(resolvePath(projectRoot, marker)));
  });
};
