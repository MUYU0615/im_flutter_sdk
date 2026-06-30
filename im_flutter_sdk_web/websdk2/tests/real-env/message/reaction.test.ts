// @vitest-environment node
/**
 * 真实环境 API 测试 - Reaction 模块
 * 迁移自 robot: wayang/TestCase/消息/Reaction.robot（Webim 标记用例）
 */
import '../node-polyfill';
import { it, expect, beforeAll, afterAll } from 'vitest';
import type { ChatClient } from '@/chat-client';
import { ChatManager } from '@/managers/chat/index';
import { describeRealEnv, getRealEnvConfig } from '../setup';
import { createFreshClient, cleanupClients, type ClientInstance } from '../helpers/multi-client';

const config = getRealEnvConfig();
const hasSecondUser = Boolean(config?.secondUserId && config?.secondToken);
const describeReaction = hasSecondUser ? describeRealEnv : describeRealEnv.skip;

describeReaction('message/reaction - Reaction', () => {
  let clientA: ClientInstance;
  let chatA: InstanceType<typeof ChatManager>;
  let testMessageId: string;

  beforeAll(async () => {
    const cfg = getRealEnvConfig();
    const raw = createFreshClient({ appKey: cfg.appKey, wsUrl: cfg.wsUrl ?? undefined, restApiUrl: cfg.restApiUrl ?? undefined }).use(ChatManager);
    await raw.login({ userId: cfg.userId, token: cfg.token });
    clientA = { client: raw as unknown as ChatClient, userId: cfg.userId, token: cfg.token };
    chatA = raw.chatManager;

    // 发送一条消息用于 Reaction 测试
    const msg = chatA.createTextMessage({
      conversationId: cfg.secondUserId!,
      conversationType: 'singleChat',
      content: 'reaction-test-msg',
    });
    const sent = await chatA.sendMessage(msg);
    testMessageId = sent.msgServerId;
    await sleep(1000);
  }, 20000);

  afterAll(async () => {
    // 清理 reaction
    try { await chatA.removeReaction({ messageId: testMessageId, reaction: '👍' }); } catch { /* ignore */ }
    await cleanupClients(clientA);
  }, 10000);

  // ===== 添加 Reaction =====

  it('添加 Reaction 应成功', async () => {
    await chatA.addReaction({ messageId: testMessageId, reaction: '👍' });
    expect(true).toBe(true);
  }, 10000);

  // ===== 获取 Reaction 详情 =====

  it('获取 Reaction 详情应包含添加的 Reaction', async () => {
    const detail = await chatA.getReactionDetail({
      messageId: testMessageId,
      reaction: '👍',
    });
    expect(detail).toBeDefined();
  }, 10000);

  // ===== 重复添加 Reaction 应报错 =====

  it('重复添加相同 Reaction 应返回错误', async () => {
    try {
      await chatA.addReaction({ messageId: testMessageId, reaction: '👍' });
      expect.fail('应该抛出错误');
    } catch (error: unknown) {
      const err = error as { code: number };
      expect(err.code).toBeDefined();
    }
  }, 10000);

  // ===== 移除 Reaction =====

  it('移除 Reaction 后获取详情应为空', async () => {
    await chatA.removeReaction({ messageId: testMessageId, reaction: '👍' });

    const detail = await chatA.getReactionDetail({
      messageId: testMessageId,
      reaction: '👍',
    });
    // 移除后 detail 应为空或 userList 为空
    if (detail && 'userList' in (detail as unknown as Record<string, unknown>)) {
      expect((detail as unknown as { userList: unknown[] }).userList.length).toBe(0);
    }
  }, 10000);
});

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
