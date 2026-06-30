// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  listReferenceMarkdownFiles,
  loadReferenceDocument,
  loadSkillDocument,
} from '../../../packages/websdk2-ai-kit/src/shared/markdown-content.js';

describe('ai-kit markdown content', () => {
  it('应从 Markdown frontmatter 读取 skill metadata 与正文', () => {
    const skill = loadSkillDocument('integration.md');

    expect(skill.id).toBe('integration');
    expect(skill.name).toBe('websdk2-integration');
    expect(skill.cursorGlobs).toBe('**/*.{ts,tsx,js,jsx}');
    expect(skill.referenceIds).toContain('generated/integration-index');
    expect(skill.referenceIds).toContain('generated/api-reference-index');
    expect(skill.referenceIds).toContain('manager-capabilities');
    expect(skill.body).toContain('# websdk2 Integration Guide');
    expect(skill.body).toContain('ChatClient.init');
  });

  it('应读取 SDK 升级 skill metadata 与迁移 reference', () => {
    const skill = loadSkillDocument('upgrade.md');

    expect(skill.id).toBe('upgrade');
    expect(skill.name).toBe('websdk2-upgrade');
    expect(skill.cursorGlobs).toBe('**/*.{ts,tsx,js,jsx,md}');
    expect(skill.referenceIds).toContain('generated/integration/migration-guide');
    expect(skill.referenceIds).toContain('generated/integration/whats-new');
    expect(skill.referenceIds).toContain('generated/api-reference-index');
    expect(skill.body).toContain('# websdk2 SDK Upgrade Guide');
    expect(skill.body).toContain('WebIM.message.create');
  });

  it('应能读取旧 SDK 迁移指南 reference', () => {
    const reference = loadReferenceDocument('generated/integration/migration-guide.md');

    expect(reference.id).toBe('generated/integration/migration-guide');
    expect(reference.title).toBe('websdk2 Integration - 旧 SDK 迁移指南');
    expect(reference.body).toContain('从旧 SDK 升级到新 SDK 迁移指南');
    expect(reference.body).toContain('WebIM.message.create');
  });

  it('应从 Markdown frontmatter 读取 reference metadata 与正文', () => {
    const reference = loadReferenceDocument('manager-capabilities.md');

    expect(reference.id).toBe('manager-capabilities');
    expect(reference.title).toBe('websdk2 Manager Capabilities');
    expect(reference.description).toContain('汇总各 manager 的职责');
    expect(reference.body).toContain('# websdk2 Manager Capabilities');
    expect(reference.body).toContain('ChatManager');
  });

  it('应递归发现由集成文档和 API Reference 同步生成的 reference', () => {
    const files = listReferenceMarkdownFiles();
    const integrationIndex = loadReferenceDocument('generated/integration-index.md');
    const apiIndex = loadReferenceDocument('generated/api-reference-index.md');
    const messageSend = loadReferenceDocument('generated/integration/message-send.md');
    const chatManagerApi = loadReferenceDocument('generated/api-reference/src-managers-chat-manager-ts.md');

    expect(files).toContain('generated/integration-index.md');
    expect(files).toContain('generated/api-reference-index.md');
    expect(files).toContain('generated/integration/message-send.md');
    expect(files).toContain('generated/api-reference/src-managers-chat-manager-ts.md');
    expect(integrationIndex.body).toContain('[发送消息](./integration/message-send.md)');
    expect(apiIndex.body).toContain('[ChatManager API](./api-reference/src-managers-chat-manager-ts.md)');
    expect(messageSend.body).toContain('client.chatManager.createTextMessage');
    expect(chatManagerApi.body).toContain('sendMessage(message: Message, options: SendMessageOptions)');
  });
});
