// @vitest-environment node
/**
 * 真实环境 API 测试 - 登录注册模块
 * 迁移自 robot: wayang/TestCase/登录注册.robot
 *
 * 断言策略：精确验证返回结构、错误码、错误类型和事件 payload，
 * 对齐 robot LoginRes.resource 的约束力度。
 */
import '../node-polyfill';
import { expect, it, beforeAll, afterEach } from 'vitest';
import { ChatClient } from '@/chat-client';
import { ERROR_CODES } from '@/utils/error-codes';
import { describeRealEnv, getRealEnvConfig } from '../setup';

describeRealEnv('auth - 登录注册', () => {
  let client: ChatClient;
  let userId: string;
  let token: string;

  beforeAll(() => {
    const config = getRealEnvConfig();
    userId = config.userId;
    token = config.token;
    client = ChatClient.init({ appKey: config.appKey, useFixedDeviceId: true });
  });

  afterEach(async () => {
    if (client.getConnectionState() === 'connected') {
      await client.logout();
    }
  });

  // ===== 正常登录（对标 robot: case1 有效用户名密码） =====

  it('有效用户名 + token 登录应成功，状态变为 connected', async () => {
    await client.login({ userId, token });

    // 断言连接状态
    expect(client.getConnectionState()).toBe('connected');
  }, 15000);

  // ===== 异常登录 - 空 userId（对标 robot: case5 空用户名） =====

  it('空 userId 登录应抛出 ValidationError，code 为 VALIDATION_REQUIRED', async () => {
    try {
      await client.login({ userId: '', token });
      expect.fail('应该抛出错误');
    } catch (error: unknown) {
      const err = error as { code: number; message: string };
      expect(err.code).toBe(ERROR_CODES.VALIDATION_REQUIRED);
      expect(err.message).toBe('Validation failed: userId: userId is required');
    }
  });

  // ===== 异常登录 - 无效 token（对标 robot: case2/3 无效密码） =====

  it('无效 token 登录应抛出 ConnectionError，code 为 AUTH_UNAUTHORIZED', async () => {
    try {
      await client.login({ userId, token: 'invalid_token_xxx' });
      expect.fail('应该抛出错误');
    } catch (error: unknown) {
      const err = error as { code: number; message: string };
      expect(err.code).toBe(ERROR_CODES.AUTH_UNAUTHORIZED);
      expect(err.message).toBe('Provision rejected');
    }
  }, 15000);

  // ===== 异常登录 - 无效 userId（对标 robot: case4 无效用户名） =====

  it('无效 userId 登录应抛出 ConnectionError，code 为 AUTH_UNAUTHORIZED', async () => {
    try {
      await client.login({ userId: 'nonexistent_user_xyz_99999', token });
      expect.fail('应该抛出错误');
    } catch (error: unknown) {
      const err = error as { code: number; message: string };
      expect(err.code).toBe(ERROR_CODES.AUTH_UNAUTHORIZED);
      expect(err.message).toBe('Provision rejected');
    }
  }, 15000);

  // ===== 登出（对标 robot: 登出 case1） =====

  it('登录后登出应成功，状态变为 disconnected', async () => {
    await client.login({ userId, token });
    expect(client.getConnectionState()).toBe('connected');

    await client.logout();
    expect(client.getConnectionState()).toBe('disconnected');
  }, 15000);

  // ===== 连接状态查询（对标 robot: 查询登录后连接状态 / 查询退出后连接状态） =====

  it('登录后 getConnectionState 应返回 "connected"', async () => {
    await client.login({ userId, token });
    const state = client.getConnectionState();
    expect(state).toBe('connected');
    expect(typeof state).toBe('string');
  }, 15000);

  it('登出后 getConnectionState 应返回 "disconnected"', async () => {
    await client.login({ userId, token });
    await client.logout();
    const state = client.getConnectionState();
    expect(state).toBe('disconnected');
    expect(typeof state).toBe('string');
  }, 15000);

  // ===== renewToken（对标 robot: 验证renewToken可正常工作） =====

  it('renewToken 应返回 { token: string, expireAt: number }', async () => {
    await client.login({ userId, token });

    const result = await client.renewToken(token);

    // 精确断言返回结构
    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('expireAt');
    expect(typeof result.token).toBe('string');
    expect(result.token.length).toBeGreaterThan(10); // token 不应为空或极短
    expect(typeof result.expireAt).toBe('number');
    expect(result.expireAt).toBeGreaterThan(Date.now()); // 过期时间应在未来
  }, 15000);

  // ===== 事件回调 - onConnected（对标 robot: 获取onConnected通知） =====

  it('登录成功应触发 onConnected 事件，携带连接状态 payload', async () => {
    const events: unknown[] = [];
    client.addEventHandler('real-env-connected', {
      onConnected: (...args: unknown[]) => {
        events.push(args);
      },
    });

    await client.login({ userId, token });

    expect(events.length).toBe(1);
    // onConnected 回调携带一个连接状态对象
    const args = events[0] as unknown[];
    expect(args.length).toBe(1);
    const payload = args[0] as Record<string, unknown>;
    expect(payload.state).toBe('connected');
    expect(payload.reason).toBe('login');
    expect(payload.isLoginPhase).toBe(true);
    expect(typeof payload.timestamp).toBe('number');
    expect(typeof payload.attempt).toBe('number');
    expect(typeof payload.maxAttempts).toBe('number');
    client.removeEventHandler('real-env-connected');
  }, 15000);

  // ===== 事件回调 - onDisconnected（对标 robot: 登出后事件） =====

  it('登出应触发 onDisconnected 事件', async () => {
    await client.login({ userId, token });

    const events: unknown[] = [];
    client.addEventHandler('real-env-disconnected', {
      onDisconnected: (...args: unknown[]) => {
        events.push(args);
      },
    });

    await client.logout();

    expect(events.length).toBe(1);
    client.removeEventHandler('real-env-disconnected');
  }, 15000);

  // ===== 重复登录（对标 robot 隐含逻辑：已登录时再次登录应报错） =====

  it('已登录状态再次 login 应抛出 ConnectionError，code 为 AUTH_ALREADY_LOGIN', async () => {
    await client.login({ userId, token });

    try {
      await client.login({ userId, token });
      expect.fail('应该抛出错误');
    } catch (error: unknown) {
      const err = error as { code: number; message: string };
      expect(err.code).toBe(ERROR_CODES.AUTH_ALREADY_LOGIN);
      expect(err.message).toBe('ChatClient is already connecting or connected');
    }
  }, 15000);
});
