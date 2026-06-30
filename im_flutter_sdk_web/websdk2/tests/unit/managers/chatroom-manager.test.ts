import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatClient } from '@/chat-client';
import { ChatRoom } from '@/managers/chatroom';
import { ChatRoomManager } from '@/managers/chatroom-manager';
import { RestClient } from '@/rest/client';
import type { RestContext } from '@/types/chat-client';
import { ChatRoomDispatchEventName } from '@/types/event-system';
import { ERROR_CODES } from '@/utils/error-codes';
import { SDKError } from '@/utils/errors';

const DEFAULT_REST_CONTEXT: RestContext = {
  restBaseUrl: 'https://api.example.com',
  appKey: 'org#app',
  userId: 'alice',
  token: 'token',
  clientResource: 'web',
};

const createMockClient = (options?: {
  readonly restContext?: RestContext;
  readonly cacheManager?: {
    getUserInfoSummaries?: (
      userIds: ReadonlyArray<string>,
      updateAccess: boolean
    ) => ReadonlyArray<{
      userId: string;
      nickname?: string;
      avatarUrl?: string;
      sign?: string;
      ext?: string;
      lastAccess?: number;
      lastUpdate?: number;
    }>;
    setUserInfoSummaries?: (
      items: ReadonlyArray<{
        userId: string;
        nickname?: string;
        avatarUrl?: string;
        sign?: string;
        ext?: string;
        lastAccess?: number;
        lastUpdate?: number;
      }>
    ) => void;
  } | null;
}): ChatClient => {
  const restContext = options?.restContext ?? DEFAULT_REST_CONTEXT;
  const cacheManager = options?.cacheManager ?? null;

  return {
    getRestContext: (): RestContext => restContext,
    getCacheManager: (): typeof cacheManager => cacheManager,
    sendChatRoomOperation: vi.fn().mockResolvedValue({
      protocolId: '1001',
      serverId: 'server-1',
      statusCode: 0,
    }),
  } as unknown as ChatClient;
};

