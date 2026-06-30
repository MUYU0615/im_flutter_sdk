// @vitest-environment node
/**
 * 真实环境 API 测试 - 会话管理模块
 * 迁移自 robot: wayang/TestCase/会话/会话.robot（Webim 标记用例）
 */
import '../node-polyfill';
import { it, expect, beforeAll, afterAll } from 'vitest';
import type { ChatClient } from '@/chat-client';
import { ChatManager } from '@/managers/chat/index';
import { describeRealEnv, getRealEnvConfig } from '../setup';
import { createFreshClient, cleanupClients, type ClientInstance } from '../helpers/multi-client';

const config = getRealEnvConfig();
const hasSecondUser = Boolean(config?.secondUserId && config?.secondToken);
const describeConversation = hasSecondUser ? describeRealEnv : describeRealEnv.skip;

describeConversation('conversation - 会话管理', () => {
  let clientA: ClientInstance;
  let chatMgr: InstanceType<typeof ChatManager>;

  beforeAll(async () => {
    const cfg = getRealEnvConfig();
    const raw = createFreshClient({ appKey: cfg.appKey, wsUrl: cfg.wsUrl ?? undefined, restApiUrl: cfg.restApiUrl ?? undefined }).use(ChatManager);
    await raw.login({ userId: cfg.userId, token: cfg.token });
    clientA = { client: raw as unknown as ChatClient, userId: cfg.userId, token: cfg.token };
    chatMgr = raw.chatManager;

    // 发送一条消息确保有会话存在
    const msg = chatMgr.createTextMessage({
      conversationId: cfg.secondUserId!,
      conversationType: 'singleChat',
      content: 'ensure-conversation-exists',
    });
    await chatMgr.sendMessage(msg);
    await sleep(1000);
  }, 20000);

  afterAll(async () => {
    await cleanupClients(clientA);
  }, 10000);

  // ===== 置顶/取消置顶会话(Webim) =====

  it('置顶会话 → 取消置顶', async () => {
    const cfg = getRealEnvConfig();

    // 置顶
    await chatMgr.setConversationPinned({
      conversationId: cfg.secondUserId!,
      conversationType: 'singleChat',
      pinned: true,
    });

    // 取消置顶
    await chatMgr.setConversationPinned({
      conversationId: cfg.secondUserId!,
      conversationType: 'singleChat',
      pinned: false,
    });
    // 不抛错即为成功
    expect(true).toBe(true);
  }, 15000);

  // ===== 标记会话/取消标记(Webim) =====

  it('标记会话 → 取消标记', async () => {
    const cfg = getRealEnvConfig();

    // 标记
    await chatMgr.addConversationMark({
      conversations: [{ conversationId: cfg.secondUserId!, conversationType: 'singleChat' }],
      mark: 0,
    });

    // 取消标记
    await chatMgr.removeConversationMark({
      conversations: [{ conversationId: cfg.secondUserId!, conversationType: 'singleChat' }],
      mark: 0,
    });
    expect(true).toBe(true);
  }, 15000);
});

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
