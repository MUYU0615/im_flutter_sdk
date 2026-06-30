// @vitest-environment node
/**
 * 真实环境 API 测试 - 聊天室管理模块
 * 迁移自 robot: wayang/TestCase/聊天室/聊天室操作.robot（Webim 标记用例）
 */
import '../node-polyfill';
import { it, expect, beforeAll, afterAll } from 'vitest';
import type { ChatClient } from '@/chat-client';
import { ChatRoomManager } from '@/managers/chatroom/index';
import { describeRealEnv, getRealEnvConfig } from '../setup';
import { createFreshClient, cleanupClients, type ClientInstance } from '../helpers/multi-client';
import { EventCollector } from '../helpers/event-collector';

const config = getRealEnvConfig();
const hasChatroom = Boolean(config?.chatroomId);
const describeChatroom = hasChatroom ? describeRealEnv : describeRealEnv.skip;

describeChatroom('chatroom - 聊天室管理', () => {
  let clientA: ClientInstance;
  let roomMgr: InstanceType<typeof ChatRoomManager>;
  let collectorA: EventCollector;

  beforeAll(async () => {
    const cfg = getRealEnvConfig();
    const raw = createFreshClient({ appKey: cfg.appKey, wsUrl: cfg.wsUrl ?? undefined, restApiUrl: cfg.restApiUrl ?? undefined }).use(ChatRoomManager);
    await raw.login({ userId: cfg.userId, token: cfg.token });
    clientA = { client: raw as unknown as ChatClient, userId: cfg.userId, token: cfg.token };
    roomMgr = raw.chatRoomManager;

    collectorA = new EventCollector();
    collectorA.bind(clientA.client, 'chatroom-collector');
  }, 15000);

  afterAll(async () => {
    const cfg = getRealEnvConfig();
    try { await roomMgr.leaveChatRoom({ chatRoomId: cfg.chatroomId! }); } catch { /* ignore */ }
    collectorA?.unbind(clientA?.client, 'chatroom-collector');
    await cleanupClients(clientA);
  }, 15000);

  // ===== 加入聊天室 =====

  it('加入聊天室应成功', async () => {
    const cfg = getRealEnvConfig();
    await roomMgr.joinChatRoom({ chatRoomId: cfg.chatroomId! });
    expect(true).toBe(true);
  }, 10000);

  // ===== 获取聊天室详情 =====

  it('获取聊天室详情应返回正确的 chatRoomId', async () => {
    const cfg = getRealEnvConfig();
    const info = await roomMgr.getChatRoomInfo({ chatRoomId: cfg.chatroomId! });
    expect(info.chatRoomId).toBe(cfg.chatroomId);
  }, 10000);

  // ===== 获取公共聊天室列表 =====

  it('获取公共聊天室列表应返回数组', async () => {
    const result = await roomMgr.getChatRoomList({ pageSize: 5 });
    expect(result.items).toBeDefined();
    expect(Array.isArray(result.items)).toBe(true);
  }, 10000);

  // ===== 设置/获取聊天室属性(Webim) =====

  it('设置聊天室属性 → 获取属性应包含设置的值', async () => {
    const cfg = getRealEnvConfig();
    const key = 'test-attr-key';
    const value = 'test-attr-value-' + Date.now();

    await roomMgr.setAttributes({
      chatRoomId: cfg.chatroomId!,
      attributes: { [key]: value },
      isForced: false,
    });

    const attrs = await roomMgr.getAttributes({ chatRoomId: cfg.chatroomId!, keys: [key] });
    expect(attrs.attributes[key]).toBe(value);
  }, 10000);

  // ===== 移除聊天室属性(Webim) =====

  it('移除聊天室属性 → 获取属性应不包含该 key', async () => {
    const cfg = getRealEnvConfig();
    const key = 'test-attr-to-remove';

    await roomMgr.setAttributes({
      chatRoomId: cfg.chatroomId!,
      attributes: { [key]: 'temp' },
      isForced: false,
    });

    await roomMgr.removeAttributes({
      chatRoomId: cfg.chatroomId!,
      keys: [key],
      isForced: false,
    });

    const attrs = await roomMgr.getAttributes({ chatRoomId: cfg.chatroomId!, keys: [key] });
    expect(attrs.attributes[key]).toBeUndefined();
  }, 10000);

  // ===== 退出聊天室 =====

  it('退出聊天室应成功', async () => {
    const cfg = getRealEnvConfig();
    await roomMgr.leaveChatRoom({ chatRoomId: cfg.chatroomId! });
    expect(true).toBe(true);
  }, 10000);
});
