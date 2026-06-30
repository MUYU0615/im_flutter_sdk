import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CacheManager } from '@/cache/cache-manager';
import { ChatClient } from '@/chat-client';
import { GroupManager } from '@/managers/group';
import { UserInfoManager } from '@/managers/user-info';
import {
  getMessageProfileVersionSidecar,
  setMessageProfileVersionSidecar,
} from '@/core/message/profile-sync/profile-version-sidecar';
import type { Message } from '@/types';
import type { RestContext } from '@/types/chat-client';
import type { ConversationItem } from '@/types/conversation';
import { RestClient } from '@/rest/client';
import { logger } from '@/utils/logger';

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

const createMessage = (partial: Partial<Message> = {}): Message => {
  return {
    msgServerId: '',
    msgLocalId: 'local-1',
    from: '',
    to: '',
    sender: { userId: 'alice' },
    conversationId: 'bob',
    conversationType: 'singleChat',
    type: 'text',
    status: 'sending',
    ext: {},
    timestamp: Date.now(),
    body: { content: 'hello' },
    direct: 'SEND',
    ...partial,
  };
};

const createCacheManager = async (): Promise<CacheManager> => {
  const cacheManager = new CacheManager({
    appKey: 'org#app',
    userId: 'alice',
    cacheEncryptionMode: 'off',
  });
  await cacheManager.prepare();
  return cacheManager;
};

const createProfileSyncClient = (): ChatClient => {
  return ChatClient.init({
    appKey: 'org#app',
    enableUserInfoSync: true,
    managers: [UserInfoManager, GroupManager],
  });
};

