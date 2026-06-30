// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runInit } from '../../../packages/websdk2-ai-kit/src/commands/init.js';
import { runRemove } from '../../../packages/websdk2-ai-kit/src/commands/remove.js';

const tempDirs: string[] = [];

const createProjectRoot = (): string => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'websdk2-ai-kit-int-'));
  tempDirs.push(projectRoot);
  return projectRoot;
};

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('setup-skills integration', () => {
  it('应在临时工作区自动检测并安装 cursor 规则', () => {
    const projectRoot = createProjectRoot();
    mkdirSync(join(projectRoot, '.cursor'), { recursive: true });

    runInit({
      tool: 'auto',
      cwd: projectRoot,
      dryRun: false,
      force: false,
    });

    const integrationRulePath = join(projectRoot, '.cursor/rules/websdk2-integration.mdc');
    const debugRulePath = join(projectRoot, '.cursor/rules/websdk2-debug.mdc');
    const upgradeRulePath = join(projectRoot, '.cursor/rules/websdk2-upgrade.mdc');
    const apiPatternsRulePath = join(projectRoot, '.cursor/rules/websdk2-api-patterns.mdc');
    const referencePath = join(projectRoot, '.cursor/rules/websdk2-references/manager-capabilities.md');
    const migrationReferencePath = join(
      projectRoot,
      '.cursor/rules/websdk2-references/generated/integration/migration-guide.md'
    );
    const integrationReferencePath = join(
      projectRoot,
      '.cursor/rules/websdk2-references/generated/integration/message-send.md'
    );
    const apiReferencePath = join(
      projectRoot,
      '.cursor/rules/websdk2-references/generated/api-reference/src-managers-chat-manager-ts.md'
    );
    const integrationRule = readFileSync(integrationRulePath, 'utf8');
    const debugRule = readFileSync(debugRulePath, 'utf8');
    const upgradeRule = readFileSync(upgradeRulePath, 'utf8');

    expect(existsSync(integrationRulePath)).toBe(true);
    expect(existsSync(debugRulePath)).toBe(true);
    expect(existsSync(upgradeRulePath)).toBe(true);
    expect(existsSync(apiPatternsRulePath)).toBe(true);
    expect(existsSync(referencePath)).toBe(true);
    expect(existsSync(migrationReferencePath)).toBe(true);
    expect(existsSync(integrationReferencePath)).toBe(true);
    expect(existsSync(apiReferencePath)).toBe(true);
    expect(integrationRule).toContain('description: Use when integrating im-sdk-web in an application project.');
    expect(integrationRule).toContain('globs: **/*.{ts,tsx,js,jsx}');
    expect(integrationRule).toContain('ChatClient');
    expect(integrationRule).toContain('websdk2-references/generated/integration-index.md');
    expect(readFileSync(integrationReferencePath, 'utf8')).toContain(
      'client.chatManager.createTextMessage'
    );
    expect(readFileSync(apiReferencePath, 'utf8')).toContain(
      'sendMessage(message: Message, options: SendMessageOptions)'
    );
    expect(debugRule).toContain('description: Use when diagnosing im-sdk-web credential, E2E, CI, or routing failures.');
    expect(debugRule).toContain('Provision rejected');
    expect(upgradeRule).toContain('description: Use when upgrading from the old Easemob Web SDK to im-sdk-web');
    expect(upgradeRule).toContain('WebIM.message.create');
    expect(readFileSync(migrationReferencePath, 'utf8')).toContain('从旧 SDK 升级到新 SDK 迁移指南');
  });

  it('应在临时工作区安装 codex prompts，并可被 remove 清理', () => {
    const projectRoot = createProjectRoot();
    mkdirSync(join(projectRoot, '.codex'), { recursive: true });

    runInit({
      tool: 'auto',
      cwd: projectRoot,
      dryRun: false,
      force: false,
    });

    const integrationPromptPath = join(projectRoot, '.codex/prompts/websdk2-integration.md');
    const debugPromptPath = join(projectRoot, '.codex/prompts/websdk2-debug.md');
    const upgradePromptPath = join(projectRoot, '.codex/prompts/websdk2-upgrade.md');
    const platformPromptPath = join(projectRoot, '.codex/prompts/websdk2-platform-differences.md');
    const referencePath = join(projectRoot, '.codex/prompts/websdk2-references/real-env-credentials.md');
    const integrationReferencePath = join(
      projectRoot,
      '.codex/prompts/websdk2-references/generated/integration/message-send.md'
    );
    const integrationPrompt = readFileSync(integrationPromptPath, 'utf8');
    const debugPrompt = readFileSync(debugPromptPath, 'utf8');
    const upgradePrompt = readFileSync(upgradePromptPath, 'utf8');

    expect(existsSync(integrationPromptPath)).toBe(true);
    expect(existsSync(debugPromptPath)).toBe(true);
    expect(existsSync(upgradePromptPath)).toBe(true);
    expect(existsSync(platformPromptPath)).toBe(true);
    expect(existsSync(referencePath)).toBe(true);
    expect(existsSync(integrationReferencePath)).toBe(true);
    expect(integrationPrompt).toContain('name: websdk2-integration');
    expect(integrationPrompt).toContain(
      'description: Use when integrating im-sdk-web in an application project.'
    );
    expect(debugPrompt).toContain('name: websdk2-debug');
    expect(upgradePrompt).toContain('name: websdk2-upgrade');
    expect(upgradePrompt).toContain('WebIM.message.create');

    runRemove({
      tool: 'codex',
      cwd: projectRoot,
      dryRun: false,
    });

    expect(existsSync(integrationPromptPath)).toBe(false);
    expect(existsSync(debugPromptPath)).toBe(false);
    expect(existsSync(upgradePromptPath)).toBe(false);
    expect(existsSync(platformPromptPath)).toBe(false);
    expect(existsSync(referencePath)).toBe(false);
    expect(existsSync(integrationReferencePath)).toBe(false);
  });
});
