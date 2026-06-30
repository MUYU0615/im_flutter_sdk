// @vitest-environment node
/**
 * 真实环境 API 测试 - 在线状态模块
 * 迁移自 robot: wayang/TestCase/在线状态.robot
 */
import '../node-polyfill';
import { it, expect, beforeAll, afterAll } from 'vitest';
import type { ChatClient } from '@/chat-client';
import { PresenceManager } from '@/managers/presence/index';
import { describeRealEnv, getRealEnvConfig } from '../setup';
import { createFreshClient, cleanupClients, type ClientInstance } from '../helpers/multi-client';
import { EventCollector } from '../helpers/event-collector';

const config = getRealEnvConfig();
const hasSecondUser = Boolean(config?.secondUserId && config?.secondToken);
const describePresence = hasSecondUser ? describeRealEnv : describeRealEnv.skip;

describePresence('presence - 在线状态', () => {
  let clientA: ClientInstance;
  let clientB: ClientInstance;
  let presA: InstanceType<typeof PresenceManager>;
  let presB: InstanceType<typeof PresenceManager>;
  let collectorA: EventCollector;

  beforeAll(async () => {
    const cfg = getRealEnvConfig();

    const rawA = createFreshClient({ appKey: cfg.appKey, wsUrl: cfg.wsUrl ?? undefined, restApiUrl: cfg.restApiUrl ?? undefined }).use(PresenceManager);
    await rawA.login({ userId: cfg.userId, token: cfg.token });
    clientA = { client: rawA as unknown as ChatClient, userId: cfg.userId, token: cfg.token };
    presA = rawA.presenceManager;

    const rawB = createFreshClient({ appKey: cfg.appKey, wsUrl: cfg.wsUrl ?? undefined, restApiUrl: cfg.restApiUrl ?? undefined }).use(PresenceManager);
    await rawB.login({ userId: cfg.secondUserId!, token: cfg.secondToken! });
    clientB = { client: rawB as unknown as ChatClient, userId: cfg.secondUserId!, token: cfg.secondToken! };
    presB = rawB.presenceManager;

    collectorA = new EventCollector();
    collectorA.bind(clientA.client, 'presence-collector');

    // 清理订阅
    try { await presA.unsubscribePresence({ userIds: [cfg.secondUserId!] }); } catch { /* ignore */ }
    await sleep(1000);
    collectorA.clear();
  }, 20000);

  afterAll(async () => {
    const cfg = getRealEnvConfig();
    try { await presA.unsubscribePresence({ userIds: [cfg.secondUserId!] }); } catch { /* ignore */ }
    collectorA?.unbind(clientA?.client, 'presence-collector');
    await cleanupClients(clientA, clientB);
  }, 15000);

  // ===== 基本操作：订阅 → 发布 → 收到事件 → 获取状态 → 取消订阅 =====

  it('user1 订阅 user2 → user2 发布状态 → user1 收到 onPresenceStatusChange', async () => {
    const cfg = getRealEnvConfig();

    // 订阅
    await presA.subscribePresence({ userIds: [cfg.secondUserId!], expiry: 300 });
    await sleep(2000);

    // user2 发布自定义状态
    await presB.publishPresence({ customStatus: 'testing-status' });

    // user1 收到事件
    const event = await collectorA.waitForEvent<{ userId: string; description?: string }>(
      'onPresenceStatusChange'
    );
    expect(event).toBeDefined();
  }, 20000);

  it('获取指定用户在线状态应返回结果', async () => {
    const cfg = getRealEnvConfig();
    const result = await presA.getPresenceStatus({ userIds: [cfg.secondUserId!] });
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  }, 10000);

  it('取消订阅后不再收到事件', async () => {
    const cfg = getRealEnvConfig();
    await presA.unsubscribePresence({ userIds: [cfg.secondUserId!] });
    await sleep(1000);
    collectorA.clear();

    // user2 再次发布
    await presB.publishPresence({ customStatus: 'after-unsub' });

    // user1 不应收到事件
    await collectorA.assertNoEvent('onPresenceStatusChange', 3000);
  }, 10000);

  // ===== 异常操作 =====

  it('订阅自己应返回错误', async () => {
    const cfg = getRealEnvConfig();
    try {
      await presA.subscribePresence({ userIds: [cfg.userId], expiry: 300 });
      expect.fail('应该抛出错误');
    } catch (error: unknown) {
      const err = error as { code: number; message: string };
      expect(err.code).toBeDefined();
    }
  }, 10000);
});

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