describe('ChatRoomManager', () => {
  let manager: ChatRoomManager;

  beforeEach((): void => {
    manager = new ChatRoomManager();
    manager.bind(createMockClient());
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('addEventHandler/removeEventHandler 应委托给 eventContext 并映射到内部事件名', () => {
    const addEventHandler = vi.fn();
    const removeEventHandler = vi.fn();
    const handler = vi.fn();

    manager.bind(createMockClient(), {
      addEventHandler,
      removeEventHandler,
    });

    manager.addEventHandler('chatroom-ui', {
      onAdminAdded: handler,
    });
    manager.removeEventHandler('chatroom-ui');

    expect(addEventHandler).toHaveBeenCalledWith('chatroom-ui', {
      [ChatRoomDispatchEventName.ADMIN_ADDED]: handler,
    });
    expect(removeEventHandler).toHaveBeenCalledWith('chatroom-ui');
  });

  it('getChatRoom 应返回可复用的 ChatRoom 实例', () => {
    const first = manager.getChatRoom('g1');
    const second = manager.getChatRoom('g1');

    expect(first).toBeInstanceOf(ChatRoom);
    expect(first).toBe(second);
    expect(first.chatRoomId).toBe('g1');
  });

  it('getChatRoom chatRoomId 为空时应抛出 ValidationError', () => {
    try {
      manager.getChatRoom('   ');
      throw new Error('expected getChatRoom to throw');
    } catch (error) {
      expect(error).toMatchObject({
        code: ERROR_CODES.VALIDATION_REQUIRED,
      });
    }
  });

  it('getChatRoomInfo 应使用缓存补齐 owner 对象', async () => {
    manager.bind(
      createMockClient({
        cacheManager: {
          getUserInfoSummaries: (
            userIds
          ): ReadonlyArray<{
            userId: string;
            nickname?: string;
            avatarUrl?: string;
            sign?: string;
            ext?: string;
          }> =>
            userIds.includes('owner')
              ? [
                  {
                    userId: 'owner',
                    nickname: 'Owner',
                    avatarUrl: 'https://cdn.example.com/owner.png',
                  },
                ]
              : [],
        },
      })
    );

    const requestSpy = vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      data: [
        {
          id: 'g1',
          name: 'ChatRoom 1',
          owner: 'owner',
        },
      ],
    });

    const result = await manager.getChatRoomInfo({
      chatRoomId: 'g1',
    });

    expect(result).toMatchObject({
      chatRoomId: 'g1',
      name: 'ChatRoom 1',
      owner: {
        userId: 'owner',
        nickname: 'Owner',
        avatarUrl: 'https://cdn.example.com/owner.png',
      },
    });
    expect(requestSpy).toHaveBeenCalledTimes(1);
  });

  it('getAdminList 应对仅返回 userId 的结果执行对象化补齐', async () => {
    const requestSpy = vi
      .spyOn(RestClient.prototype, 'request')
      .mockImplementation(
        async (_endpoint: string, config?: { operation?: string }): Promise<unknown> => {
          if (config?.operation === 'getChatRoomAdminList') {
            return {
              data: ['bob'],
            };
          }
          if (config?.operation === 'getUserInfoByUserId') {
            return {
              data: {
                bob: {
                  nickname: 'Bob',
                  avatarurl: 'https://cdn.example.com/bob.png',
                },
              },
              lastModified: {
                bob: 1,
              },
            };
          }
          return {};
        }
      );

    const result = await manager.getAdminList({
      chatRoomId: 'g1',
    });

    expect(result).toEqual([
      {
        userId: 'bob',
        nickname: 'Bob',
        avatarUrl: 'https://cdn.example.com/bob.png',
      },
    ]);
    expect(requestSpy).toHaveBeenCalledTimes(2);
  });

  it('底层抛普通 Error 时应归一化为 SDKError', async () => {
    vi.spyOn(RestClient.prototype, 'request').mockRejectedValue(new Error('network'));

    await expect(manager.getChatRoomList()).rejects.toMatchObject({
      code: ERROR_CODES.UNKNOWN,
      message: 'ChatRoomManager getChatRoomList failed: network',
    });
  });

  it('底层已是 SDKError 时应原样抛出', async () => {
    const sdkError = new SDKError('boom', ERROR_CODES.REST_HTTP_ERROR);
    const sendChatRoomOperation = vi.fn().mockRejectedValue(sdkError);
    manager.bind({
      ...createMockClient(),
      sendChatRoomOperation,
    } as unknown as ChatClient);

    await expect(manager.getChatRoom('g1').leaveChatRoom()).rejects.toBe(sdkError);
  });

  it('底层业务错误应保留 api/serverCode 等 details', async () => {
    const sdkError = new SDKError('聊天室不存在', 606, {
      details: {
        api: 'getChatRoomInfo',
        mapped: true,
        reasonKey: 'resource_not_found',
        serverCode: 'resource_not_found',
        serverMessage: 'grpID g1 does not exist!',
        httpStatus: 404,
      },
    });
    vi.spyOn(RestClient.prototype, 'request').mockRejectedValue(sdkError);

    await expect(
      manager.getChatRoomInfo({
        chatRoomId: 'g1',
      })
    ).rejects.toMatchObject({
      code: 606,
      details: expect.objectContaining({
        api: 'getChatRoomInfo',
        mapped: true,
        reasonKey: 'resource_not_found',
        serverCode: 'resource_not_found',
      }),
    });
  });

  it('新 chatroom API 公开方法应走通统一 request/normalize 链路', async () => {
    const requestSpy = vi
      .spyOn(RestClient.prototype, 'request')
      .mockImplementation(
        async (_endpoint: string, config?: { operation?: string }): Promise<unknown> => {
          switch (config?.operation) {
            case 'getChatRoomList':
              return {
                data: [{ id: 'r1', title: 'Room 1' }],
                count: 1,
                params: { pagenum: ['1'], pagesize: ['20'] },
              };
            case 'getChatRoomInfo':
              return {
                data: [{ id: 'r1', title: 'Room 1', owner: 'owner1', white: true, muted: false }],
              };
            case 'updateChatRoomInfo':
              return { data: { groupname: true, description: true, maxusers: true } };
            case 'getChatRoomMemberList':
              return {
                data: [
                  { owner: 'owner1', joined_time: 1 },
                  { admin: 'admin1', joined_time: 2 },
                  { member: 'member1', joined_time: 3 },
                ],
                params: { pagenum: ['1'], pagesize: ['20'] },
              };
            case 'addChatRoomMembers':
            case 'removeChatRoomMembers':
            case 'blockChatRoomMembers':
            case 'unblockChatRoomMembers':
            case 'addUsersToChatRoomAllowlist':
            case 'removeUsersFromChatRoomAllowlist':
              return {
                data: [
                  {
                    id: 'r1',
                    user: 'bob',
                    action: config.operation,
                    result: true,
                  },
                ],
              };
            case 'getChatRoomAdminList':
              return { data: ['bob'] };
            case 'getUserInfoByUserId':
              return {
                data: {
                  bob: { nickname: 'Bob' },
                  owner1: { nickname: 'Owner' },
                },
                lastModified: {
                  bob: 1,
                  owner1: 2,
                },
              };
            case 'getChatRoomMuteList':
              return { data: [{ user: 'bob', muteExpire: '60' }] };
            case 'checkIfInChatRoomMuteList':
              return { data: { muted: true, expire: '60' } };
            case 'getChatRoomBlocklist':
            case 'getChatRoomAllowlist':
              return { data: ['bob'] };
            case 'checkIfInChatRoomAllowList':
              return { data: { white: true } };
            case 'getChatRoomAnnouncement':
              return { data: { announcement: 'notice' } };
            case 'getChatRoomAttributes':
              return { data: { topic: 'sdk' } };
            case 'setChatRoomAttributes':
            case 'removeChatRoomAttributes':
              return {
                data: {
                  successKeys: ['topic'],
                  errorKeys: { failed: 'not-allowed' },
                },
              };
            default:
              return {};
          }
        }
      );

    await expect(manager.getChatRoomList({ pageNum: 1, pageSize: 20 })).resolves.toMatchObject({
      items: [{ chatRoomId: 'r1', name: 'Room 1' }],
    });
    await expect(manager.getChatRoomInfo({ chatRoomId: 'r1' })).resolves.toMatchObject({
      chatRoomId: 'r1',
      owner: { userId: 'owner1' },
      currentUserStatus: { inAllowlist: true, muted: false },
    });
    await expect(
      manager.updateChatRoomInfo({
        chatRoomId: 'r1',
        name: 'Room 1',
        description: 'desc',
        maxMembers: 300,
      })
    ).resolves.toEqual({
      nameUpdated: true,
      descriptionUpdated: true,
      maxMembersUpdated: true,
    });

    await expect(
      manager.getMemberList({ chatRoomId: 'r1', pageSize: 20 })
    ).resolves.toMatchObject({
      items: [
        { user: { userId: 'owner1' }, role: 'owner' },
        { user: { userId: 'admin1' }, role: 'admin' },
        { user: { userId: 'member1' }, role: 'member' },
      ],
    });
    await expect(
      manager.removeMembers({ chatRoomId: 'r1', userIds: ['bob'] })
    ).resolves.toMatchObject({
      succeeded: [{ action: 'removeChatRoomMembers', user: { userId: 'bob' } }],
      failed: [],
    });
    await expect(manager.getAdminList({ chatRoomId: 'r1' })).resolves.toEqual([
      { userId: 'bob', nickname: 'Bob' },
    ]);
    await expect(manager.addAdmin({ chatRoomId: 'r1', userId: 'bob' })).resolves.toBeUndefined();
    await expect(manager.removeAdmin({ chatRoomId: 'r1', userId: 'bob' })).resolves.toBeUndefined();
    await expect(manager.getMuteList({ chatRoomId: 'r1' })).resolves.toEqual([
      { user: { userId: 'bob', nickname: 'Bob' }, muteExpire: 60 },
    ]);
    await expect(
      manager.muteMembers({ chatRoomId: 'r1', userIds: ['bob'], duration: 60 })
    ).resolves.toBeUndefined();
    await expect(
      manager.unmuteMembers({ chatRoomId: 'r1', userIds: ['bob'] })
    ).resolves.toBeUndefined();
    await expect(manager.muteAllMembers({ chatRoomId: 'r1' })).resolves.toBeUndefined();
    await expect(manager.unmuteAllMembers({ chatRoomId: 'r1' })).resolves.toBeUndefined();
    await expect(manager.checkIfInMuteList({ chatRoomId: 'r1' })).resolves.toEqual({
      muted: true,
      muteExpireAt: 60,
    });
    await expect(manager.getBlocklist({ chatRoomId: 'r1' })).resolves.toEqual([
      { user: { userId: 'bob', nickname: 'Bob' } },
    ]);
    await expect(
      manager.blockMembers({ chatRoomId: 'r1', userIds: ['bob'] })
    ).resolves.toMatchObject({
      succeeded: [{ action: 'blockChatRoomMembers', user: { userId: 'bob' } }],
      failed: [],
    });
    await expect(
      manager.unblockMembers({ chatRoomId: 'r1', userIds: ['bob'] })
    ).resolves.toMatchObject({
      succeeded: [{ action: 'unblockChatRoomMembers', user: { userId: 'bob' } }],
      failed: [],
    });
    await expect(manager.getAllowlist({ chatRoomId: 'r1' })).resolves.toEqual([
      { user: { userId: 'bob', nickname: 'Bob' } },
    ]);
    await expect(
      manager.addUsersToAllowlist({ chatRoomId: 'r1', userIds: ['bob'] })
    ).resolves.toMatchObject({
      succeeded: [{ action: 'addUsersToChatRoomAllowlist', user: { userId: 'bob' } }],
      failed: [],
    });
    await expect(
      manager.removeUsersFromAllowlist({ chatRoomId: 'r1', userIds: ['bob'] })
    ).resolves.toMatchObject({
      succeeded: [{ action: 'removeUsersFromChatRoomAllowlist', user: { userId: 'bob' } }],
      failed: [],
    });
    await expect(manager.checkIfInAllowList({ chatRoomId: 'r1' })).resolves.toBe(true);
    await expect(manager.getAnnouncement({ chatRoomId: 'r1' })).resolves.toEqual({
      announcement: 'notice',
    });
    await expect(
      manager.updateAnnouncement({ chatRoomId: 'r1', announcement: 'updated' })
    ).resolves.toBeUndefined();
    await expect(
      manager.getAttributes({ chatRoomId: 'r1', keys: ['topic'] })
    ).resolves.toEqual({
      chatRoomId: 'r1',
      attributes: { topic: 'sdk' },
    });
    await expect(
      manager.setAttributes({ chatRoomId: 'r1', attributes: { topic: 'sdk' } })
    ).resolves.toEqual({
      chatRoomId: 'r1',
      appliedKeys: ['topic'],
      failedKeys: { failed: { code: 303, message: 'not-allowed' } },
    });
    await expect(
      manager.removeAttributes({ chatRoomId: 'r1', keys: ['topic'] })
    ).resolves.toEqual({
      chatRoomId: 'r1',
      appliedKeys: ['topic'],
      failedKeys: { failed: { code: 303, message: 'not-allowed' } },
    });

    expect(requestSpy).toHaveBeenCalled();
  });

  it('joinChatRoom/leaveChatRoom 应走 WebSocket MUC 操作而不是 REST 成员接口', async () => {
    const sendChatRoomOperation = vi.fn().mockResolvedValue({
      protocolId: '1001',
      serverId: 'server-1',
      statusCode: 0,
    });
    const requestSpy = vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({});
    manager.bind({
      ...createMockClient(),
      sendChatRoomOperation,
    } as unknown as ChatClient);

    await expect(
      manager.joinChatRoom({
        chatRoomId: ' r1 ',
        ext: 'hello',
        leaveOtherRooms: false,
      })
    ).resolves.toBeUndefined();
    await expect(manager.leaveChatRoom({ chatRoomId: ' r1 ' })).resolves.toBeUndefined();

    expect(sendChatRoomOperation).toHaveBeenNthCalledWith(1, {
      operation: 'join',
      chatRoomId: 'r1',
      ext: 'hello',
      leaveOtherRooms: false,
    });
    expect(sendChatRoomOperation).toHaveBeenNthCalledWith(2, {
      operation: 'leave',
      chatRoomId: 'r1',
    });
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it('joinChatRoom 应精确校验 ext 与 leaveOtherRooms 类型', async () => {
    await expect(
      manager.joinChatRoom({ chatRoomId: 'r1', ext: 1 as unknown as string })
    ).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
      message: 'params.ext must be a string',
      details: {
        fields: [
          {
            path: 'params.ext',
            message: 'params.ext must be a string',
            rule: 'invalid_format',
          },
        ],
      },
    });

    await expect(
      manager.joinChatRoom({
        chatRoomId: 'r1',
        leaveOtherRooms: 'yes' as unknown as boolean,
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
      message: 'params.leaveOtherRooms must be a boolean',
      details: {
        fields: [
          {
            path: 'params.leaveOtherRooms',
            message: 'params.leaveOtherRooms must be a boolean',
            rule: 'invalid_format',
          },
        ],
      },
    });
  });
});
