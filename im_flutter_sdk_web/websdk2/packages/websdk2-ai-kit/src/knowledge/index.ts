import { loadSkillDocument } from '../shared/markdown-content.js';

const SKILL_FILES = [
  'integration.md',
  'debug.md',
  'upgrade.md',
  'api-patterns.md',
  'platform-differences.md',
  'ci-testing.md',
] as const;

export const WEBSDK2_SKILLS = SKILL_FILES.map(fileName => loadSkillDocument(fileName));
