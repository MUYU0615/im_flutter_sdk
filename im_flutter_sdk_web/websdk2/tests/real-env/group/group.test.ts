// @vitest-environment node
/**
 * 真实环境 API 测试 - 群组管理模块
 * 迁移自 robot: wayang/TestCase/群组/群组基础操作.robot + 群组操作.robot（Webim 标记用例）
 */
import '../node-polyfill';
import { it, expect, beforeAll, afterAll } from 'vitest';
import type { ChatClient } from '@/chat-client';
import { GroupManager } from '@/managers/group/index';
import { describeRealEnv, getRealEnvConfig } from '../setup';
import { createFreshClient, cleanupClients, type ClientInstance } from '../helpers/multi-client';
import { destroyGroupSafe } from '../helpers/cleanup';

const config = getRealEnvConfig();
const hasSecondUser = Boolean(config?.secondUserId && config?.secondToken);
const describeGroup = hasSecondUser ? describeRealEnv : describeRealEnv.skip;

describeGroup('group - 群组管理', () => {
  let clientA: ClientInstance;
  let groupMgr: InstanceType<typeof GroupManager>;
  let createdGroupId: string | null = null;

  beforeAll(async () => {
    const cfg = getRealEnvConfig();
    const raw = createFreshClient({ appKey: cfg.appKey, wsUrl: cfg.wsUrl ?? undefined, restApiUrl: cfg.restApiUrl ?? undefined }).use(GroupManager);
    await raw.login({ userId: cfg.userId, token: cfg.token });
    clientA = { client: raw as unknown as ChatClient, userId: cfg.userId, token: cfg.token };
    groupMgr = raw.groupManager;
  }, 15000);

  afterAll(async () => {
    if (createdGroupId) {
      await destroyGroupSafe(
        { groupManager: { destroyGroup: (p) => groupMgr.destroyGroup(p) } } as Parameters<typeof destroyGroupSafe>[0],
        createdGroupId
      );
    }
    await cleanupClients(clientA);
  }, 15000);

  // ===== 创建群组 =====

  it('创建群组应返回 groupId', async () => {
    const cfg = getRealEnvConfig();
    const result = await groupMgr.createGroup({
      name: 'real-env-test-group',
      description: 'test group',
      memberIds: [cfg.secondUserId!],
      public: true,
      inviteNeedConfirm: false,
      allowInvites: true,
      joinApprovalRequired: false,
      maxMembers: 200,
    });
    expect(result.groupId).toBeDefined();
    expect(typeof result.groupId).toBe('string');
    expect(result.groupId.length).toBeGreaterThan(0);
    createdGroupId = result.groupId;
  }, 15000);

  // ===== 获取已加入群组列表 =====

  it('获取已加入群组列表应返回登录同步本地快照', () => {
    const result = groupMgr.getJoinedGroupList();
    expect(Array.isArray(result)).toBe(true);
  });

  // ===== 获取群组公告 =====

  it('获取群组公告应返回结果', async () => {
    const result = await groupMgr.getGroupAnnouncement({ groupId: createdGroupId! });
    expect(result).toBeDefined();
    expect(typeof result.announcement).toBe('string');
  }, 10000);

  // ===== 获取公开群组列表 =====

  it('获取公开群组列表应返回分页数据', async () => {
    const result = await groupMgr.getPublicGroupList({ pageSize: 5 });
    expect(result.items).toBeDefined();
    expect(Array.isArray(result.items)).toBe(true);
  }, 10000);

  // ===== 销毁群组 =====

  it('销毁群组应成功', async () => {
    await groupMgr.destroyGroup({ groupId: createdGroupId! });
    createdGroupId = null; // 已销毁，afterAll 不需要再清理
  }, 10000);
});
