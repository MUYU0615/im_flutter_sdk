import { describe, expect, it, vi } from 'vitest';

import {
  normalizeChatRoomId,
  normalizeChatRoomUserIds,
  requestAddChatRoomMembers,
  requestBlockChatRoomMembers,
  requestDeleteChatRoomSharedFile,
  requestGetChatRoomAttributes,
  requestGetChatRoomInfo,
  requestGetChatRoomMuteList,
  requestCheckIfInChatRoomAllowList,
  requestJoinChatRoom,
  requestRemoveChatRoomAttributes,
  requestRemoveChatRoomMembers,
  requestSetChatRoomAttributes,
  requestSetChatRoomAdmin,
  requestUpdateChatRoomAnnouncement,
  requestUpdateChatRoomInfo,
} from '@/rest/chatroom-management';
import type { RestContext } from '@/types/chat-client';
import { ERROR_CODES } from '@/utils/error-codes';
import { ValidationError } from '@/utils/errors';

const DEFAULT_CONTEXT: RestContext = {
  restBaseUrl: 'https://api.example.com',
  appKey: 'org#app',
  userId: 'alice',
  token: 'token-1',
  clientResource: 'web',
};

const createRestClient = () => {
  return {
    post: vi.fn(
      (_endpoint: string, _body?: unknown, _config?: unknown): Promise<unknown> =>
        Promise.resolve(undefined)
    ),
    get: vi.fn(
      (_endpoint: string, _config?: unknown): Promise<unknown> => Promise.resolve(undefined)
    ),
    put: vi.fn(
      (_endpoint: string, _body?: unknown, _config?: unknown): Promise<unknown> =>
        Promise.resolve(undefined)
    ),
    delete: vi.fn(
      (_endpoint: string, _config?: unknown): Promise<unknown> => Promise.resolve(undefined)
    ),
    request: vi.fn(
      (_endpoint: string, _config?: unknown): Promise<unknown> => Promise.resolve(undefined)
    ),
  };
};

const expectValidationCode = (task: () => unknown, code: number): void => {
  try {
    task();
    expect.unreachable('expected validation error');
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).code).toBe(code);
  }
};

describe('chatroom-management helpers', () => {
  it('normalizeChatRoomUserIds 应 trim + 去重并保持顺序', () => {
    expect(normalizeChatRoomUserIds(['  u1  ', 'u2', 'u1', ''], 'params.userIds')).toEqual([
      'u1',
      'u2',
    ]);
  });

  it('normalizeChatRoomUserIds/normalizeChatRoomId 非法时应抛统一校验错误', () => {
    expectValidationCode(
      () => normalizeChatRoomUserIds(['   '], 'params.userIds'),
      ERROR_CODES.VALIDATION_REQUIRED
    );
    expectValidationCode(
      () => normalizeChatRoomUserIds([1 as unknown as string], 'params.userIds'),
      ERROR_CODES.VALIDATION_INVALID_FORMAT
    );
    expectValidationCode(
      () => normalizeChatRoomId('   ', 'params.chatRoomId'),
      ERROR_CODES.VALIDATION_REQUIRED
    );
  });
});

