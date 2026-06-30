import { resolve as resolvePath } from 'node:path';
import { WEBSDK2_REFERENCES } from '../references/index.js';
import type { SkillDefinition, ReferenceDocument } from '../knowledge/types.js';
import type { GeneratedFile, SupportedTool } from '../shared/types.js';

const resolveReferencePath = (reference: ReferenceDocument): string => {
  return `${reference.id}.md`;
};

const resolveReferenceDirectory = (tool: SupportedTool): string => {
  if (tool === 'cursor') {
    return '.cursor/rules/websdk2-references';
  }
  if (tool === 'codex') {
    return '.codex/prompts/websdk2-references';
  }
  return '.agent/skills/websdk2-references';
};

const resolveReferenceLinkPrefix = (tool: SupportedTool): string => {
  if (tool === 'agent') {
    return '../websdk2-references';
  }
  return 'websdk2-references';
};

export const buildReferenceFiles = (
  projectRoot: string,
  tool: SupportedTool
): ReadonlyArray<GeneratedFile> => {
  const baseDir = resolveReferenceDirectory(tool);
  return WEBSDK2_REFERENCES.map(reference => ({
    tool,
    absolutePath: resolvePath(projectRoot, baseDir, resolveReferencePath(reference)),
    relativePath: `${baseDir}/${resolveReferencePath(reference)}`,
    content: renderReferenceDocument(reference),
  }));
};

const renderReferenceDocument = (reference: ReferenceDocument): string => {
  return `${reference.body}\n`;
};

export const renderReferenceSection = (
  tool: SupportedTool,
  skill: SkillDefinition
): string => {
  if (skill.referenceIds.length === 0) {
    return '';
  }

  const prefix = resolveReferenceLinkPrefix(tool);
  const lines = skill.referenceIds
    .map(referenceId => WEBSDK2_REFERENCES.find(reference => reference.id === referenceId))
    .filter((reference): reference is ReferenceDocument => reference !== undefined)
    .map(reference => {
      return `- [${reference.title}](${prefix}/${resolveReferencePath(reference)}): ${reference.description}`;
    });

  return `\n\n## References\n\n${lines.join('\n')}`;
};
