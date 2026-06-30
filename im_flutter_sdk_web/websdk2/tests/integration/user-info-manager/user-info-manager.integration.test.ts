// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatClient } from '@/chat-client';
import { UserInfoManager } from '@/managers/user-info-manager';
import type { RestContext } from '@/types/chat-client';
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

describe('user-info-manager integration', () => {
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

  it('getUserInfoByUserId / getUserInfoByAttribute 应正确组装请求并写回缓存', async () => {
    server.on('POST', '/org/app/metadata/user/get', request => {
      const body = expectJsonBody(request);
      if ('properties' in body) {
        expect(body).toEqual({
          targets: ['bob'],
          properties: ['avatarurl', 'nickname'],
        });
      } else {
        expect(body).toEqual({
          targets: ['bob'],
        });
      }

      return {
        status: 200,
        body: {
          timestamp: 1774495493846,
          data: {
            bob: {
              avatarurl: 'http:/11.com/a/png',
              nickname: 'Bob',
            },
          },
          lastModified: {
            bob: 1774495459340,
          },
          duration: 14,
        },
      };
    });

    const users = await manager.getUserInfoByUserId({
      userIds: ['bob'],
    });
    const selected = await manager.getUserInfoByAttribute({
      userIds: ['bob'],
      attributes: ['avatarUrl', 'nickname'],
    });

    expect(users).toEqual([
      {
        userId: 'bob',
        avatarUrl: 'http:/11.com/a/png',
        nickname: 'Bob',
      },
    ]);
    expect(selected).toEqual(users);
    expect(cacheSpy).toHaveBeenCalledTimes(2);
  });

  it('updateOwnInfo / updateOwnInfoByAttribute 应使用表单请求体并返回统一资料对象', async () => {
    server.on('PUT', '/org/app/metadata/user/alice', request => {
      expect(request.headers.authorization).toBe('Bearer mock-token');
      expect(request.headers['content-type']).toBe('application/x-www-form-urlencoded');
      return {
        status: 200,
        body: {
          timestamp: 1774496262484,
          data: {
            avatarurl: 'http:/11.com/a/png',
            nickname: '1111',
          },
          lastModified: 1774496262500,
          duration: 52,
        },
      };
    });

    const updated = await manager.updateOwnInfo({
      nickname: '1111',
      avatarUrl: 'http:/11.com/a/png',
    });
    const updatedAvatar = await manager.updateOwnInfoByAttribute('avatarUrl', 'http:/11.com/a/png');

    expect(updated).toEqual({
      userId: 'alice',
      avatarUrl: 'http:/11.com/a/png',
      nickname: '1111',
    });
    expect(updatedAvatar).toEqual(updated);
    expect(cacheSpy).toHaveBeenCalledTimes(2);
    expect(server.requests.map(item => item.rawBody)).toEqual([
      'nickname=1111&avatarurl=http%3A%2F11.com%2Fa%2Fpng',
      'avatarurl=http%3A%2F11.com%2Fa%2Fpng',
    ]);
  });
});