describe('ChatClient enableUserInfoSync profile sync', () => {
  beforeEach((): void => {
    resetSingleton();
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('enableUserInfoSync=true 时发送消息应挂载资料版本字段', async () => {
    const client = createProfileSyncClient();
    const cacheManager = await createCacheManager();
    cacheManager.setUserInfoSummaries([
      {
        userId: 'alice',
        nickname: 'Alice',
        userInfoUpdateTime: 12,
        lastAccess: 1,
        lastUpdate: 1,
      },
    ]);
    cacheManager.setGroupNamecards([
      {
        groupId: 'group-1',
        userId: 'alice',
        namecard: 'Alice Card',
        namecardUpdateTime: 18,
        lastSyncAt: 1,
        lastAccess: 1,
        lastUpdate: 1,
      },
    ]);

    const sendMessage = vi.fn(async (message: Message): Promise<Message> => message);
    (
      client as unknown as {
        cacheManager: CacheManager;
        currentUserId: string;
        state: string;
        core: { sendMessage: (message: Message) => Promise<Message> };
      }
    ).cacheManager = cacheManager;
    (
      client as unknown as {
        cacheManager: CacheManager;
        currentUserId: string;
        state: string;
        core: { sendMessage: (message: Message) => Promise<Message> };
      }
    ).currentUserId = 'alice';
    (
      client as unknown as {
        cacheManager: CacheManager;
        currentUserId: string;
        state: string;
        core: { sendMessage: (message: Message) => Promise<Message> };
      }
    ).state = 'connected';
    (
      client as unknown as {
        cacheManager: CacheManager;
        currentUserId: string;
        state: string;
        core: { sendMessage: (message: Message) => Promise<Message> };
      }
    ).core = {
      sendMessage,
    };

    const message = createMessage({
      conversationId: 'group-1',
      conversationType: 'groupChat',
    });

    await client.sendMessage(message);

    expect(sendMessage).toHaveBeenCalledWith(message, undefined);
    expect(getMessageProfileVersionSidecar(message)).toEqual({
      userInfoUpdateTime: 12,
      namecardUpdateTime: 18,
    });
  });

  it('enableUserInfoSync=false 时发送消息不应携带资料版本字段', async () => {
    const client = ChatClient.init({ appKey: 'org#app', enableUserInfoSync: false });
    const cacheManager = await createCacheManager();
    cacheManager.setUserInfoSummaries([
      {
        userId: 'alice',
        nickname: 'Alice',
        userInfoUpdateTime: 12,
        lastAccess: 1,
        lastUpdate: 1,
      },
    ]);

    const sendMessage = vi.fn(async (message: Message): Promise<Message> => message);
    (
      client as unknown as {
        cacheManager: CacheManager;
        currentUserId: string;
        state: string;
        core: { sendMessage: (message: Message) => Promise<Message> };
      }
    ).cacheManager = cacheManager;
    (
      client as unknown as {
        cacheManager: CacheManager;
        currentUserId: string;
        state: string;
        core: { sendMessage: (message: Message) => Promise<Message> };
      }
    ).currentUserId = 'alice';
    (
      client as unknown as {
        cacheManager: CacheManager;
        currentUserId: string;
        state: string;
        core: { sendMessage: (message: Message) => Promise<Message> };
      }
    ).state = 'connected';
    (
      client as unknown as {
        cacheManager: CacheManager;
        currentUserId: string;
        state: string;
        core: { sendMessage: (message: Message) => Promise<Message> };
      }
    ).core = {
      sendMessage,
    };

    const message = createMessage();
    setMessageProfileVersionSidecar(message, {
      userInfoUpdateTime: 99,
      namecardUpdateTime: 66,
    });

    await client.sendMessage(message);

    expect(sendMessage).toHaveBeenCalledWith(message, undefined);
    expect(getMessageProfileVersionSidecar(message)).toBeNull();
  });

  it('enableUserInfoSync=false 时接收消息不应进入资料补位链路', async () => {
    const client = ChatClient.init({ appKey: 'org#app', enableUserInfoSync: false });
    const cacheManager = await createCacheManager();
    cacheManager.setUserInfoSummaries([
      {
        userId: 'bob',
        nickname: 'Bob',
        avatarUrl: 'https://cdn.example.com/bob.png',
        userInfoUpdateTime: 10,
        lastAccess: 1,
        lastUpdate: 1,
      },
    ]);

    const enqueueUserInfo = vi.fn();
    const enqueueGroupNamecard = vi.fn();
    (
      client as unknown as {
        cacheManager: CacheManager;
        userInfoHydrationQueue: { enqueue: (...args: unknown[]) => void; destroy: () => void };
        groupNamecardHydrationQueue: {
          enqueue: (...args: unknown[]) => void;
          destroy: () => void;
        };
        handleIncomingMessageProfileSync: (message: Message) => void;
      }
    ).cacheManager = cacheManager;
    (
      client as unknown as {
        cacheManager: CacheManager;
        userInfoHydrationQueue: { enqueue: (...args: unknown[]) => void; destroy: () => void };
        groupNamecardHydrationQueue: {
          enqueue: (...args: unknown[]) => void;
          destroy: () => void;
        };
        handleIncomingMessageProfileSync: (message: Message) => void;
      }
    ).userInfoHydrationQueue = {
      enqueue: enqueueUserInfo,
      destroy: vi.fn(),
    };
    (
      client as unknown as {
        cacheManager: CacheManager;
        userInfoHydrationQueue: { enqueue: (...args: unknown[]) => void; destroy: () => void };
        groupNamecardHydrationQueue: {
          enqueue: (...args: unknown[]) => void;
          destroy: () => void;
        };
        handleIncomingMessageProfileSync: (message: Message) => void;
      }
    ).groupNamecardHydrationQueue = {
      enqueue: enqueueGroupNamecard,
      destroy: vi.fn(),
    };

    const message = createMessage({
      direct: 'RECEIVE',
      sender: { userId: 'bob' },
      conversationId: 'group-1',
      conversationType: 'groupChat',
      status: 'sent',
    });
    setMessageProfileVersionSidecar(message, {
      userInfoUpdateTime: 20,
      namecardUpdateTime: 30,
    });

    (
      client as unknown as {
        handleIncomingMessageProfileSync: (message: Message) => void;
      }
    ).handleIncomingMessageProfileSync(message);

    expect(message.sender).toEqual({ userId: 'bob' });
    expect(enqueueUserInfo).not.toHaveBeenCalled();
    expect(enqueueGroupNamecard).not.toHaveBeenCalled();
  });

  it('enableUserInfoSync=true 且消息缺少版本字段时，缓存 miss 应触发异步兜底补拉', async () => {
    const client = createProfileSyncClient();
    const cacheManager = await createCacheManager();

    const enqueueUserInfo = vi.fn();
    const enqueueGroupNamecard = vi.fn();
    (
      client as unknown as {
        cacheManager: CacheManager;
        userInfoHydrationQueue: { enqueue: (...args: unknown[]) => void; destroy: () => void };
        groupNamecardHydrationQueue: {
          enqueue: (...args: unknown[]) => void;
          destroy: () => void;
        };
        handleIncomingMessageProfileSync: (message: Message) => void;
      }
    ).cacheManager = cacheManager;
    (
      client as unknown as {
        cacheManager: CacheManager;
        userInfoHydrationQueue: { enqueue: (...args: unknown[]) => void; destroy: () => void };
        groupNamecardHydrationQueue: {
          enqueue: (...args: unknown[]) => void;
          destroy: () => void;
        };
        handleIncomingMessageProfileSync: (message: Message) => void;
      }
    ).userInfoHydrationQueue = {
      enqueue: enqueueUserInfo,
      destroy: vi.fn(),
    };
    (
      client as unknown as {
        cacheManager: CacheManager;
        userInfoHydrationQueue: { enqueue: (...args: unknown[]) => void; destroy: () => void };
        groupNamecardHydrationQueue: {
          enqueue: (...args: unknown[]) => void;
          destroy: () => void;
        };
        handleIncomingMessageProfileSync: (message: Message) => void;
      }
    ).groupNamecardHydrationQueue = {
      enqueue: enqueueGroupNamecard,
      destroy: vi.fn(),
    };

    const message = createMessage({
      direct: 'RECEIVE',
      sender: { userId: 'bob' },
      conversationId: 'group-1',
      conversationType: 'groupChat',
      status: 'sent',
    });

    (
      client as unknown as {
        handleIncomingMessageProfileSync: (message: Message) => void;
      }
    ).handleIncomingMessageProfileSync(message);

    expect(enqueueUserInfo).toHaveBeenCalledWith('bob');
    expect(enqueueGroupNamecard).toHaveBeenCalledWith('group-1', 'bob');
    expect(message.sender).toEqual({ userId: 'bob' });
  });

  it('enableUserInfoSync=true 且消息缺少版本字段时，缓存命中应直接复用且不触发兜底补拉', async () => {
    const client = createProfileSyncClient();
    const cacheManager = await createCacheManager();
    cacheManager.setUserInfoSummaries([
      {
        userId: 'bob',
        nickname: 'Bob',
        avatarUrl: 'https://cdn.example.com/bob.png',
        userInfoUpdateTime: 10,
        lastAccess: 1,
        lastUpdate: 1,
      },
    ]);
    cacheManager.setGroupNamecards([
      {
        groupId: 'group-1',
        userId: 'bob',
        namecard: 'Bob Card',
        lastSyncAt: 1,
        lastAccess: 1,
        lastUpdate: 1,
      },
    ]);

    const enqueueUserInfo = vi.fn();
    const enqueueGroupNamecard = vi.fn();
    (
      client as unknown as {
        cacheManager: CacheManager;
        userInfoHydrationQueue: { enqueue: (...args: unknown[]) => void; destroy: () => void };
        groupNamecardHydrationQueue: {
          enqueue: (...args: unknown[]) => void;
          destroy: () => void;
        };
        handleIncomingMessageProfileSync: (message: Message) => void;
      }
    ).cacheManager = cacheManager;
    (
      client as unknown as {
        cacheManager: CacheManager;
        userInfoHydrationQueue: { enqueue: (...args: unknown[]) => void; destroy: () => void };
        groupNamecardHydrationQueue: {
          enqueue: (...args: unknown[]) => void;
          destroy: () => void;
        };
        handleIncomingMessageProfileSync: (message: Message) => void;
      }
    ).userInfoHydrationQueue = {
      enqueue: enqueueUserInfo,
      destroy: vi.fn(),
    };
    (
      client as unknown as {
        cacheManager: CacheManager;
        userInfoHydrationQueue: { enqueue: (...args: unknown[]) => void; destroy: () => void };
        groupNamecardHydrationQueue: {
          enqueue: (...args: unknown[]) => void;
          destroy: () => void;
        };
        handleIncomingMessageProfileSync: (message: Message) => void;
      }
    ).groupNamecardHydrationQueue = {
      enqueue: enqueueGroupNamecard,
      destroy: vi.fn(),
    };

    const message = createMessage({
      direct: 'RECEIVE',
      sender: { userId: 'bob' },
      conversationId: 'group-1',
      conversationType: 'groupChat',
      status: 'sent',
    });

    (
      client as unknown as {
        handleIncomingMessageProfileSync: (message: Message) => void;
      }
    ).handleIncomingMessageProfileSync(message);

    expect(message.sender).toEqual({
      userId: 'bob',
      nickname: 'Bob',
      avatarUrl: 'https://cdn.example.com/bob.png',
    });
    expect(enqueueUserInfo).not.toHaveBeenCalled();
    expect(enqueueGroupNamecard).not.toHaveBeenCalled();
  });

  it('会话列表同步后应为群聊最后消息 sender 入队补拉用户资料', async () => {
    const client = createProfileSyncClient();
    const cacheManager = await createCacheManager();
    cacheManager.setUserInfoSummaries([
      {
        userId: 'cached',
        nickname: 'Cached',
        avatarUrl: 'https://cdn.example.com/cached.png',
        lastAccess: 1,
        lastUpdate: 1,
      },
    ]);
    const enqueueUserInfo = vi.fn();

    (
      client as unknown as {
        cacheManager: CacheManager;
        userInfoHydrationQueue: { enqueue: (...args: unknown[]) => void; destroy: () => void };
        enqueueMissingGroupSessionSenderUserInfos: (
          items: ReadonlyArray<ConversationItem>
        ) => void;
      }
    ).cacheManager = cacheManager;
    (
      client as unknown as {
        userInfoHydrationQueue: { enqueue: (...args: unknown[]) => void; destroy: () => void };
      }
    ).userInfoHydrationQueue = {
      enqueue: enqueueUserInfo,
      destroy: vi.fn(),
    };

    (
      client as unknown as {
        enqueueMissingGroupSessionSenderUserInfos: (
          items: ReadonlyArray<ConversationItem>
        ) => void;
      }
    ).enqueueMissingGroupSessionSenderUserInfos([
      {
        conversationId: 'group-1',
        conversationType: 'groupChat',
        unreadCount: 1,
        lastMessage: {
          msgServerId: 'm1',
          from: 'stranger',
          to: 'group-1',
          sender: { userId: 'stranger' },
          conversationId: 'group-1',
          conversationType: 'groupChat',
          type: 'text',
          timestamp: 1,
          body: { content: 'hello' },
        },
        lastMessageAt: 1,
        marks: [],
        remindType: 'DEFAULT',
        conversationName: 'group-1',
      },
      {
        conversationId: 'group-2',
        conversationType: 'groupChat',
        unreadCount: 1,
        lastMessage: {
          msgServerId: 'm2',
          from: 'cached',
          to: 'group-2',
          sender: { userId: 'cached' },
          conversationId: 'group-2',
          conversationType: 'groupChat',
          type: 'text',
          timestamp: 2,
          body: { content: 'cached' },
        },
        lastMessageAt: 2,
        marks: [],
        remindType: 'DEFAULT',
        conversationName: 'group-2',
      },
      {
        conversationId: 'bob',
        conversationType: 'singleChat',
        unreadCount: 1,
        lastMessage: {
          msgServerId: 'm3',
          from: 'bob',
          to: 'alice',
          sender: { userId: 'bob' },
          conversationId: 'bob',
          conversationType: 'singleChat',
          type: 'text',
          timestamp: 3,
          body: { content: 'single' },
        },
        lastMessageAt: 3,
        marks: [],
        remindType: 'DEFAULT',
        conversationName: 'bob',
      },
    ]);

    expect(enqueueUserInfo).toHaveBeenCalledTimes(1);
    expect(enqueueUserInfo).toHaveBeenCalledWith('stranger');
  });

  it('会话列表同步和收到消息命中同一 sender 时应通过队列合并为一次批量请求', async () => {
    vi.useFakeTimers();
    const client = createProfileSyncClient();
    const cacheManager = await createCacheManager();
    const getUserInfoByUserId = vi.fn(async (): Promise<ReadonlyArray<{ userId: string }>> => [
      { userId: 'bob' },
    ]);

    (
      client as unknown as {
        cacheManager: CacheManager;
        getManagerByCapability: () => {
          getUserInfoByUserId: typeof getUserInfoByUserId;
        };
        enqueueMissingGroupSessionSenderUserInfos: (
          items: ReadonlyArray<ConversationItem>
        ) => void;
        handleIncomingMessageProfileSync: (message: Message) => void;
      }
    ).cacheManager = cacheManager;
    (
      client as unknown as {
        getManagerByCapability: () => {
          getUserInfoByUserId: typeof getUserInfoByUserId;
        };
      }
    ).getManagerByCapability = () => ({
      getUserInfoByUserId,
    });

    (
      client as unknown as {
        enqueueMissingGroupSessionSenderUserInfos: (
          items: ReadonlyArray<ConversationItem>
        ) => void;
      }
    ).enqueueMissingGroupSessionSenderUserInfos([
      {
        conversationId: 'group-1',
        conversationType: 'groupChat',
        unreadCount: 1,
        lastMessage: {
          msgServerId: 'm1',
          from: 'bob',
          to: 'group-1',
          sender: { userId: 'bob' },
          conversationId: 'group-1',
          conversationType: 'groupChat',
          type: 'text',
          timestamp: 1,
          body: { content: 'sync' },
        },
        lastMessageAt: 1,
        marks: [],
        remindType: 'DEFAULT',
        conversationName: 'group-1',
      },
    ]);
    (
      client as unknown as {
        handleIncomingMessageProfileSync: (message: Message) => void;
      }
    ).handleIncomingMessageProfileSync(
      createMessage({
        direct: 'RECEIVE',
        sender: { userId: 'bob' },
        conversationId: 'group-1',
        conversationType: 'groupChat',
        status: 'sent',
      })
    );

    await vi.advanceTimersByTimeAsync(7000);

    expect(getUserInfoByUserId).toHaveBeenCalledTimes(1);
    expect(getUserInfoByUserId).toHaveBeenCalledWith({ userIds: ['bob'] });
  });

  it('群名片 batch/get 返回空数组时应写入空名片缓存并使用响应 timestamp 作为版本，但不派发事件', async () => {
    const client = createProfileSyncClient();
    const cacheManager = await createCacheManager();
    const restContext: RestContext = {
      restBaseUrl: 'https://api.example.com',
      appKey: 'org#app',
      userId: 'alice',
      token: 'token-1',
      clientResource: 'web',
    };

    (
      client as unknown as {
        cacheManager: CacheManager;
        currentUserId: string;
        getRestContext: () => RestContext;
        dispatchUserGroupNamecardUpdated: (
          groupId: string,
          userId: string,
          namecard: string
        ) => void;
        flushGroupNamecardHydrationBatch: (batch: {
          groupId: string;
          targets: ReadonlyArray<{ userId: string; namecardUpdateTime?: number }>;
        }) => Promise<void>;
      }
    ).cacheManager = cacheManager;
    (
      client as unknown as {
        cacheManager: CacheManager;
        currentUserId: string;
        getRestContext: () => RestContext;
        dispatchUserGroupNamecardUpdated: (
          groupId: string,
          userId: string,
          namecard: string
        ) => void;
        flushGroupNamecardHydrationBatch: (batch: {
          groupId: string;
          targets: ReadonlyArray<{ userId: string; namecardUpdateTime?: number }>;
        }) => Promise<void>;
      }
    ).currentUserId = 'alice';
    (
      client as unknown as {
        cacheManager: CacheManager;
        currentUserId: string;
        getRestContext: () => RestContext;
        dispatchUserGroupNamecardUpdated: (
          groupId: string,
          userId: string,
          namecard: string
        ) => void;
        flushGroupNamecardHydrationBatch: (batch: {
          groupId: string;
          targets: ReadonlyArray<{ userId: string; namecardUpdateTime?: number }>;
        }) => Promise<void>;
      }
    ).getRestContext = (): RestContext => restContext;

    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      action: 'post',
      data: [],
      timestamp: 1777018409174,
    });

    await (
      client as unknown as {
        flushGroupNamecardHydrationBatch: (batch: {
          groupId: string;
          targets: ReadonlyArray<{ userId: string; namecardUpdateTime?: number }>;
        }) => Promise<void>;
      }
    ).flushGroupNamecardHydrationBatch({
      groupId: 'group-1',
      targets: [{ userId: 'bob' }],
    });

    expect(cacheManager.getGroupNamecard('group-1', 'bob', false)).toEqual(
      expect.objectContaining({
        groupId: 'group-1',
        userId: 'bob',
        namecard: '',
        namecardUpdateTime: 1777018409,
      })
    );
  });

  it('群名片 batch/get 返回非空名片时应派发携带 namecard 的事件', async () => {
    const client = createProfileSyncClient();
    const cacheManager = await createCacheManager();
    const restContext: RestContext = {
      restBaseUrl: 'https://api.example.com',
      appKey: 'org#app',
      userId: 'alice',
      token: 'token-1',
      clientResource: 'web',
    };

    (
      client as unknown as {
        cacheManager: CacheManager;
        currentUserId: string;
        getRestContext: () => RestContext;
        dispatchUserGroupNamecardUpdated: (
          groupId: string,
          userId: string,
          namecard: string
        ) => void;
        flushGroupNamecardHydrationBatch: (batch: {
          groupId: string;
          targets: ReadonlyArray<{ userId: string; namecardUpdateTime?: number }>;
        }) => Promise<void>;
      }
    ).cacheManager = cacheManager;
    (
      client as unknown as {
        cacheManager: CacheManager;
        currentUserId: string;
        getRestContext: () => RestContext;
        dispatchUserGroupNamecardUpdated: (
          groupId: string,
          userId: string,
          namecard: string
        ) => void;
        flushGroupNamecardHydrationBatch: (batch: {
          groupId: string;
          targets: ReadonlyArray<{ userId: string; namecardUpdateTime?: number }>;
        }) => Promise<void>;
      }
    ).currentUserId = 'alice';
    (
      client as unknown as {
        cacheManager: CacheManager;
        currentUserId: string;
        getRestContext: () => RestContext;
        dispatchUserGroupNamecardUpdated: (
          groupId: string,
          userId: string,
          namecard: string
        ) => void;
        flushGroupNamecardHydrationBatch: (batch: {
          groupId: string;
          targets: ReadonlyArray<{ userId: string; namecardUpdateTime?: number }>;
        }) => Promise<void>;
      }
    ).getRestContext = (): RestContext => restContext;

    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      action: 'post',
      data: [
        {
          username: 'bob',
          group_id: 'group-1',
          name_card: '13',
          update_timestamp: 1777018292000,
        },
      ],
      timestamp: 1777018409174,
    });

    await (
      client as unknown as {
        flushGroupNamecardHydrationBatch: (batch: {
          groupId: string;
          targets: ReadonlyArray<{ userId: string; namecardUpdateTime?: number }>;
        }) => Promise<void>;
      }
    ).flushGroupNamecardHydrationBatch({
      groupId: 'group-1',
      targets: [{ userId: 'bob' }],
    });

    expect(cacheManager.getGroupNamecard('group-1', 'bob', false)).toEqual(
      expect.objectContaining({
        groupId: 'group-1',
        userId: 'bob',
        namecard: '13',
        namecardUpdateTime: 1777018292,
      })
    );
  });

  it('enableUserInfoSync=true 且 sidecar 版本领先缓存时应按版本入队补拉', async () => {
    const client = createProfileSyncClient();
    const cacheManager = await createCacheManager();
    cacheManager.setUserInfoSummaries([
      {
        userId: 'bob',
        nickname: 'Bob',
        userInfoUpdateTime: 10,
        lastAccess: 1,
        lastUpdate: 1,
      },
    ]);
    cacheManager.setGroupNamecards([
      {
        groupId: 'group-1',
        userId: 'bob',
        namecard: 'Bob Card',
        namecardUpdateTime: 20,
        lastSyncAt: 1,
        lastAccess: 1,
        lastUpdate: 1,
      },
    ]);

    const enqueueUserInfo = vi.fn();
    const enqueueGroupNamecard = vi.fn();
    (
      client as unknown as {
        cacheManager: CacheManager;
        userInfoHydrationQueue: { enqueue: (...args: unknown[]) => void; destroy: () => void };
        groupNamecardHydrationQueue: {
          enqueue: (...args: unknown[]) => void;
          destroy: () => void;
        };
        handleIncomingMessageProfileSync: (message: Message) => void;
      }
    ).cacheManager = cacheManager;
    (
      client as unknown as {
        cacheManager: CacheManager;
        userInfoHydrationQueue: { enqueue: (...args: unknown[]) => void; destroy: () => void };
        groupNamecardHydrationQueue: {
          enqueue: (...args: unknown[]) => void;
          destroy: () => void;
        };
        handleIncomingMessageProfileSync: (message: Message) => void;
      }
    ).userInfoHydrationQueue = {
      enqueue: enqueueUserInfo,
      destroy: vi.fn(),
    };
    (
      client as unknown as {
        cacheManager: CacheManager;
        userInfoHydrationQueue: { enqueue: (...args: unknown[]) => void; destroy: () => void };
        groupNamecardHydrationQueue: {
          enqueue: (...args: unknown[]) => void;
          destroy: () => void;
        };
        handleIncomingMessageProfileSync: (message: Message) => void;
      }
    ).groupNamecardHydrationQueue = {
      enqueue: enqueueGroupNamecard,
      destroy: vi.fn(),
    };

    const message = createMessage({
      direct: 'RECEIVE',
      sender: { userId: 'bob' },
      conversationId: 'group-1',
      conversationType: 'groupChat',
      status: 'sent',
    });
    setMessageProfileVersionSidecar(message, {
      userInfoUpdateTime: 11,
      namecardUpdateTime: 21,
    });

    (
      client as unknown as {
        handleIncomingMessageProfileSync: (message: Message) => void;
      }
    ).handleIncomingMessageProfileSync(message);

    expect(enqueueUserInfo).toHaveBeenCalledWith('bob', 11);
    expect(enqueueGroupNamecard).toHaveBeenCalledWith('group-1', 'bob', 21);
  });

  it('enableUserInfoSync=true 且 sidecar 版本未领先缓存时不应重复入队', async () => {
    const client = createProfileSyncClient();
    const cacheManager = await createCacheManager();
    cacheManager.setUserInfoSummaries([
      {
        userId: 'bob',
        nickname: 'Bob',
        userInfoUpdateTime: 12,
        lastAccess: 1,
        lastUpdate: 1,
      },
    ]);
    cacheManager.setGroupNamecards([
      {
        groupId: 'group-1',
        userId: 'bob',
        namecard: 'Bob Card',
        namecardUpdateTime: 22,
        lastSyncAt: 1,
        lastAccess: 1,
        lastUpdate: 1,
      },
    ]);

    const enqueueUserInfo = vi.fn();
    const enqueueGroupNamecard = vi.fn();
    (
      client as unknown as {
        cacheManager: CacheManager;
        userInfoHydrationQueue: { enqueue: (...args: unknown[]) => void; destroy: () => void };
        groupNamecardHydrationQueue: {
          enqueue: (...args: unknown[]) => void;
          destroy: () => void;
        };
        handleIncomingMessageProfileSync: (message: Message) => void;
      }
    ).cacheManager = cacheManager;
    (
      client as unknown as {
        cacheManager: CacheManager;
        userInfoHydrationQueue: { enqueue: (...args: unknown[]) => void; destroy: () => void };
        groupNamecardHydrationQueue: {
          enqueue: (...args: unknown[]) => void;
          destroy: () => void;
        };
        handleIncomingMessageProfileSync: (message: Message) => void;
      }
    ).userInfoHydrationQueue = {
      enqueue: enqueueUserInfo,
      destroy: vi.fn(),
    };
    (
      client as unknown as {
        cacheManager: CacheManager;
        userInfoHydrationQueue: { enqueue: (...args: unknown[]) => void; destroy: () => void };
        groupNamecardHydrationQueue: {
          enqueue: (...args: unknown[]) => void;
          destroy: () => void;
        };
        handleIncomingMessageProfileSync: (message: Message) => void;
      }
    ).groupNamecardHydrationQueue = {
      enqueue: enqueueGroupNamecard,
      destroy: vi.fn(),
    };

    const message = createMessage({
      direct: 'RECEIVE',
      sender: { userId: 'bob' },
      conversationId: 'group-1',
      conversationType: 'groupChat',
      status: 'sent',
    });
    setMessageProfileVersionSidecar(message, {
      userInfoUpdateTime: 11,
      namecardUpdateTime: 21,
    });

    (
      client as unknown as {
        handleIncomingMessageProfileSync: (message: Message) => void;
      }
    ).handleIncomingMessageProfileSync(message);

    expect(enqueueUserInfo).not.toHaveBeenCalled();
    expect(enqueueGroupNamecard).not.toHaveBeenCalled();
  });

  it('flushUserInfoHydrationTargets 应拆分 self/others 并对 partial 结果告警', async () => {
    const client = createProfileSyncClient();
    const dispatchOwnInfoUpdated = vi.fn();
    const dispatchUserInfoUpdated = vi.fn();
    const refreshConversationDisplayFromUserInfos = vi.fn();
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    (
      client as unknown as {
        currentUserId: string | null;
        getManagerByCapability: () => {
          getUserInfoByUserId: (params: { userIds: string[] }) => Promise<
            ReadonlyArray<{
              userId: string;
              nickname?: string;
            }>
          >;
        };
        dispatchOwnInfoUpdated: (userInfo: { userId: string; nickname?: string }) => void;
        dispatchUserInfoUpdated: (
          userInfos: ReadonlyArray<{ userId: string; nickname?: string }>
        ) => void;
        refreshConversationDisplayFromUserInfos: (
          targets: ReadonlyArray<{ userId: string }>
        ) => void;
        flushUserInfoHydrationTargets: (
          targets: ReadonlyArray<{ userId: string }>
        ) => Promise<void>;
      }
    ).currentUserId = 'alice';
    (
      client as unknown as {
        currentUserId: string | null;
        getManagerByCapability: () => {
          getUserInfoByUserId: (params: { userIds: string[] }) => Promise<
            ReadonlyArray<{
              userId: string;
              nickname?: string;
            }>
          >;
        };
        dispatchOwnInfoUpdated: (userInfo: { userId: string; nickname?: string }) => void;
        dispatchUserInfoUpdated: (
          userInfos: ReadonlyArray<{ userId: string; nickname?: string }>
        ) => void;
        refreshConversationDisplayFromUserInfos: (
          targets: ReadonlyArray<{ userId: string }>
        ) => void;
        flushUserInfoHydrationTargets: (
          targets: ReadonlyArray<{ userId: string }>
        ) => Promise<void>;
      }
    ).getManagerByCapability = () => ({
      getUserInfoByUserId: async (): Promise<
        ReadonlyArray<{
          userId: string;
          nickname?: string;
        }>
      > => [
        { userId: 'alice', nickname: 'Alice' },
        { userId: 'bob', nickname: 'Bob' },
      ],
    });
    (
      client as unknown as {
        dispatchOwnInfoUpdated: (userInfo: { userId: string; nickname?: string }) => void;
      }
    ).dispatchOwnInfoUpdated = dispatchOwnInfoUpdated;
    (
      client as unknown as {
        dispatchUserInfoUpdated: (
          userInfos: ReadonlyArray<{ userId: string; nickname?: string }>
        ) => void;
      }
    ).dispatchUserInfoUpdated = dispatchUserInfoUpdated;
    (
      client as unknown as {
        refreshConversationDisplayFromUserInfos: (
          targets: ReadonlyArray<{ userId: string }>
        ) => void;
      }
    ).refreshConversationDisplayFromUserInfos = refreshConversationDisplayFromUserInfos;

    await (
      client as unknown as {
        flushUserInfoHydrationTargets: (
          targets: ReadonlyArray<{ userId: string }>
        ) => Promise<void>;
      }
    ).flushUserInfoHydrationTargets([{ userId: 'alice' }, { userId: 'bob' }, { userId: 'carol' }]);

    expect(dispatchOwnInfoUpdated).toHaveBeenCalledWith({ userId: 'alice', nickname: 'Alice' });
    expect(dispatchUserInfoUpdated).toHaveBeenCalledWith([{ userId: 'bob', nickname: 'Bob' }]);
    expect(refreshConversationDisplayFromUserInfos).toHaveBeenCalledWith(
      [
        { userId: 'alice' },
        { userId: 'bob' },
      ],
      'profile'
    );
    expect(warnSpy).toHaveBeenCalledWith('User info hydration returned partial result', {
      requestedUserIds: ['alice', 'bob', 'carol'],
      missingUserIds: ['carol'],
    });
  });

  it('flushUserInfoHydrationTargets fetch 失败时应告警并吞掉异常', async () => {
    const client = createProfileSyncClient();
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    (
      client as unknown as {
        getManagerByCapability: () => {
          getUserInfoByUserId: () => Promise<never>;
        };
        flushUserInfoHydrationTargets: (
          targets: ReadonlyArray<{ userId: string }>
        ) => Promise<void>;
      }
    ).getManagerByCapability = () => ({
      getUserInfoByUserId: async (): Promise<never> => {
        throw new Error('network');
      },
    });

    await expect(
      (
        client as unknown as {
          flushUserInfoHydrationTargets: (
            targets: ReadonlyArray<{ userId: string }>
          ) => Promise<void>;
        }
      ).flushUserInfoHydrationTargets([{ userId: 'bob' }])
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith('User info hydration failed', {
      userIds: ['bob'],
      error: expect.any(Error),
    });
  });

  it('flushGroupNamecardHydrationBatch 缺少 rest context 时应告警并跳过', async () => {
    const client = createProfileSyncClient();
    const cacheManager = await createCacheManager();
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    (
      client as unknown as {
        cacheManager: CacheManager;
        getRestContext: () => RestContext;
        flushGroupNamecardHydrationBatch: (batch: {
          groupId: string;
          targets: ReadonlyArray<{ userId: string; namecardUpdateTime?: number }>;
        }) => Promise<void>;
      }
    ).cacheManager = cacheManager;
    (
      client as unknown as {
        cacheManager: CacheManager;
        getRestContext: () => RestContext;
        flushGroupNamecardHydrationBatch: (batch: {
          groupId: string;
          targets: ReadonlyArray<{ userId: string; namecardUpdateTime?: number }>;
        }) => Promise<void>;
      }
    ).getRestContext = (): RestContext => {
      throw new Error('missing rest context');
    };

    await (
      client as unknown as {
        flushGroupNamecardHydrationBatch: (batch: {
          groupId: string;
          targets: ReadonlyArray<{ userId: string; namecardUpdateTime?: number }>;
        }) => Promise<void>;
      }
    ).flushGroupNamecardHydrationBatch({
      groupId: 'group-1',
      targets: [{ userId: 'bob' }],
    });

    expect(warnSpy).toHaveBeenCalledWith('Group namecard hydration returned partial result', {
      groupId: 'group-1',
      requestedUserIds: ['bob'],
      error: expect.any(Error),
    });
  });

  it('flushGroupNamecardHydrationBatch partial 且无 responseTimestamp 时应告警', async () => {
    const client = createProfileSyncClient();
    const cacheManager = await createCacheManager();
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const restContext: RestContext = {
      restBaseUrl: 'https://api.example.com',
      appKey: 'org#app',
      userId: 'alice',
      token: 'token-1',
      clientResource: 'web',
    };

    (
      client as unknown as {
        cacheManager: CacheManager;
        currentUserId: string;
        getRestContext: () => RestContext;
        flushGroupNamecardHydrationBatch: (batch: {
          groupId: string;
          targets: ReadonlyArray<{ userId: string; namecardUpdateTime?: number }>;
        }) => Promise<void>;
      }
    ).cacheManager = cacheManager;
    (
      client as unknown as {
        cacheManager: CacheManager;
        currentUserId: string;
        getRestContext: () => RestContext;
        flushGroupNamecardHydrationBatch: (batch: {
          groupId: string;
          targets: ReadonlyArray<{ userId: string; namecardUpdateTime?: number }>;
        }) => Promise<void>;
      }
    ).currentUserId = 'alice';
    (
      client as unknown as {
        cacheManager: CacheManager;
        currentUserId: string;
        getRestContext: () => RestContext;
        flushGroupNamecardHydrationBatch: (batch: {
          groupId: string;
          targets: ReadonlyArray<{ userId: string; namecardUpdateTime?: number }>;
        }) => Promise<void>;
      }
    ).getRestContext = (): RestContext => restContext;
    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      action: 'post',
      data: [
        {
          username: 'bob',
          group_id: 'group-1',
          name_card: 'Bob Card',
          update_timestamp: 1777018292000,
        },
      ],
    });

    await (
      client as unknown as {
        flushGroupNamecardHydrationBatch: (batch: {
          groupId: string;
          targets: ReadonlyArray<{ userId: string; namecardUpdateTime?: number }>;
        }) => Promise<void>;
      }
    ).flushGroupNamecardHydrationBatch({
      groupId: 'group-1',
      targets: [{ userId: 'bob' }, { userId: 'carol' }],
    });

    expect(warnSpy).toHaveBeenCalledWith('Group namecard hydration returned partial result', {
      groupId: 'group-1',
      requestedUserIds: ['bob', 'carol'],
      missingUserIds: ['carol'],
    });
  });

  it('refreshContactSnapshot 缺少会话上下文时应直接返回', async () => {
    const client = createProfileSyncClient();
    const ensureContactSyncController = vi.fn();
    (
      client as unknown as {
        ensureContactSyncController: () => { sync: () => Promise<void> };
      }
    ).ensureContactSyncController = ensureContactSyncController;

    await client.refreshContactSnapshot();

    expect(ensureContactSyncController).not.toHaveBeenCalled();
  });

  it('refreshContactSnapshot 有会话上下文时应复用联系人同步控制器', async () => {
    const client = createProfileSyncClient();
    const cacheManager = await createCacheManager();
    const sync = vi.fn(async (): Promise<void> => {});

    (
      client as unknown as {
        cacheManager: CacheManager;
        currentUserId: string;
        ensureContactSyncController: () => { sync: () => Promise<void> };
      }
    ).cacheManager = cacheManager;
    (
      client as unknown as {
        cacheManager: CacheManager;
        currentUserId: string;
        ensureContactSyncController: () => { sync: () => Promise<void> };
      }
    ).currentUserId = 'alice';
    (
      client as unknown as {
        ensureContactSyncController: () => { sync: () => Promise<void> };
      }
    ).ensureContactSyncController = () => ({
      sync,
    });

    await client.refreshContactSnapshot();

    expect(sync).toHaveBeenCalledTimes(1);
  });
});
