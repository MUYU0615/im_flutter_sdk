import { resolve as resolvePath } from 'node:path';
import { WEBSDK2_SKILLS } from '../knowledge/index.js';
import type { SkillDefinition } from '../knowledge/types.js';
import type { GeneratedFile } from '../shared/types.js';
import { buildReferenceFiles, renderReferenceSection } from './shared.js';

const toAgentSkill = (skill: SkillDefinition): string => {
  return `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n\n${skill.body}${renderReferenceSection('agent', skill)}\n`;
};

export const buildAgentFiles = (projectRoot: string): ReadonlyArray<GeneratedFile> => {
  return [
    ...WEBSDK2_SKILLS.map(skill => ({
      tool: 'agent' as const,
      absolutePath: resolvePath(projectRoot, `.agent/skills/${skill.name}/SKILL.md`),
      relativePath: `.agent/skills/${skill.name}/SKILL.md`,
      content: toAgentSkill(skill),
    })),
    ...buildReferenceFiles(projectRoot, 'agent'),
  ];
};
