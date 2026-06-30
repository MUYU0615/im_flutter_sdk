// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatClient } from '@/chat-client';
import { UserInfoManager } from '@/managers/user-info-manager';
import type { RestContext } from '@/types/chat-client';
import { ERROR_CODES } from '@/utils/error-codes';
import {
  startMockRestServer,
  type MockRestRequest,
  type MockRestServerController,
} from '../../test-utils/layered/mock-rest-server';

const createMockClient = (restContext: RestContext, cacheSpy: (items: unknown) => void): ChatClient => {
  return {
    getRestContext: (): RestContext => restContext,
    getCacheManager: (): { setUserInfoSummaries: (items: unknown) => void } => ({
      setUserInfoSummaries: cacheSpy,
    }),
  } as unknown as ChatClient;
};

const expectJsonBody = (request: MockRestRequest): Record<string, unknown> => {
  if (
    !request.jsonBody ||
    typeof request.jsonBody !== 'object' ||
    Array.isArray(request.jsonBody)
  ) {
    throw new Error('Expected JSON object body');
  }
  return request.jsonBody as Record<string, unknown>;
};

describe('user-info-subscription integration', () => {
  let server: MockRestServerController;
  let manager: UserInfoManager;
  let cacheSpy: ReturnType<typeof vi.fn>;
  let restContext: RestContext;

  beforeEach(async () => {
    server = await startMockRestServer();
    cacheSpy = vi.fn();
    restContext = {
      restBaseUrl: server.baseUrl,
      appKey: 'org#app',
      userId: 'alice',
      token: 'mock-token',
      clientResource: 'web',
    };
    manager = new UserInfoManager();
    manager.bind(createMockClient(restContext, cacheSpy));
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  it('应按真实 success 样例完成订阅、取消订阅与订阅列表 hydrate', async () => {
    server.on('POST', '/org/app/user/alice/metadata/subscription', request => {
      expect(request.headers.authorization).toBe('Bearer mock-token');
      expect(expectJsonBody(request)).toEqual({
        usernames: ['bob', 'carol'],
      });
      return {
        status: 200,
        body: {
          path: '/user/alice/metadata/subscription',
          uri: 'https://api.example.com/org/app/user/alice/metadata/subscription',
          status: 'ok',
          timestamp: 1776318273575,
          organization: 'org',
          application: 'app-id',
          entities: [],
          count: 2,
          data: ['bob', 'carol'],
          duration: 8,
          applicationName: 'app',
        },
      };
    });
    server.on('DELETE', '/org/app/user/alice/metadata/subscription', request => {
      expect(request.query.get('usernames')).toBe('carol');
      return {
        status: 200,
        body: {
          path: '/user/alice/metadata/subscription',
          uri: 'https://api.example.com/org/app/user/alice/metadata/subscription',
          status: 'ok',
          timestamp: 1776318379967,
          organization: 'org',
          application: 'app-id',
          entities: [],
          count: 1,
          data: ['carol'],
          duration: 8,
          applicationName: 'app',
        },
      };
    });
    server.on('GET', '/org/app/user/alice/metadata/subscription', request => {
      expect(request.headers.authorization).toBe('Bearer mock-token');
      return {
        status: 200,
        body: {
          path: '/user/alice/metadata/subscription',
          uri: 'https://api.example.com/org/app/user/alice/metadata/subscription',
          status: 'ok',
          timestamp: 1776318459372,
          organization: 'org',
          application: 'app-id',
          entities: [],
          count: 2,
          data: ['carol', 'bob'],
          duration: 2,
          applicationName: 'app',
        },
      };
    });
    server.on('POST', '/org/app/metadata/user/get', request => {
      expect(expectJsonBody(request)).toEqual({
        targets: ['carol', 'bob'],
      });
      return {
        status: 200,
        body: {
          data: {
            carol: {
              nickname: 'Carol',
            },
            bob: {
              avatarurl: 'https://cdn.example.com/bob.png',
            },
          },
          lastModified: {
            carol: 11,
            bob: 12,
          },
        },
      };
    });

    await manager.subscribeUsersInfo({
      userIds: ['bob', 'carol'],
    });
    await manager.unsubscribeUsersInfo({
      userIds: ['carol'],
    });
    const result = await manager.getSubscribedUsers();

    expect(result).toEqual([
      {
        userId: 'carol',
        nickname: 'Carol',
      },
      {
        userId: 'bob',
        avatarUrl: 'https://cdn.example.com/bob.png',
      },
    ]);
    expect(cacheSpy).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      name: '订阅人数超限',
      body: {
        error: 'illegal_argument',
        exception: 'java.lang.IllegalArgumentException',
        timestamp: 1776671496362,
        duration: 5,
        error_description: 'metadata subscription count exceeds limit: 100',
      },
      expectedCode: ERROR_CODES.USER_INFO_SUBSCRIPTION_LIMIT_EXCEEDED,
      expectedReason: 'illegal_argument',
    },
    {
      name: '目标用户被订阅人数超限',
      body: {
        error: 'illegal_argument',
        exception: 'java.lang.IllegalArgumentException',
        timestamp: 1776671675182,
        duration: 3,
        error_description: 'metadata subscribed count exceeds limit: 1000',
      },
      expectedCode: ERROR_CODES.USER_INFO_SUBSCRIPTION_TARGET_LIMIT_EXCEEDED,
      expectedReason: 'illegal_argument',
    },
  ])('应把 400 $name 错误映射为稳定 SDKError', async ({ body, expectedCode, expectedReason }) => {
    server.on('POST', '/org/app/user/alice/metadata/subscription', () => {
      return {
        status: 400,
        body,
      };
    });

    await expect(
      manager.subscribeUsersInfo({
        userIds: ['bob'],
      })
    ).rejects.toMatchObject({
      code: expectedCode,
      details: expect.objectContaining({
        api: 'subscribeUsersInfo',
        reasonKey: expectedReason,
        serverCode: 'illegal_argument',
      }),
    });
  });

  it('应把 403 服务未开通错误映射为统一业务错误并保留真实原因', async () => {
    server.on('GET', '/org/app/user/alice/metadata/subscription', () => {
      return {
        status: 403,
        body: {
          error: 'operation forbidden',
          exception: 'ForbiddenException',
          timestamp: 1776671271163,
          duration: 0,
          error_description: 'hx#hxdemo metadata subscription not allow',
        },
      };
    });

    await expect(manager.getSubscribedUsers()).rejects.toMatchObject({
      code: ERROR_CODES.AUTH_FORBIDDEN,
      details: expect.objectContaining({
        api: 'getSubscribedUsers',
        reasonKey: 'operation forbidden',
        serverCode: 'operation forbidden',
        canonicalCode: ERROR_CODES.AUTH_FORBIDDEN,
      }),
    });
  });

  it('应把 429 错误兜底映射为超过服务限制', async () => {
    server.on('DELETE', '/org/app/user/alice/metadata/subscription', () => {
      return {
        status: 429,
        body: {
          error: 'too_many_requests',
          error_description: 'request rate limit exceeded',
        },
      };
    });

    await expect(
      manager.unsubscribeUsersInfo({
        userIds: ['bob'],
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.SERVICE_LIMIT_EXCEEDED,
      details: expect.objectContaining({
        api: 'unsubscribeUsersInfo',
        httpStatus: 429,
        canonicalCode: ERROR_CODES.SERVICE_LIMIT_EXCEEDED,
      }),
    });
  });

  it('应把 500 未映射错误兜底映射为服务端通用错误', async () => {
    server.on('GET', '/org/app/user/alice/metadata/subscription', () => {
      return {
        status: 500,
        body: {
          error: 'service_exception',
          error_description: 'internal server error',
        },
      };
    });

    await expect(manager.getSubscribedUsers()).rejects.toMatchObject({
      code: ERROR_CODES.REST_BUSINESS_UNKNOWN,
      details: expect.objectContaining({
        api: 'getSubscribedUsers',
        httpStatus: 500,
        canonicalCode: ERROR_CODES.REST_BUSINESS_UNKNOWN,
      }),
    });
  });
});