describe('chatroom-management requests', () => {
  it('requestAddChatRoomMembers 应去重 userIds 并构造 users endpoint', async () => {
    const client = createRestClient();
    client.post.mockResolvedValue({
      data: [
        {
          id: 'r1',
          user: 'bob',
          action: 'add',
          result: true,
        },
        {
          id: 'r1',
          user: 'carol',
          action: 'add',
          result: true,
        },
      ],
    });

    const result = await requestAddChatRoomMembers(client as never, DEFAULT_CONTEXT, {
      chatRoomId: 'r1',
      userIds: ['bob', 'bob', 'carol'],
    });

    expect(client.post).toHaveBeenCalledWith(
      '/org/app/chatrooms/r1/users?resource=web',
      {
        usernames: ['bob', 'carol'],
      },
      {
        operation: 'addChatRoomMembers',
      }
    );
    expect(result.succeeded).toEqual([
      {
        action: 'add',
        chatRoomId: 'r1',
        user: { userId: 'bob' },
      },
      {
        action: 'add',
        chatRoomId: 'r1',
        user: { userId: 'carol' },
      },
    ]);
    expect(result.failed).toEqual([]);
  });

  it('requestSetChatRoomAdmin 应保持单用户语义', async () => {
    const client = createRestClient();

    await requestSetChatRoomAdmin(client as never, DEFAULT_CONTEXT, {
      chatRoomId: 'r1',
      userId: 'bob',
    });

    expect(client.post).toHaveBeenCalledWith(
      '/org/app/chatrooms/r1/admin?resource=web',
      {
        newadmin: 'bob',
      },
      {
        operation: 'setChatRoomAdmin',
      }
    );
  });

  it('requestGetChatRoomAttributes 应走 metadata endpoint 并返回归一化 attributes snapshot', async () => {
    const client = createRestClient();
    client.post.mockResolvedValue({
      data: {
        topic: 'sdk',
        notice: 'hello',
      },
    });

    const result = await requestGetChatRoomAttributes(client as never, DEFAULT_CONTEXT, {
      chatRoomId: 'r1',
      keys: ['topic', 'notice'],
    });

    expect(client.post).toHaveBeenCalledWith(
      '/org/app/metadata/chatroom/r1',
      {
        keys: ['topic', 'notice'],
      },
      {
        operation: 'getChatRoomAttributes',
      }
    );
    expect(result).toEqual({
      chatRoomId: 'r1',
      attributes: {
        topic: 'sdk',
        notice: 'hello',
      },
    });
  });

  it('requestDeleteChatRoomSharedFile 应拼接 share_files 删除路径', async () => {
    const client = createRestClient();

    await requestDeleteChatRoomSharedFile(client as never, DEFAULT_CONTEXT, {
      chatRoomId: 'r1',
      fileId: 'f1',
    });

    expect(client.delete).toHaveBeenCalledWith(
      '/org/app/chatrooms/r1/share_files/f1?resource=web',
      {
        operation: 'deleteChatRoomSharedFile',
      }
    );
  });

  it('requestGetChatRoomInfo 应携带 joined_time 并解析当前用户状态', async () => {
    const client = createRestClient();
    client.get.mockResolvedValue({
      data: [
        {
          id: 'r1',
          title: 'Room 1',
          owner: 'alice',
          white: 'true',
          muted: 'false',
          mute_expire: '120',
        },
      ],
    });

    const result = await requestGetChatRoomInfo(client as never, DEFAULT_CONTEXT, {
      chatRoomId: 'r1',
    });

    expect(client.get).toHaveBeenCalledWith('/org/app/chatrooms/r1?joined_time=true', {
      operation: 'getChatRoomInfo',
    });
    expect(result).toEqual({
      chatRoomId: 'r1',
      name: 'Room 1',
      owner: {
        userId: 'alice',
      },
      description: undefined,
      memberCount: undefined,
      maxMembers: undefined,
      createdAt: undefined,
      disabled: undefined,
      ext: undefined,
      announcement: undefined,
      permissionType: 'owner',
      currentUserStatus: {
        inAllowlist: true,
        muted: false,
        muteExpireAt: 120,
        permissionType: 'owner',
      },
    });
  });

  it('requestUpdateChatRoomInfo 应只发送被设置字段，空更新应抛校验错误', async () => {
    const client = createRestClient();
    client.put.mockResolvedValue({
      groupname: true,
      description: false,
      maxusers: true,
    });

    const result = await requestUpdateChatRoomInfo(client as never, DEFAULT_CONTEXT, {
      chatRoomId: 'r1',
      name: 'Room 1',
      maxMembers: 300,
    });

    expect(client.put).toHaveBeenCalledWith(
      '/org/app/chatrooms/r1?resource=web',
      {
        groupname: 'Room 1',
        maxusers: 300,
      },
      {
        operation: 'updateChatRoomInfo',
      }
    );
    expect(result).toEqual({
      nameUpdated: true,
      descriptionUpdated: false,
      maxMembersUpdated: true,
    });

    await expect(
      requestUpdateChatRoomInfo(client as never, DEFAULT_CONTEXT, {
        chatRoomId: 'r1',
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_REQUIRED,
    });
  });

  it('requestJoinChatRoom 应走用户资源路径并传递 ext/leaveOtherRooms', async () => {
    const client = createRestClient();

    await requestJoinChatRoom(client as never, DEFAULT_CONTEXT, {
      chatRoomId: 'r1',
      ext: 'hello',
      leaveOtherRooms: true,
    });

    expect(client.post).toHaveBeenCalledWith(
      '/org/app/chatrooms/r1/users/alice?resource=web',
      {
        ext: 'hello',
        leaveOtherRooms: true,
      },
      {
        operation: 'joinChatRoom',
      }
    );
  });

  it('requestRemoveChatRoomMembers 应拼接批量删除路径并归一化结果', async () => {
    const client = createRestClient();
    client.delete.mockResolvedValue({
      data: [
        {
          id: 'r1',
          user: 'bob',
          action: 'remove',
          result: true,
        },
      ],
    });

    const result = await requestRemoveChatRoomMembers(client as never, DEFAULT_CONTEXT, {
      chatRoomId: 'r1',
      userIds: ['bob', 'carol'],
    });

    expect(client.delete).toHaveBeenCalledWith(
      '/org/app/chatrooms/r1/users/bob,carol?resource=web',
      {
        operation: 'removeChatRoomMembers',
      }
    );
    expect(result).toEqual({
      succeeded: [
        {
          chatRoomId: 'r1',
          user: { userId: 'bob' },
          action: 'remove',
          reason: undefined,
        },
      ],
      failed: [],
    });
  });

  it('requestBlockChatRoomMembers 应区分单用户和批量路径', async () => {
    const client = createRestClient();
    client.post.mockResolvedValue({
      data: {
        id: 'r1',
        user: 'bob',
        action: 'block',
        result: true,
      },
    });

    await requestBlockChatRoomMembers(client as never, DEFAULT_CONTEXT, {
      chatRoomId: 'r1',
      userIds: ['bob'],
    });
    expect(client.post).toHaveBeenNthCalledWith(
      1,
      '/org/app/chatrooms/r1/blocks/users/bob?resource=web',
      undefined,
      {
        operation: 'blockChatRoomMembers',
      }
    );

    client.post.mockResolvedValueOnce({
      data: [
        {
          id: 'r1',
          user: 'bob',
          action: 'block',
          result: true,
        },
      ],
    });
    await requestBlockChatRoomMembers(client as never, DEFAULT_CONTEXT, {
      chatRoomId: 'r1',
      userIds: ['bob', 'carol'],
    });
    expect(client.post).toHaveBeenNthCalledWith(
      2,
      '/org/app/chatrooms/r1/blocks/users?resource=web',
      {
        usernames: ['bob', 'carol'],
      },
      {
        operation: 'blockChatRoomMembers',
      }
    );
  });

  it('requestSetChatRoomAttributes/removeAttributes 应走 metadata user endpoint', async () => {
    const client = createRestClient();
    client.put.mockResolvedValue({
      data: {
        successKeys: ['topic'],
        errorKeys: {
          notice: 'denied',
        },
      },
    });
    client.request.mockResolvedValue({
      data: {
        successKeys: ['topic'],
        errorKeys: {},
      },
    });

    const setResult = await requestSetChatRoomAttributes(client as never, DEFAULT_CONTEXT, {
      chatRoomId: 'r1',
      attributes: {
        topic: 'sdk',
      },
    });
    const removeResult = await requestRemoveChatRoomAttributes(client as never, DEFAULT_CONTEXT, {
      chatRoomId: 'r1',
      keys: ['topic'],
    });

    expect(client.put).toHaveBeenCalledWith(
      '/org/app/metadata/chatroom/r1/user/alice',
      {
        metaData: {
          topic: 'sdk',
        },
        autoDelete: 'DELETE',
      },
      {
        operation: 'setChatRoomAttributes',
      }
    );
    expect(client.request).toHaveBeenCalledWith('/org/app/metadata/chatroom/r1/user/alice', {
      method: 'DELETE',
      body: {
        keys: ['topic'],
      },
      operation: 'removeChatRoomAttributes',
    });
    expect(setResult).toEqual({
      chatRoomId: 'r1',
      appliedKeys: ['topic'],
      failedKeys: {
        notice: { code: 303, message: 'denied' },
      },
    });
    expect(removeResult).toEqual({
      chatRoomId: 'r1',
      appliedKeys: ['topic'],
      failedKeys: {},
    });
  });

  it('requestSetChatRoomAttributes 应支持 isForced 和 autoDelete 参数', async () => {
    const client = createRestClient();
    client.put.mockResolvedValue({
      data: { successKeys: ['k1'], errorKeys: {} },
    });
    client.request.mockResolvedValue({
      data: { successKeys: ['k1'], errorKeys: {} },
    });

    await requestSetChatRoomAttributes(client as never, DEFAULT_CONTEXT, {
      chatRoomId: 'r1',
      attributes: { k1: 'v1' },
      isForced: true,
      autoDelete: false,
    });
    expect(client.put).toHaveBeenCalledWith(
      '/org/app/metadata/chatroom/r1/user/alice/forced',
      { metaData: { k1: 'v1' }, autoDelete: 'NO_DELETE' },
      { operation: 'setChatRoomAttributes' }
    );

    await requestRemoveChatRoomAttributes(client as never, DEFAULT_CONTEXT, {
      chatRoomId: 'r1',
      keys: ['k1'],
      isForced: true,
    });
    expect(client.request).toHaveBeenCalledWith(
      '/org/app/metadata/chatroom/r1/user/alice/forced',
      { method: 'DELETE', body: { keys: ['k1'] }, operation: 'removeChatRoomAttributes' }
    );
  });

  it('requestUpdateChatRoomAnnouncement 应校验 announcement 并发送公告更新', async () => {
    const client = createRestClient();

    await requestUpdateChatRoomAnnouncement(client as never, DEFAULT_CONTEXT, {
      chatRoomId: 'r1',
      announcement: 'hello',
    });

    expect(client.post).toHaveBeenCalledWith(
      '/org/app/chatrooms/r1/announcement?resource=web',
      {
        announcement: 'hello',
      },
      {
        operation: 'updateChatRoomAnnouncement',
      }
    );

    await expect(
      requestUpdateChatRoomAnnouncement(client as never, DEFAULT_CONTEXT, {
        chatRoomId: 'r1',
        announcement: undefined as unknown as string,
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_REQUIRED,
    });
  });

  it('requestGetChatRoomMuteList 应正确拼接分页参数', async () => {
    const client = createRestClient();
    client.get.mockResolvedValueOnce({ data: [] });

    await requestGetChatRoomMuteList(client as never, DEFAULT_CONTEXT, { chatRoomId: 'r1', pageNum: 1, pageSize: 20 });

    expect(client.get).toHaveBeenCalledWith(
      '/org/app/chatrooms/r1/mute?version=v3&pagenum=1&pagesize=20',
      { operation: 'getChatRoomMuteList' }
    );
  });

  it('requestCheckIfInChatRoomAllowList 应使用当前登录用户并携带 v3 版本参数', async () => {
    const client = createRestClient();
    client.get.mockResolvedValueOnce({ data: { white: true } });

    await expect(
      requestCheckIfInChatRoomAllowList(client as never, DEFAULT_CONTEXT, { chatRoomId: 'r1' })
    ).resolves.toBe(true);

    expect(client.get).toHaveBeenCalledWith(
      '/org/app/chatrooms/r1/white/users/alice?version=v3',
      { operation: 'checkIfInChatRoomAllowList' }
    );
  });
});
