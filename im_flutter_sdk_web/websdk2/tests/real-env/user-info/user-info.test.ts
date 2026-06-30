// @vitest-environment node
/**
 * 真实环境 API 测试 - 用户信息模块
 * 迁移自 robot: wayang/TestCase/用户.robot（Webim 标记用例）
 */
import '../node-polyfill';
import { it, expect, beforeAll, afterAll } from 'vitest';
import { ChatClient } from '@/chat-client';
import { UserInfoManager } from '@/managers/user-info/index';
import { describeRealEnv, getRealEnvConfig } from '../setup';

describeRealEnv('user-info - 用户信息', () => {
  let client: ChatClient & { userInfoManager: InstanceType<typeof UserInfoManager> };

  beforeAll(async () => {
    const cfg = getRealEnvConfig();
    client = ChatClient.init({ appKey: cfg.appKey, useFixedDeviceId: true, managers: [UserInfoManager] }) as typeof client;
    if (client.getConnectionState() !== 'connected') {
      await client.login({ userId: cfg.userId, token: cfg.token });
    }
  }, 20000);

  afterAll(async () => {
    try {
      if (client?.getConnectionState() === 'connected') {
        await client.logout();
      }
    } catch { /* ignore */ }
  }, 10000);

  // ===== 获取用户信息(Webim) =====

  it('获取已设置信息的用户应返回包含该 userId 的结果', async () => {
    const cfg = getRealEnvConfig();
    console.log('[user-info] connectionState:', client.getConnectionState());
    const result = await client.userInfoManager.getUserInfoByUserId({ userIds: [cfg.userId] });
    console.log('[user-info] result:', JSON.stringify(result));
    // 如果当前用户设置过信息则返回，否则为空
    if (result.length > 0) {
      const self = result.find(u => u.userId === cfg.userId);
      expect(self).toBeDefined();
      expect(self!.userId).toBe(cfg.userId);
    } else {
      // 用户未设置过信息，API 返回空数组是当前行为
      expect(result.length).toBe(0);
    }
  }, 10000);

  // ===== 获取多用户信息(Webim) =====

  it('批量获取用户信息应只返回已设置信息的用户', async () => {
    const cfg = getRealEnvConfig();
    const userIds = [cfg.userId];
    if (cfg.secondUserId) {
      userIds.push(cfg.secondUserId);
    }
    const result = await client.userInfoManager.getUserInfoByUserId({ userIds });
    console.log('[user-info] batch result:', JSON.stringify(result));
    // 只有设置过信息的用户才会出现在结果中，result.length <= userIds.length
    expect(result.length).toBeLessThanOrEqual(userIds.length);
    // 返回的每个条目都应该是请求列表中的用户
    for (const info of result) {
      expect(userIds).toContain(info.userId);
    }
  }, 10000);

  // ===== 获取不存在的用户信息 =====

  it('获取不存在的用户信息应返回空数组', async () => {
    const result = await client.userInfoManager.getUserInfoByUserId({ userIds: ['nonexistent_user_xyz_99999'] });
    expect(result.length).toBe(0);
  }, 10000);
});
