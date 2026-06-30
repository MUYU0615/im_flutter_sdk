import type { AiKitManifest, RequestedTool, SupportedTool } from './types.js';
import { SUPPORTED_TOOLS } from './constants.js';
import { detectProjectTools } from './tool-detection.js';

const uniqueTools = (tools: ReadonlyArray<SupportedTool>): ReadonlyArray<SupportedTool> => {
  return Array.from(new Set(tools));
};

export const resolveRequestedTools = (
  projectRoot: string,
  requestedTool: RequestedTool,
  manifest: AiKitManifest | null
): ReadonlyArray<SupportedTool> => {
  if (requestedTool === 'all') {
    return SUPPORTED_TOOLS;
  }
  if (requestedTool !== 'auto') {
    return [requestedTool];
  }

  const manifestTools = uniqueTools((manifest?.tools ?? []).map(entry => entry.tool));
  if (manifestTools.length > 0) {
    return manifestTools;
  }

  const detectedTools = detectProjectTools(projectRoot);
  if (detectedTools.length > 0) {
    return detectedTools;
  }

  throw new Error(
    '未检测到受支持的 AI 工具目录，请先创建 .cursor/.codex/.agent，或使用 --tool 显式指定。'
  );
};
