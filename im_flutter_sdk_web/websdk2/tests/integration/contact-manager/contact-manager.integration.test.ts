import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CacheManager } from '@/cache';
import { ChatClient } from '@/chat-client';
import { EventHub } from '@/core/events/event-hub';
import { MessageReceiver } from '@/core/message/message-receiver';
import type { MessageSender } from '@/core/message/message-sender';
import { ContactManager } from '@/managers/contact';
import { GroupManager } from '@/managers/group';
import { UserInfoManager } from '@/managers/user-info';
import { MsyncCodec } from '@/protocol/msync/codec';
import { getMsyncRoot } from '@/protocol/msync/root';
import { NameSpace } from '@/protocol/msync/types';
import { ERROR_CODES } from '@/utils/error-codes';

type ContactClient = ChatClient & {
  readonly contactManager: ContactManager;
};

type ChatClientInternal = {
  restBaseUrl: string | null;
  authToken: string | null;
  currentUserId: string | null;
  clientResource: string | null;
  cacheManager: CacheManager | null;
  cacheUserId: string | null;
  eventHub: EventHub;
};

type FetchCall = {
  readonly method: string;
  readonly url: URL;
  readonly body?: unknown;
};

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

const primeRestContext = (
  client: ChatClient,
  options: {
    readonly baseUrl: string;
    readonly cacheManager: CacheManager;
  }
): void => {
  const internal = client as unknown as ChatClientInternal;
  internal.restBaseUrl = options.baseUrl;
  internal.authToken = 'mock-token';
  internal.currentUserId = 'alice';
  internal.clientResource = 'web';
  internal.cacheManager = options.cacheManager;
  internal.cacheUserId = 'alice';
};

const seedContactCache = async (cacheManager: CacheManager): Promise<void> => {
  await cacheManager.prepare();
  cacheManager.applyContactSync({
    mode: 'full',
    relations: [
      {
        userId: 'bob',
        remark: 'old-remark',
        sign: 'hello',
        addTs: 100,
        updatedAt: 100,
        metadataUpdatedAt: 100,
      },
    ],
    userInfos: [
      {
        userId: 'bob',
        nickname: 'Bob',
        avatarUrl: 'https://cdn.example.com/bob.png',
      },
    ],
    version: 'v1',
    lastSyncTs: 1,
  });
};

const createJsonResponse = (status: number, body: unknown): Response => {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
    headers: {
      get: (): string => 'application/json',
    },
    json: (): Promise<unknown> => Promise.resolve(body),
    text: (): Promise<string> => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
};

const buildFetchMock = (handler: (call: FetchCall) => Response): typeof fetch => {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
    const method = init?.method ?? 'GET';
    const body =
      typeof init?.body === 'string' && init.body.length > 0
        ? (JSON.parse(init.body) as unknown)
        : undefined;

    return Promise.resolve(
      handler({
        method,
        url,
        body,
      })
    );
  }) as unknown as typeof fetch;
};

const buildRosterSyncPayload = (options: {
  readonly operation: number;
  readonly from: string;
  readonly to: string;
  readonly reason?: string;
  readonly rosterVersion?: string;
}): Uint8Array => {
  const root = getMsyncRoot();
  const commSyncDlType = root.lookupType('easemob.pb.CommSyncDL');
  const rosterBodyType = root.lookupType('easemob.pb.RosterBody');
  const metaType = root.lookupType('easemob.pb.Meta');

  const rosterBody = rosterBodyType.create({
    operation: options.operation,
    from: { name: options.from },
    to: [{ name: options.to }],
    reason: options.reason ?? '',
    rosterVer: options.rosterVersion ?? '',
  });
  const meta = metaType.create({
    id: '1001',
    ns: NameSpace.ROSTER,
    payload: rosterBodyType.encode(rosterBody).finish(),
  });

  return commSyncDlType.encode(
    commSyncDlType.create({
      metaId: '0',
      metas: [meta],
    })
  ).finish();
};

const buildUserInfoNotifySyncPayload = (options: {
  readonly notifyType: 'contact_metadata_updated' | 'subscribe_metadata_updated';
  readonly userId: string;
  readonly metadata: Record<string, unknown>;
  readonly lastModified: number;
}): Uint8Array => {
  const root = getMsyncRoot();
  const commSyncDlType = root.lookupType('easemob.pb.CommSyncDL');
  const metaType = root.lookupType('easemob.pb.Meta');
  const payload = new TextEncoder().encode(
    JSON.stringify({
      type: options.notifyType,
      data: {
        username: options.userId,
        metadata: options.metadata,
        lastModified: options.lastModified,
      },
    })
  );

  const meta = metaType.create({
    id: '1002',
    ns: NameSpace.NOTIFY,
    payload,
  });

  return commSyncDlType.encode(
    commSyncDlType.create({
      metaId: '0',
      metas: [meta],
    })
  ).finish();
};

const createMessageSenderStub = (): MessageSender => {
  return {
    handleAck: vi.fn(),
    handleSendError: vi.fn(),
  } as unknown as MessageSender;
};

