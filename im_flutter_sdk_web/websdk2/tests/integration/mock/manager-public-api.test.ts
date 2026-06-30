// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ChatClient } from '@/chat-client';
import { ChatRoomManager } from '@/managers/chatroom-manager';
import { GroupManager } from '@/managers/group-manager';
import { PresenceManager } from '@/managers/presence-manager';
import { PushManager } from '@/managers/push-manager';
import { UserInfoManager } from '@/managers/user-info-manager';
import { ERROR_CODES } from '@/utils/error-codes';
import {
  startMockRestServer,
  type MockRestRequest,
  type MockRestServerController,
} from '../../test-utils/layered/mock-rest-server';

type ClientWithManagers = ChatClient & {
  readonly chatRoomManager: ChatRoomManager;
  readonly groupManager: GroupManager;
  readonly pushManager: PushManager;
  readonly presenceManager: PresenceManager;
  readonly userInfoManager: UserInfoManager;
};

type ChatClientInternal = {
  restBaseUrl: string | null;
  authToken: string | null;
  currentUserId: string | null;
  clientResource: string | null;
};

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

const primeRestContext = (client: ChatClient, baseUrl: string): void => {
  const internal = client as unknown as ChatClientInternal;
  internal.restBaseUrl = baseUrl;
  internal.authToken = 'mock-token';
  internal.currentUserId = 'alice';
  internal.clientResource = 'web';
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

describe('manager 公开 API integration mock-only', () => {
  let server: MockRestServerController;
  let client: ClientWithManagers;

  beforeEach(async () => {
    resetSingleton();
    server = await startMockRestServer();
    client = ChatClient.init({ appKey: 'org#app' })
      .use(ChatRoomManager)
      .use(GroupManager)
      .use(PushManager)
      .use(PresenceManager)
      .use(UserInfoManager) as ClientWithManagers;
    primeRestContext(client, server.baseUrl);
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
    resetSingleton();
  });

  it('PushManager 应通过公开入口完成上传 token 与全局免打扰查询', async () => {
    server.on('PUT', '/org/app/users/alice', request => {
      expect(request.headers.authorization).toBe('Bearer mock-token');
      expect(expectJsonBody(request)).toEqual({
        device_id: 'device-1',
        device_token: 'token-1',
        notifier_name: 'FCM',
      });
      return {
        status: 200,
        body: {},
      };
    });
    server.on('GET', '/org/app/users/alice/notification/user/alice', request => {
      expect(request.query.get('resource')).toBeNull();
      expect(request.headers.authorization).toBe('Bearer mock-token');
      return {
        status: 200,
        body: {
          type: 'AT',
        },
      };
    });

    await client.pushManager.uploadPushToken({
      deviceId: 'device-1',
      deviceToken: 'token-1',
      notifierName: 'FCM',
    });
    const silentMode = await client.pushManager.getGlobalSilentMode();

    expect(silentMode).toMatchObject({
      scope: 'global',
      rule: {
        remindType: 'AT',
      },
    });
    expect(server.requests.map(item => `${item.method} ${item.path}`)).toEqual([
      'PUT /org/app/users/alice',
      'GET /org/app/users/alice/notification/user/alice',
    ]);
  });

  it('PushManager 业务错误应沿真实 RestClient 链路映射为 SDKError', async () => {
    server.on('PUT', '/org/app/users/alice/notification/user/alice', request => {
      expect(request.query.get('resource')).toBe('web');
      return {
        status: 400,
        body: {
          error: 'SILENT_MODE_OPERATION_FAILED',
        },
      };
    });

    await expect(
      client.pushManager.setGlobalSilentMode({
        rule: {
          mode: 'REMIND_TYPE',
          remindType: 'AT',
        },
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.PUSH_SILENT_MODE_OPERATION_FAILED,
    });
  });

  it('PresenceManager 应通过公开入口完成订阅并返回归一化状态列表', async () => {
    server.on('POST', '/org/app/users/alice/presence/3600', request => {
      expect(expectJsonBody(request)).toEqual({
        usernames: ['userA'],
      });
      return {
        status: 200,
        body: {
          result: [
            {
              uid: 'userA',
              status: { web: 1, mobile: '2' },
              ext: 'online',
              last_time: 1772600000000,
              expiry: 3600,
            },
          ],
        },
      };
    });

    const response = await client.presenceManager.subscribePresence({
      userIds: ['userA'],
      expiry: 3600,
    });

    expect(response).toEqual([
      {
        publisher: 'userA',
        statusList: { web: 1, mobile: 2 },
        ext: 'online',
        latestTime: 1772600000000,
        expiryTime: 3600,
      },
    ]);
  });

  it('UserInfoManager 应通过公开入口完成查询与更新个人资料', async () => {
    server.on('POST', '/org/app/metadata/user/get', request => {
      expect(expectJsonBody(request)).toEqual({
        targets: ['bob'],
      });
      return {
        status: 200,
        body: {
          timestamp: 1774495493846,
          data: {
            bob: {
              nickname: 'Bob',
              avatarurl: 'https://cdn.example.com/bob.png',
            },
          },
          lastModified: {
            bob: 1774495459340,
          },
          duration: 14,
        },
      };
    });
    server.on('PUT', '/org/app/metadata/user/alice', request => {
      expect(request.headers['content-type']).toBe('application/x-www-form-urlencoded');
      expect(request.rawBody).toBe('nickname=Alice%20A&avatarurl=https%3A%2F%2Fcdn.example.com%2Falice.png');
      return {
        status: 200,
        body: {
          timestamp: 1774496262484,
          data: {
            nickname: 'Alice A',
            avatarurl: 'https://cdn.example.com/alice.png',
          },
          lastModified: 1774496262500,
          duration: 52,
        },
      };
    });
    server.on('POST', '/org/app/user/alice/metadata/subscription', request => {
      expect(expectJsonBody(request)).toEqual({
        usernames: ['bob'],
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
          count: 1,
          data: ['bob'],
          duration: 8,
          applicationName: 'app',
        },
      };
    });
    server.on('DELETE', '/org/app/user/alice/metadata/subscription', request => {
      expect(request.query.get('usernames')).toBe('bob');
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
          data: ['bob'],
          duration: 8,
          applicationName: 'app',
        },
      };
    });
    server.on('GET', '/org/app/user/alice/metadata/subscription', () => {
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
          count: 1,
          data: ['bob'],
          duration: 2,
          applicationName: 'app',
        },
      };
    });

    const users = await client.userInfoManager.getUserInfoByUserId({
      userIds: ['bob'],
    });
    const updated = await client.userInfoManager.updateOwnInfo({
      nickname: 'Alice A',
      avatarUrl: 'https://cdn.example.com/alice.png',
    });
    await client.userInfoManager.subscribeUsersInfo({
      userIds: ['bob'],
    });
    const subscribed = await client.userInfoManager.getSubscribedUsers();
    await client.userInfoManager.unsubscribeUsersInfo({
      userIds: ['bob'],
    });

    expect(users).toEqual([
      expect.objectContaining({
        userId: 'bob',
        nickname: 'Bob',
        avatarUrl: 'https://cdn.example.com/bob.png',
      }),
    ]);
    expect(updated).toEqual(
      expect.objectContaining({
        userId: 'alice',
        nickname: 'Alice A',
        avatarUrl: 'https://cdn.example.com/alice.png',
      })
    );
    expect(subscribed).toEqual([
      expect.objectContaining({
        userId: 'bob',
        nickname: 'Bob',
        avatarUrl: 'https://cdn.example.com/bob.png',
      }),
    ]);
  });

  it('Group 对象应通过公开入口完成管理员对象化读取', async () => {
    server.on('GET', '/org/app/chatgroups/g1/admin', request => {
      expect(request.headers.authorization).toBe('Bearer mock-token');
      return {
        status: 200,
        body: {
          data: ['bob'],
        },
      };
    });
    server.on('POST', '/org/app/metadata/user/get', request => {
      expect(expectJsonBody(request)).toEqual({
        targets: ['bob'],
      });
      return {
        status: 200,
        body: {
          data: {
            bob: {
              nickname: 'Bob',
              avatarurl: 'https://cdn.example.com/bob.png',
            },
          },
        },
      };
    });

    const group = client.groupManager.getGroup('g1');
    const admins = await group.getAdmins();

    expect(admins).toEqual([
      {
        userId: 'bob',
        nickname: 'Bob',
        avatarUrl: 'https://cdn.example.com/bob.png',
      },
    ]);
  });

  it('ChatRoom 对象应通过公开入口完成管理员对象化读取', async () => {
    server.on('GET', '/org/app/chatrooms/r1/admin', request => {
      expect(request.headers.authorization).toBe('Bearer mock-token');
      return {
        status: 200,
        body: {
          data: ['bob'],
        },
      };
    });
    server.on('POST', '/org/app/metadata/user/get', request => {
      expect(expectJsonBody(request)).toEqual({
        targets: ['bob'],
      });
      return {
        status: 200,
        body: {
          data: {
            bob: {
              nickname: 'Bob',
              avatarurl: 'https://cdn.example.com/bob.png',
            },
          },
        },
      };
    });

    const chatRoom = client.chatRoomManager.getChatRoom('r1');
    const admins = await chatRoom.getAdminList();

    expect(admins).toEqual([
      {
        userId: 'bob',
        nickname: 'Bob',
        avatarUrl: 'https://cdn.example.com/bob.png',
      },
    ]);
  });

  it('ChatRoomManager 应支持 init({ managers }) 公开入口', async () => {
    resetSingleton();
    const initClient = ChatClient.init({
      appKey: 'org#app',
      managers: [ChatRoomManager],
    }) as ChatClient & {
      readonly chatRoomManager: ChatRoomManager;
    };
    primeRestContext(initClient, server.baseUrl);

    server.on('GET', '/org/app/chatrooms/r2/admin', request => {
      expect(request.headers.authorization).toBe('Bearer mock-token');
      return {
        status: 200,
        body: {
          data: ['carol'],
        },
      };
    });
    server.on('POST', '/org/app/metadata/user/get', request => {
      expect(expectJsonBody(request)).toEqual({
        targets: ['carol'],
      });
      return {
        status: 200,
        body: {
          data: {
            carol: {
              nickname: 'Carol',
            },
          },
        },
      };
    });

    const admins = await initClient.chatRoomManager.getChatRoom('r2').getAdminList();

    expect(admins).toEqual([
      {
        userId: 'carol',
        nickname: 'Carol',
      },
    ]);
  });

  it('GroupManager 应支持 init({ managers }) 公开入口', async () => {
    resetSingleton();
    const initClient = ChatClient.init({
      appKey: 'org#app',
      managers: [GroupManager],
    }) as ChatClient & {
      readonly groupManager: GroupManager;
    };
    primeRestContext(initClient, server.baseUrl);

    server.on('GET', '/org/app/chatgroups/g2/admin', request => {
      expect(request.headers.authorization).toBe('Bearer mock-token');
      return {
        status: 200,
        body: {
          data: ['carol'],
        },
      };
    });
    server.on('POST', '/org/app/metadata/user/get', request => {
      expect(expectJsonBody(request)).toEqual({
        targets: ['carol'],
      });
      return {
        status: 200,
        body: {
          data: {
            carol: {
              nickname: 'Carol',
            },
          },
        },
      };
    });

    const admins = await initClient.groupManager.getGroup('g2').getAdmins();

    expect(admins).toEqual([
      {
        userId: 'carol',
        nickname: 'Carol',
      },
    ]);
  });
});
