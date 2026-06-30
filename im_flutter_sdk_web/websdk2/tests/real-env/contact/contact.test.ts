// @vitest-environment node
/**
 * 真实环境 API 测试 - 好友管理模块
 * 迁移自 robot: wayang/TestCase/好友.robot（Webim 标记用例）
 */
import '../node-polyfill';
import { it, expect, beforeAll, afterAll } from 'vitest';
import type { ChatClient } from '@/chat-client';
import { describeRealEnv, getRealEnvConfig } from '../setup';
import { createFreshClient, cleanupClients, type ClientInstance } from '../helpers/multi-client';
import { EventCollector } from '../helpers/event-collector';
import { ContactManager } from '@/managers/contact/index';

const config = getRealEnvConfig();
const hasSecondUser = Boolean(config?.secondUserId && config?.secondToken);
const describeContact = hasSecondUser ? describeRealEnv : describeRealEnv.skip;

describeContact('contact - 好友管理', () => {
  let clientA: ClientInstance;
  let clientB: ClientInstance;
  let mgrA: InstanceType<typeof ContactManager>;
  let mgrB: InstanceType<typeof ContactManager>;
  let collectorA: EventCollector;
  let collectorB: EventCollector;

  beforeAll(async () => {
    const cfg = getRealEnvConfig();

    // 创建两个实例并注册 ContactManager
    const rawA = createFreshClient({ appKey: cfg.appKey, wsUrl: cfg.wsUrl ?? undefined, restApiUrl: cfg.restApiUrl ?? undefined }).use(ContactManager);
    await rawA.login({ userId: cfg.userId, token: cfg.token });
    clientA = { client: rawA as unknown as ChatClient, userId: cfg.userId, token: cfg.token };
    mgrA = rawA.contactManager;

    const rawB = createFreshClient({ appKey: cfg.appKey, wsUrl: cfg.wsUrl ?? undefined, restApiUrl: cfg.restApiUrl ?? undefined }).use(ContactManager);
    await rawB.login({ userId: cfg.secondUserId!, token: cfg.secondToken! });
    clientB = { client: rawB as unknown as ChatClient, userId: cfg.secondUserId!, token: cfg.secondToken! };
    mgrB = rawB.contactManager;

    // 绑定事件收集器
    collectorA = new EventCollector();
    collectorA.bind(clientA.client, 'collector-a');
    collectorB = new EventCollector();
    collectorB.bind(clientB.client, 'collector-b');

    // 清理残留好友关系和黑名单
    try { await mgrA.deleteContact({ userId: cfg.secondUserId! }); } catch { /* ignore */ }
    try { await mgrB.deleteContact({ userId: cfg.userId }); } catch { /* ignore */ }
    try { await mgrA.removeUserFromBlocklist({ userIds: [cfg.secondUserId!] }); } catch { /* ignore */ }
    try { await mgrB.removeUserFromBlocklist({ userIds: [cfg.userId] }); } catch { /* ignore */ }

    // 等待清理事件消化
    await sleep(2000);
    collectorA.clear();
    collectorB.clear();
  }, 30000);

  afterAll(async () => {
    collectorA?.clear();
    collectorB?.clear();
    collectorA?.unbind(clientA?.client, 'collector-a');
    collectorB?.unbind(clientB?.client, 'collector-b');
    await cleanupClients(clientA, clientB);
  }, 15000);

  // ===== 添加好友 + 接受邀请 =====

  it('user1 添加好友 → user2 收到 onContactInvited → user2 接受 → user1 收到 onContactAgreed', async () => {
    const cfg = getRealEnvConfig();

    // user1 发送好友请求
    await mgrA.addContact({ userId: cfg.secondUserId!, message: 'hello' });

    // user2 收到 onContactInvited
    const invited = await collectorB.waitForEvent<{ userId: string }>('onContactInvited');
    expect(invited.userId).toBe(cfg.userId);

    // user2 接受邀请
    await mgrB.acceptContactInvite({ userId: cfg.userId });

    // user1 收到 onContactAgreed
    const agreed = await collectorA.waitForEvent<{ userId: string }>('onContactAgreed');
    expect(agreed.userId).toBe(cfg.secondUserId);
  }, 20000);

  // ===== 删除好友 =====

  it('user1 删除好友 → user2 收到 onContactDeleted', async () => {
    const cfg = getRealEnvConfig();

    await mgrA.deleteContact({ userId: cfg.secondUserId! });

    // user2 收到 onContactDeleted
    const deleted = await collectorB.waitForEvent<{ userId: string }>('onContactDeleted');
    expect(deleted.userId).toBe(cfg.userId);
  }, 15000);

  // ===== 添加好友 + 拒绝邀请 =====

  it('user1 添加好友 → user2 拒绝 → user1 收到 onContactRefuse', async () => {
    const cfg = getRealEnvConfig();

    await mgrA.addContact({ userId: cfg.secondUserId! });

    // user2 收到邀请
    await collectorB.waitForEvent('onContactInvited');

    // user2 拒绝
    await mgrB.declineContactInvite({ userId: cfg.userId });

    // user1 收到 onContactRefuse
    const refused = await collectorA.waitForEvent<{ userId: string }>('onContactRefuse');
    expect(refused.userId).toBe(cfg.secondUserId);
  }, 20000);

  // ===== 黑名单操作 =====

  it('添加黑名单 → getBlocklist 包含该用户 → 移除 → 不包含', async () => {
    const cfg = getRealEnvConfig();

    // 添加黑名单
    const addResult = await mgrA.addUsersToBlocklist({ userIds: [cfg.secondUserId!] });
    expect(addResult.succeeded.map(user => user.userId)).toContain(cfg.secondUserId);

    // 获取黑名单列表
    const blocklist = await mgrA.getBlocklist();
    const blocked = blocklist.find(entry => entry.userId === cfg.secondUserId);
    expect(blocked).toBeDefined();

    // 移除黑名单
    await mgrA.removeUserFromBlocklist({ userIds: [cfg.secondUserId!] });

    // 验证移除
    const blocklistAfter = await mgrA.getBlocklist();
    const blockedAfter = blocklistAfter.find(entry => entry.userId === cfg.secondUserId);
    expect(blockedAfter).toBeUndefined();
  }, 15000);
});

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
