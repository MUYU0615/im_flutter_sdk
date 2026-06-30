// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildGeneratedFiles } from '../../../packages/websdk2-ai-kit/src/shared/generated-files.js';

describe('ai-kit generated files', () => {
  it('agent skills 应从统一 metadata 生成 name、description 与标题', () => {
    const files = buildGeneratedFiles('/tmp/project', 'agent');
    const integration = files.find(file => file.relativePath.endsWith('websdk2-integration/SKILL.md'));

    expect(integration).toBeDefined();
    expect(integration?.content).toContain('name: websdk2-integration');
    expect(integration?.content).toContain(
      'description: Use when integrating im-sdk-web in an application project.'
    );
    expect(integration?.content).toContain('# websdk2 Integration Guide');
    expect(integration?.content).toContain(
      '[websdk2 Integration Documentation Index](../websdk2-references/generated/integration-index.md)'
    );
    expect(integration?.content).toContain(
      '[websdk2 API Reference Index](../websdk2-references/generated/api-reference-index.md)'
    );
    expect(integration?.content).toContain(
      '[websdk2 Manager Capabilities](../websdk2-references/manager-capabilities.md)'
    );
  });

  it('cursor rules 应包含 description、globs 与单个顶层标题', () => {
    const files = buildGeneratedFiles('/tmp/project', 'cursor');
    const debugRule = files.find(file => file.relativePath.endsWith('websdk2-debug.mdc'));
    const reference = files.find(file =>
      file.relativePath.endsWith('websdk2-references/error-catalog.md')
    );

    expect(debugRule).toBeDefined();
    expect(debugRule?.content).toContain(
      'description: Use when diagnosing im-sdk-web credential, E2E, CI, or routing failures.'
    );
    expect(debugRule?.content).toContain('globs: **/*.{ts,tsx,js,jsx,env,yml,yaml}');
    expect(debugRule?.content.startsWith('---\ndescription:')).toBe(true);
    expect(debugRule?.content).toContain(
      '\n---\n\n# websdk2 Debug Guide\n\nUse when diagnosing `im-sdk-web` credential, E2E, CI, or routing failures.\n\n## 常见错误码速查'
    );
    expect(reference?.content).toContain('# websdk2 Error Catalog');
  });

  it('codex prompts 应采用正式 frontmatter，并与 .codex/prompts 路径约定对齐', () => {
    const files = buildGeneratedFiles('/tmp/project', 'codex');
    const integrationPrompt = files.find(file => file.relativePath === '.codex/prompts/websdk2-integration.md');
    const apiPatternsPrompt = files.find(file => file.relativePath === '.codex/prompts/websdk2-api-patterns.md');
    const upgradePrompt = files.find(file => file.relativePath === '.codex/prompts/websdk2-upgrade.md');

    expect(integrationPrompt).toBeDefined();
    expect(integrationPrompt?.content.startsWith('---\nname: websdk2-integration\ndescription:')).toBe(
      true
    );
    expect(integrationPrompt?.content).toContain('# websdk2 Integration Guide');
    expect(integrationPrompt?.content).toContain('ChatClient.init');
    expect(apiPatternsPrompt?.content).toContain('# websdk2 API Patterns');
    expect(apiPatternsPrompt?.content).toContain(
      '[websdk2 Upgrade And Compatibility](websdk2-references/upgrade-and-compatibility.md)'
    );
    expect(upgradePrompt?.content).toContain('name: websdk2-upgrade');
    expect(upgradePrompt?.content).toContain('# websdk2 SDK Upgrade Guide');
    expect(upgradePrompt?.content).toContain(
      '[websdk2 Integration - 旧 SDK 迁移指南](websdk2-references/generated/integration/migration-guide.md)'
    );
    expect(upgradePrompt?.content).toContain(
      '[websdk2 API Reference Index](websdk2-references/generated/api-reference-index.md)'
    );
  });

  it('应把同步生成的详细集成文档和 API Reference 作为分层 references 安装', () => {
    const files = buildGeneratedFiles('/tmp/project', 'codex');
    const integrationDoc = files.find(
      file => file.relativePath === '.codex/prompts/websdk2-references/generated/integration/message-send.md'
    );
    const apiReference = files.find(
      file =>
        file.relativePath ===
        '.codex/prompts/websdk2-references/generated/api-reference/src-managers-chat-manager-ts.md'
    );

    expect(integrationDoc?.content).toContain('# 发送消息');
    expect(integrationDoc?.content).toContain('client.chatManager.createTextMessage');
    expect(apiReference?.content).toContain('## src/managers/chat-manager.ts');
    expect(apiReference?.content).toContain(
      'sendMessage(message: Message, options: SendMessageOptions)'
    );
  });
});
