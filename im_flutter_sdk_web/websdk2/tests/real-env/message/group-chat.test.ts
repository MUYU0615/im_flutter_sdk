// @vitest-environment node
/**
 * 真实环境 API 测试 - 群聊消息模块
 * 迁移自 robot: wayang/TestCase/消息/群聊.robot（Webim 标记用例）
 */
import '../node-polyfill';
import { it, expect, beforeAll, afterAll } from 'vitest';
import type { ChatClient } from '@/chat-client';
import { ChatManager } from '@/managers/chat/index';
import { GroupManager } from '@/managers/group/index';
import { describeRealEnv, getRealEnvConfig } from '../setup';
import { createFreshClient, cleanupClients, type ClientInstance } from '../helpers/multi-client';
import { EventCollector } from '../helpers/event-collector';

const config = getRealEnvConfig();
const hasSecondUser = Boolean(config?.secondUserId && config?.secondToken);
const describeGroupChat = hasSecondUser ? describeRealEnv : describeRealEnv.skip;

describeGroupChat('message/group-chat - 群聊消息', () => {
  let clientA: ClientInstance;
  let clientB: ClientInstance;
  let chatA: InstanceType<typeof ChatManager>;
  let groupMgr: InstanceType<typeof GroupManager>;
  let collectorB: EventCollector;
  let testGroupId: string;

  beforeAll(async () => {
    const cfg = getRealEnvConfig();

    const rawA = createFreshClient({ appKey: cfg.appKey, wsUrl: cfg.wsUrl ?? undefined, restApiUrl: cfg.restApiUrl ?? undefined }).use(ChatManager).use(GroupManager);
    await rawA.login({ userId: cfg.userId, token: cfg.token });
    clientA = { client: rawA as unknown as ChatClient, userId: cfg.userId, token: cfg.token };
    chatA = rawA.chatManager;
    groupMgr = rawA.groupManager;

    const rawB = createFreshClient({ appKey: cfg.appKey, wsUrl: cfg.wsUrl ?? undefined, restApiUrl: cfg.restApiUrl ?? undefined }).use(ChatManager);
    await rawB.login({ userId: cfg.secondUserId!, token: cfg.secondToken! });
    clientB = { client: rawB as unknown as ChatClient, userId: cfg.secondUserId!, token: cfg.secondToken! };

    collectorB = new EventCollector();
    collectorB.bind(clientB.client, 'group-msg-collector');

    // 创建测试群组（邀请不需确认）
    const result = await groupMgr.createGroup({
      name: 'group-chat-test',
      description: 'for message test',
      memberIds: [cfg.secondUserId!],
      public: true,
      joinApprovalRequired: false,
      inviteNeedConfirm: false,
      allowInvites: true,
      maxMembers: 200,
    });
    testGroupId = result.groupId;
    await sleep(2000);
    collectorB.clear();
  }, 30000);

  afterAll(async () => {
    try { await groupMgr.destroyGroup({ groupId: testGroupId }); } catch { /* ignore */ }
    collectorB?.unbind(clientB?.client, 'group-msg-collector');
    await cleanupClients(clientA, clientB);
  }, 15000);

  // ===== 群聊文本消息 =====

  it('user1 发送群文本消息 → user2 收到 onMessage', async () => {
    const msg = chatA.createTextMessage({
      conversationId: testGroupId,
      conversationType: 'groupChat',
      content: 'group-hello',
    });

    await chatA.sendMessage(msg);

    const received = await collectorB.waitForEvent<{ type: string; from: string; to: string }>('onMessage');
    expect(received.type).toBe('text');
    expect(received.from).toBe(clientA.userId);
    expect(received.to).toBe(testGroupId);
  }, 15000);

  // ===== 群聊 CMD 消息 =====

  it('user1 发送群 cmd 消息 → user2 收到 onMessage，type=cmd', async () => {
    const msg = chatA.createCmdMessage({
      conversationId: testGroupId,
      conversationType: 'groupChat',
      action: 'group-action',
    });

    await chatA.sendMessage(msg);

    const received = await collectorB.waitForEvent<{ type: string; to: string }>('onMessage');
    expect(received.type).toBe('cmd');
    expect(received.to).toBe(testGroupId);
  }, 15000);

  // ===== 群消息撤回 =====

  it('owner 撤回群消息 → 群成员收到 onRecallMessage', async () => {
    const msg = chatA.createTextMessage({
      conversationId: testGroupId,
      conversationType: 'groupChat',
      content: 'to-recall-in-group',
    });

    const sent = await chatA.sendMessage(msg);
    await collectorB.waitForEvent('onMessage');
    collectorB.clear();

    await chatA.recallMessage({ messageId: sent.msgServerId, conversationId: testGroupId, conversationType: 'groupChat' });

    const recall = await collectorB.waitForEvent<{ mid: string }>('onRecallMessage');
    expect(recall.mid).toBe(sent.msgServerId);
  }, 20000);
});

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
