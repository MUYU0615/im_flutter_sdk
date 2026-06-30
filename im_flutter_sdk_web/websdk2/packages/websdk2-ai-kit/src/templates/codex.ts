import { resolve as resolvePath } from 'node:path';
import { WEBSDK2_SKILLS } from '../knowledge/index.js';
import type { SkillDefinition } from '../knowledge/types.js';
import type { GeneratedFile } from '../shared/types.js';
import { buildReferenceFiles, renderReferenceSection } from './shared.js';

const toCodexPrompt = (skill: SkillDefinition): string => {
  return `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n\n${skill.body}${renderReferenceSection('codex', skill)}\n`;
};

export const buildCodexFiles = (projectRoot: string): ReadonlyArray<GeneratedFile> => {
  return [
    ...WEBSDK2_SKILLS.map(skill => ({
      tool: 'codex' as const,
      absolutePath: resolvePath(projectRoot, `.codex/prompts/${skill.name}.md`),
      relativePath: `.codex/prompts/${skill.name}.md`,
      content: toCodexPrompt(skill),
    })),
    ...buildReferenceFiles(projectRoot, 'codex'),
  ];
};
