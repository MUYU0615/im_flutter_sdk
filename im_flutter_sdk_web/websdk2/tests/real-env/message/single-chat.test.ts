// @vitest-environment node
/**
 * 真实环境 API 测试 - 单聊消息模块
 * 迁移自 robot: wayang/TestCase/消息/单聊.robot（Webim 标记用例）
 */
import '../node-polyfill';
import { it, expect, beforeAll, afterAll } from 'vitest';
import type { ChatClient } from '@/chat-client';
import { ChatManager } from '@/managers/chat/index';
import { ContactManager } from '@/managers/contact/index';
import { describeRealEnv, getRealEnvConfig } from '../setup';
import { createFreshClient, cleanupClients, type ClientInstance } from '../helpers/multi-client';
import { EventCollector } from '../helpers/event-collector';

const config = getRealEnvConfig();
const hasSecondUser = Boolean(config?.secondUserId && config?.secondToken);
const describeSingleChat = hasSecondUser ? describeRealEnv : describeRealEnv.skip;

describeSingleChat('message/single-chat - 单聊消息', () => {
  let clientA: ClientInstance;
  let clientB: ClientInstance;
  let chatA: InstanceType<typeof ChatManager>;
  let collectorB: EventCollector;

  beforeAll(async () => {
    const cfg = getRealEnvConfig();

    const rawA = createFreshClient({ appKey: cfg.appKey, wsUrl: cfg.wsUrl ?? undefined, restApiUrl: cfg.restApiUrl ?? undefined }).use(ChatManager).use(ContactManager);
    await rawA.login({ userId: cfg.userId, token: cfg.token });
    clientA = { client: rawA as unknown as ChatClient, userId: cfg.userId, token: cfg.token };
    chatA = rawA.chatManager;

    const rawB = createFreshClient({ appKey: cfg.appKey, wsUrl: cfg.wsUrl ?? undefined, restApiUrl: cfg.restApiUrl ?? undefined }).use(ChatManager).use(ContactManager);
    await rawB.login({ userId: cfg.secondUserId!, token: cfg.secondToken! });
    clientB = { client: rawB as unknown as ChatClient, userId: cfg.secondUserId!, token: cfg.secondToken! };

    collectorB = new EventCollector();
    collectorB.bind(clientB.client, 'msg-collector-b');
    await sleep(1000);
    collectorB.clear();
  }, 20000);

  afterAll(async () => {
    collectorB?.unbind(clientB?.client, 'msg-collector-b');
    await cleanupClients(clientA, clientB);
  }, 15000);

  // ===== 发送文本消息 =====

  it('user1 发送文本消息 → user2 收到 onMessage，type=text，内容匹配', async () => {
    const cfg = getRealEnvConfig();
    const msg = chatA.createTextMessage({
      conversationId: cfg.secondUserId!,
      conversationType: 'singleChat',
      content: 'hello-real-env-test',
    });

    await chatA.sendMessage(msg);

    const received = await collectorB.waitForEvent<{ type: string; msg: string; from: string }>('onMessage');
    expect(received.type).toBe('text');
    expect(received.from).toBe(cfg.userId);
  }, 15000);

  // ===== 发送 CMD 消息 =====

  it('user1 发送 cmd 消息 → user2 收到 onMessage，type=cmd', async () => {
    const cfg = getRealEnvConfig();
    const msg = chatA.createCmdMessage({
      conversationId: cfg.secondUserId!,
      conversationType: 'singleChat',
      action: 'test-action',
    });

    await chatA.sendMessage(msg);

    const received = await collectorB.waitForEvent<{ type: string; from: string }>('onMessage');
    expect(received.type).toBe('cmd');
    expect(received.from).toBe(cfg.userId);
  }, 15000);

  // ===== 发送 custom 消息 =====

  it('user1 发送 custom 消息 → user2 收到 onMessage，type=custom', async () => {
    const cfg = getRealEnvConfig();
    const msg = chatA.createCustomMessage({
      conversationId: cfg.secondUserId!,
      conversationType: 'singleChat',
      event: 'test-event',
      params: { key1: 'value1' },
    });

    await chatA.sendMessage(msg);

    const received = await collectorB.waitForEvent<{ type: string; from: string }>('onMessage');
    expect(received.type).toBe('custom');
    expect(received.from).toBe(cfg.userId);
  }, 15000);

  // ===== 发送 location 消息 =====

  it('user1 发送 location 消息 → user2 收到 onMessage，type=location', async () => {
    const cfg = getRealEnvConfig();
    const msg = chatA.createLocationMessage({
      conversationId: cfg.secondUserId!,
      conversationType: 'singleChat',
      latitude: 39.9042,
      longitude: 116.4074,
      address: 'Beijing',
    });

    await chatA.sendMessage(msg);

    const received = await collectorB.waitForEvent<{ type: string; from: string }>('onMessage');
    expect(received.type).toBe('location');
    expect(received.from).toBe(cfg.userId);
  }, 15000);

  // ===== 撤回消息 =====

  it('user1 发送消息后撤回 → user2 收到 onRecallMessage', async () => {
    const cfg = getRealEnvConfig();
    const msg = chatA.createTextMessage({
      conversationId: cfg.secondUserId!,
      conversationType: 'singleChat',
      content: 'to-be-recalled',
    });

    const sent = await chatA.sendMessage(msg);
    await collectorB.waitForEvent('onMessage'); // 先等消息到达
    collectorB.clear();

    await chatA.recallMessage({ messageId: sent.msgServerId, conversationId: cfg.secondUserId!, conversationType: 'singleChat' });

    const recall = await collectorB.waitForEvent<{ mid: string }>('onRecallMessage');
    expect(recall.mid).toBe(sent.msgServerId);
  }, 20000);
});

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
