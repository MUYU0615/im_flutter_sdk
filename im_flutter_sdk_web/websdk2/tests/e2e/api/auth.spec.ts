/**
 * E2E 测试 - 登录注册
 * 迁移自 robot: wayang/TestCase/登录注册.robot
 */
import { test, expect } from '../fixtures/sdk-api';
import { resolveRealEnvConfig } from '../../test-utils/layered/real-env-runner';

type InvalidTokenLoginResult =
  | {
      readonly type: 'rejected';
      readonly name?: string;
      readonly code?: number;
      readonly message: string;
      readonly details?: Record<string, unknown>;
      readonly state: string;
      readonly durationMs: number;
      readonly attemptCount: number;
    }
  | { readonly type: 'resolved' }
  | { readonly type: 'timeout'; readonly state: string };

test.describe('auth - 登录注册', () => {
  test('有效用户名 + token 登录应成功', async ({ userA }) => {
    // userA fixture 已经登录成功，验证连接状态
    const state = await userA.page.evaluate(() => window.__CLIENT__!.getConnectionState());
    expect(state).toBe('connected');
  });

  test('空 userId 登录应抛出 ValidationError', async ({ browser }) => {
    const config = resolveRealEnvConfig()!;
    const page = await browser.newPage();
    await page.goto('/test-harness.html');
    await page.waitForFunction(() => document.getElementById('status')?.textContent === 'loaded');

    await page.evaluate(({ appKey }) => {
      const { ChatClient } = window.__SDK__;
      window.__CLIENT__ = ChatClient.init({ appKey, useFixedDeviceId: true }) as any;
    }, { appKey: config.appKey });

    const error = await page.evaluate(async () => {
      try {
        await window.__CLIENT__!.login({ userId: '', token: 'any' });
        return null;
      } catch (e: any) {
        return { code: e.code, message: e.message };
      }
    });

    expect(error).not.toBeNull();
    expect(error!.message).toBe('Validation failed: userId: userId is required');
    await page.close();
  });

  test('无效 token 登录应返回鉴权失败且不重试', async ({ browser }) => {
    const config = resolveRealEnvConfig()!;
    const page = await browser.newPage();
    await page.goto('/test-harness.html');
    await page.waitForFunction(() => document.getElementById('status')?.textContent === 'loaded');

    await page.evaluate(({ appKey }) => {
      const { ChatClient } = window.__SDK__;
      window.__CLIENT__ = ChatClient.init({ appKey, useFixedDeviceId: true }) as any;
    }, { appKey: config.appKey });

    const result = await page.evaluate(async ({ userId }) => {
      const logMessages: string[] = [];
      const originalLog = console.log.bind(console);
      console.log = (...args: unknown[]): void => {
        logMessages.push(args.map(item => String(item)).join(' '));
        originalLog(...args);
      };
      const startedAt = Date.now();
      const loginResult = window.__CLIENT__!
        .login({ userId, token: 'invalid_token_xxx' })
        .then(() => ({ type: 'resolved' as const }))
        .catch((e: any) => ({
          type: 'rejected' as const,
          name: e.name,
          code: e.code,
          message: e.message,
          details: e.details,
          state: window.__CLIENT__!.getConnectionState(),
          durationMs: Date.now() - startedAt,
          attemptCount: logMessages.filter(message =>
            message.includes('Connecting core websocket')
          ).length,
        }));
      const timedResult = new Promise(resolve => {
        setTimeout(() => {
          resolve({
            type: 'timeout' as const,
            state: window.__CLIENT__!.getConnectionState(),
          });
        }, 10000);
      });
      return Promise.race([loginResult, timedResult]);
    }, { userId: config.userId }) as InvalidTokenLoginResult;

    expect(result).not.toBeNull();
    expect(result.type).toBe('rejected');
    if (result.type !== 'rejected') {
      throw new Error(`invalid token login should reject, got ${result.type}`);
    }
    expect(result).toMatchObject({
      type: 'rejected',
      name: 'ConnectionError',
      code: 202,
      message: 'Provision rejected',
      state: 'disconnected',
      attemptCount: 1,
      details: {
        stage: 'provision',
        retryable: false,
      },
    });
    expect(result.durationMs).toBeLessThan(10000);
    expect(result.details?.statusCode).toBeGreaterThan(0);
    expect(typeof result.details?.reason).toBe('string');
    await page.close();
  });

  test('已登录状态再次 login 应抛出错误', async ({ userA }) => {
    const error = await userA.page.evaluate(async (userId) => {
      try {
        await window.__CLIENT__!.login({ userId, token: 'any' });
        return null;
      } catch (e: any) {
        return { code: e.code, message: e.message };
      }
    }, userA.userId);

    expect(error).not.toBeNull();
    expect(error!.message).toBe('ChatClient is already connecting or connected');
  });

  test('登录后登出应成功', async ({ browser }) => {
    const config = resolveRealEnvConfig()!;
    const page = await browser.newPage();
    await page.goto('/test-harness.html');
    await page.waitForFunction(() => document.getElementById('status')?.textContent === 'loaded');

    await page.evaluate(({ appKey }) => {
      const { ChatClient } = window.__SDK__;
      window.__CLIENT__ = ChatClient.init({ appKey, useFixedDeviceId: true }) as any;
    }, { appKey: config.appKey });

    await page.evaluate(async ({ userId, token }) => {
      await window.__CLIENT__!.login({ userId, token });
    }, { userId: config.userId, token: config.token });

    await page.evaluate(async () => {
      await window.__CLIENT__!.logout();
    });

    const state = await page.evaluate(() => window.__CLIENT__!.getConnectionState());
    expect(state).toBe('disconnected');
    await page.close();
  });

  test('未登录与重复 logout 都应保持 disconnected 状态', async ({ browser }) => {
    const config = resolveRealEnvConfig()!;
    const page = await browser.newPage();
    await page.goto('/test-harness.html');
    await page.waitForFunction(() => document.getElementById('status')?.textContent === 'loaded');

    await page.evaluate(({ appKey }) => {
      const { ChatClient } = window.__SDK__;
      window.__CLIENT__ = ChatClient.init({ appKey, useFixedDeviceId: true }) as any;
    }, { appKey: config.appKey });

    await page.evaluate(async () => {
      await window.__CLIENT__!.logout();
      await window.__CLIENT__!.logout();
    });

    const state = await page.evaluate(() => window.__CLIENT__!.getConnectionState());
    expect(state).toBe('disconnected');
    await page.close();
  });

  test('addEventHandler / removeEventHandler 应精确控制事件回调', async ({ userA, userB }) => {
    const firstContent = `handler-first-${Date.now()}`;
    const secondContent = `handler-second-${Date.now()}`;

    await userB.page.evaluate(() => {
      window.__EVENTS__.directHandlerMessage = [];
      window.__CLIENT__!.addEventHandler('e2e-direct-handler', {
        onMessage: payload => {
          (window.__EVENTS__.directHandlerMessage ??= []).push(payload);
        },
      });
    });

    await userA.page.evaluate(async ({ targetId, content }) => {
      const client = window.__CLIENT__ as any;
      const msg = client.chatManager.createTextMessage({
        conversationId: targetId,
        conversationType: 'singleChat',
        content,
      });
      await client.chatManager.sendMessage(msg);
    }, { targetId: userB.userId, content: firstContent });

    const firstEvent = await userB.waitForEventMatching<{
      type: string;
      body: { content: string };
    }>('directHandlerMessage', payload => {
      return payload.type === 'text' && payload.body.content === firstContent;
    });
    expect(firstEvent).toMatchObject({
      type: 'text',
      body: { content: firstContent },
    });

    await userB.page.evaluate(() => {
      window.__EVENTS__.directHandlerMessage = [];
      window.__CLIENT__!.removeEventHandler('e2e-direct-handler');
    });

    await userA.page.evaluate(async ({ targetId, content }) => {
      const client = window.__CLIENT__ as any;
      const msg = client.chatManager.createTextMessage({
        conversationId: targetId,
        conversationType: 'singleChat',
        content,
      });
      await client.chatManager.sendMessage(msg);
    }, { targetId: userB.userId, content: secondContent });

    await userB.waitForEventMatching<{
      type: string;
      body: { content: string };
    }>('onMessage', payload => {
      return payload.type === 'text' && payload.body.content === secondContent;
    });
    await userB.waitForNoEvent('directHandlerMessage', 1000);
  });

  test('addEventHandler 应支持离线消息同步事件回调', async ({ userA }) => {
    await userA.clearEvents();
    await userA.page.evaluate(() => {
      window.__EVENTS__.directOfflineMessageSync = [];
      window.__CLIENT__!.addEventHandler('e2e-offline-sync-handler', {
        onOfflineMessageSyncStart: () => {
          (window.__EVENTS__.directOfflineMessageSync ??= []).push({
            eventName: 'onOfflineMessageSyncStart',
          });
        },
        onOfflineMessageSyncFinish: () => {
          (window.__EVENTS__.directOfflineMessageSync ??= []).push({
            eventName: 'onOfflineMessageSyncFinish',
          });
        },
      });

      window.__CLIENT__!.addInternalEvent('onOfflineMessageSyncStart', undefined);
      window.__CLIENT__!.addInternalEvent('onOfflineMessageSyncFinish', undefined);
    });

    const startEvent = await userA.waitForEventMatching<{ readonly eventName: string }>(
      'directOfflineMessageSync',
      payload => payload.eventName === 'onOfflineMessageSyncStart',
      3000
    );
    const finishEvent = await userA.waitForEventMatching<{ readonly eventName: string }>(
      'directOfflineMessageSync',
      payload => payload.eventName === 'onOfflineMessageSyncFinish',
      3000
    );

    expect(startEvent.eventName).toBe('onOfflineMessageSyncStart');
    expect(finishEvent.eventName).toBe('onOfflineMessageSyncFinish');

    await userA.page.evaluate(() => {
      window.__EVENTS__.directOfflineMessageSync = [];
      window.__CLIENT__!.removeEventHandler('e2e-offline-sync-handler');
      window.__CLIENT__!.addInternalEvent('onOfflineMessageSyncStart', undefined);
      window.__CLIENT__!.addInternalEvent('onOfflineMessageSyncFinish', undefined);
    });
    await userA.waitForNoEvent('directOfflineMessageSync', 1000);
  });
});
