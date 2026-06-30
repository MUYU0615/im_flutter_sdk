import type { GeneratedFile, SupportedTool } from './types.js';
import { buildAgentFiles } from '../templates/agent.js';
import { buildCodexFiles } from '../templates/codex.js';
import { buildCursorFiles } from '../templates/cursor.js';

export const buildGeneratedFiles = (
  projectRoot: string,
  tool: SupportedTool
): ReadonlyArray<GeneratedFile> => {
  if (tool === 'cursor') {
    return buildCursorFiles(projectRoot);
  }
  if (tool === 'codex') {
    return buildCodexFiles(projectRoot);
  }
  return buildAgentFiles(projectRoot);
};
