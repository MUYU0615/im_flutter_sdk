import { resolve as resolvePath } from 'node:path';
import { WEBSDK2_SKILLS } from '../knowledge/index.js';
import type { SkillDefinition } from '../knowledge/types.js';
import type { GeneratedFile } from '../shared/types.js';
import { buildReferenceFiles, renderReferenceSection } from './shared.js';

const toCursorRule = (skill: SkillDefinition): string => {
  return `---\ndescription: ${skill.description}\nglobs: ${skill.cursorGlobs}\n---\n\n${skill.body}${renderReferenceSection('cursor', skill)}\n`;
};

export const buildCursorFiles = (projectRoot: string): ReadonlyArray<GeneratedFile> => {
  return [
    ...WEBSDK2_SKILLS.map(skill => ({
      tool: 'cursor' as const,
      absolutePath: resolvePath(projectRoot, `.cursor/rules/${skill.name}.mdc`),
      relativePath: `.cursor/rules/${skill.name}.mdc`,
      content: toCursorRule(skill),
    })),
    ...buildReferenceFiles(projectRoot, 'cursor'),
  ];
};