describe('ContactManager integration', () => {
  const originalFetch = globalThis.fetch;
  let client: ContactClient;
  let cacheManager: CacheManager;

  beforeEach(async () => {
    resetSingleton();
    localStorage.clear();
    cacheManager = new CacheManager({
      appKey: 'org#app',
      userId: 'alice',
      cacheEncryptionMode: 'off',
    });
    await seedContactCache(cacheManager);
    client = ChatClient.init({
      appKey: 'org#app',
      enableUserInfoSync: true,
      managers: [ContactManager, UserInfoManager, GroupManager] as const,
    }) as ContactClient;
    primeRestContext(client, {
      baseUrl: 'https://api.example.com',
      cacheManager,
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    localStorage.clear();
    vi.restoreAllMocks();
    resetSingleton();
  });

  it('deleteContact 成功后应让同会话 getContacts 立即可见最新结果', async () => {
    globalThis.fetch = buildFetchMock(call => {
      expect(call.method).toBe('DELETE');
      expect(call.url.pathname).toBe('/org/app/users/alice/contacts/users/bob');
      expect(call.url.searchParams.get('resource')).toBe('web');
      return createJsonResponse(200, {});
    });

    await client.contactManager.deleteContact({
      userId: 'bob',
    });

    expect(client.contactManager.getContacts()).toEqual([]);
  });

  it('setContactRemark 成功后应让同会话 getContacts 读取新备注', async () => {
    globalThis.fetch = buildFetchMock(call => {
      expect(call.method).toBe('PUT');
      expect(call.url.pathname).toBe('/org/app/users/alice/contacts/users/bob');
      expect(call.body).toEqual({
        remark: '',
      });
      return createJsonResponse(200, {});
    });

    await client.contactManager.setContactRemark({
      userId: 'bob',
      remark: '',
    });

    expect(client.contactManager.getContacts()[0]?.remark).toBe('');
  });

  it('setContactRemark 遇到非好友 400 时应映射业务错误且不误改缓存', async () => {
    globalThis.fetch = buildFetchMock(call => {
      expect(call.method).toBe('PUT');
      expect(call.url.pathname).toBe('/org/app/users/alice/contacts/users/bob');
      expect(call.body).toEqual({
        remark: 'new-remark',
      });
      return createJsonResponse(400, {
        error: 'illegal_argument',
        error_description: 'updateRemark | they are not friends, please add as a friend first.',
        exception: 'InvalidParameterException',
        timestamp: 1774350803336,
        duration: 0,
      });
    });

    await expect(
      client.contactManager.setContactRemark({
        userId: 'bob',
        remark: 'new-remark',
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.CONTACT_SET_REMARK_NOT_FRIEND,
      details: {
        api: 'setContactRemark',
        serverCode: 'illegal_argument',
        serverMessage: 'updateRemark | they are not friends, please add as a friend first.',
      },
    });

    expect(client.contactManager.getContacts()[0]?.remark).toBe('old-remark');
  });

  it('getBlocklist 应通过真实 RestClient 链路返回对象数组并复用快照', async () => {
    const fetchMock = buildFetchMock(call => {
      if (call.url.pathname === '/org/app/users/alice/blocks/users') {
        expect(call.method).toBe('GET');
        return createJsonResponse(200, {
          uri: 'https://api.example.com/org/app/users/alice/blocks/users',
          timestamp: 1774256318068,
          entities: [],
          count: 1,
          action: 'get',
          data: ['zd2'],
          duration: 5,
        });
      }

      expect(call.method).toBe('POST');
      expect(call.url.pathname).toBe('/org/app/metadata/user/get');
      expect(call.body).toEqual({
        targets: ['zd2'],
      });
      return createJsonResponse(200, {
        timestamp: 1,
        data: {
          zd2: {
            nickname: 'ZD2',
            avatarurl: 'https://cdn.example.com/zd2.png',
          },
        },
        lastModified: {
          zd2: 11,
        },
        duration: 2,
      });
    });
    globalThis.fetch = fetchMock;

    const first = await client.contactManager.getBlocklist();
    const second = await client.contactManager.getBlocklist();

    expect(first).toEqual([
      {
        userId: 'zd2',
        nickname: 'ZD2',
        avatarUrl: 'https://cdn.example.com/zd2.png',
      },
    ]);
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('addUsersToBlocklist 遇到不存在用户时应映射统一 SDK 错误', async () => {
    globalThis.fetch = buildFetchMock(call => {
      expect(call.method).toBe('POST');
      expect(call.url.pathname).toBe('/org/app/sdk/user/alice/blocks');
      expect(call.body).toEqual({
        usernames: ['ghost-user'],
      });
      return createJsonResponse(404, {
        error: 'service_resource_not_found',
        exception: 'UserNotFoundException',
        timestamp: 1774256447712,
        duration: 0,
        error_description: 'Service resource not found',
      });
    });

    await expect(
      client.contactManager.addUsersToBlocklist({
        userIds: ['ghost-user'],
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.CONTACT_BLOCKLIST_USER_NOT_FOUND,
    });
  });

  it('roster 下行事件应同时触发 contactManager 回调并更新联系人缓存', async () => {
    const internal = client as unknown as ChatClientInternal;
    const codec = new MsyncCodec({
      appKey: 'org#app',
      userId: 'alice',
      token: 'mock-token',
    });
    const receiver = new MessageReceiver(codec, createMessageSenderStub(), internal.eventHub);
    const onContactDeleted = vi.fn();

    client.contactManager.addEventHandler('integration-contact', {
      onContactDeleted: onContactDeleted,
    });

    receiver.handleSyncPayload(
      buildRosterSyncPayload({
        operation: 3,
        from: 'bob',
        to: 'alice',
        reason: 'deleted-by-peer',
        rosterVersion: 'rv-2',
      })
    );

    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });

    expect(onContactDeleted).toHaveBeenCalledWith({
      type: 'unsubscribed',
      from: 'bob',
      to: 'alice',
      status: 'deleted-by-peer',
      rosterVersion: 'rv-2',
      userInfo: {
        userId: 'bob',
        nickname: 'Bob',
        avatarUrl: 'https://cdn.example.com/bob.png',
        sign: undefined,
        ext: undefined,
      },
    });
    expect(client.contactManager.getContacts()).toEqual([]);
    expect(client.getContactSnapshot()?.version).toBe('rv-2');
  });

  it('roster 联系人建立事件应在对外派发前补齐 userInfo', async () => {
    globalThis.fetch = buildFetchMock(call => {
      expect(call.method).toBe('POST');
      expect(call.url.pathname).toBe('/org/app/metadata/user/get');
      expect(call.body).toEqual({
        targets: ['carol'],
      });
      return createJsonResponse(200, {
        timestamp: 1,
        data: {
          carol: {
            nickname: 'Carol',
            avatarurl: 'https://cdn.example.com/carol.png',
            sign: 'hello',
          },
        },
        lastModified: {
          carol: 11,
        },
        duration: 2,
      });
    });

    const internal = client as unknown as ChatClientInternal;
    const codec = new MsyncCodec({
      appKey: 'org#app',
      userId: 'alice',
      token: 'mock-token',
    });
    const receiver = new MessageReceiver(codec, createMessageSenderStub(), internal.eventHub);
    const onContactAdded = vi.fn();

    client.contactManager.addEventHandler('integration-contact', {
      onContactAdded,
    });

    receiver.handleSyncPayload(
      buildRosterSyncPayload({
        operation: 4,
        from: 'carol',
        to: 'alice',
        reason: 'accepted',
        rosterVersion: 'rv-3',
      })
    );

    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });

    expect(onContactAdded).toHaveBeenCalledWith({
      type: 'subscribed',
      from: 'carol',
      to: 'alice',
      status: 'accepted',
      rosterVersion: 'rv-3',
      userInfo: {
        userId: 'carol',
        nickname: 'Carol',
        avatarUrl: 'https://cdn.example.com/carol.png',
        sign: 'hello',
        ext: undefined,
      },
    });
  });

  it('好友资料 notify 应通过真实下行链路刷新联系人视图并派发 onContactInfoUpdated', async () => {
    const internal = client as unknown as ChatClientInternal;
    const codec = new MsyncCodec({
      appKey: 'org#app',
      userId: 'alice',
      token: 'mock-token',
    });
    const receiver = new MessageReceiver(codec, createMessageSenderStub(), internal.eventHub);
    const onContactInfoUpdated = vi.fn();

    client.contactManager.addEventHandler('integration-friend-info', {
      onContactInfoUpdated,
    });

    receiver.handleSyncPayload(
      buildUserInfoNotifySyncPayload({
        notifyType: 'contact_metadata_updated',
        userId: 'bob',
        metadata: {
          nickname: 'Bob New',
          avatarurl: 'https://cdn.example.com/bob-new.png',
          sign: 'new-sign',
        },
        lastModified: 300,
      })
    );

    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });

    expect(onContactInfoUpdated).toHaveBeenCalledWith({
      userInfo: {
        userId: 'bob',
        nickname: 'Bob New',
        avatarUrl: 'https://cdn.example.com/bob-new.png',
        sign: 'new-sign',
      },
      contact: {
        userId: 'bob',
        userInfo: {
          userId: 'bob',
          nickname: 'Bob New',
          avatarUrl: 'https://cdn.example.com/bob-new.png',
          sign: 'new-sign',
        },
        remark: 'old-remark',
        addTs: 100,
      },
    });
    expect(client.contactManager.getContacts()).toEqual([
      {
        userId: 'bob',
        userInfo: {
          userId: 'bob',
          nickname: 'Bob New',
          avatarUrl: 'https://cdn.example.com/bob-new.png',
          sign: 'new-sign',
        },
        remark: 'old-remark',
        addTs: 100,
      },
    ]);
  });
});
