import { describe, expect, it } from 'vitest';

import {
  ChatRoom,
  ChatRoomManager,
  type ChatRoomAdminAddedEventPayload,
  type ChatRoomDetail,
  type ChatRoomEventHandlerMap,
  type ChatRoomListResult,
  type ChatRoomMemberEntry,
  type ChatRoomMutationTarget,
  type ChatRoomUpdateInfoInput,
  type ChatRoomUserBatchParams,
} from '@/index';
import type { ChatClient } from '@/chat-client';
import type { RestContext } from '@/types/chat-client';

const DEFAULT_REST_CONTEXT: RestContext = {
  restBaseUrl: 'https://api.example.com',
  appKey: 'org#app',
  userId: 'alice',
  token: 'token',
  clientResource: 'web',
};

const createMockClient = (): ChatClient =>
  ({
    getRestContext: (): RestContext => DEFAULT_REST_CONTEXT,
    getCacheManager: (): null => null,
  }) as unknown as ChatClient;

describe('chatroom manager types', () => {
  it('聊天室写接口应返回 Promise<void> 或明确业务对象', () => {
    type LeaveChatRoomReturn = ReturnType<ChatRoom['leaveChatRoom']>;
    type RemoveMembersReturn = ReturnType<ChatRoom['removeMembers']>;
    type AddAdminReturn = ReturnType<ChatRoomManager['addAdmin']>;
    type GetAttributesReturn = ReturnType<ChatRoomManager['getAttributes']>;

    const leaveChatRoomPromise: LeaveChatRoomReturn = Promise.resolve();
    const removeMembersPromise: RemoveMembersReturn = Promise.resolve({
      succeeded: [],
      failed: [],
    });
    const addAdminPromise: AddAdminReturn = Promise.resolve();
    const getAttributesPromise: GetAttributesReturn = Promise.resolve({
      chatRoomId: 'g1',
      attributes: {
        topic: 'sdk',
      },
    });

    expect(leaveChatRoomPromise).toBeInstanceOf(Promise);
    expect(removeMembersPromise).toBeInstanceOf(Promise);
    expect(addAdminPromise).toBeInstanceOf(Promise);
    expect(getAttributesPromise).toBeInstanceOf(Promise);
  });

  it('聊天室列表、详情和成员类型应通过根导出可用', () => {
    const list: ChatRoomListResult = {
      items: [
        {
          chatRoomId: 'g1',
          name: 'ChatRoom 1',
        },
      ],
      pageNum: 1,
      pageSize: 20,
    };
    const member: ChatRoomMemberEntry = {
      user: {
        userId: 'bob',
        nickname: 'Bob',
      },
      role: 'member',
    };
    const detail: ChatRoomDetail = {
      chatRoomId: 'g1',
      name: 'ChatRoom 1',
      owner: {
        userId: 'owner',
      },
      currentUserStatus: {
        permissionType: 'owner',
      },
    };

    expect(list.items[0]?.chatRoomId).toBe('g1');
    expect(member.user.nickname).toBe('Bob');
    expect(detail.owner?.userId).toBe('owner');
    expect(detail.currentUserStatus?.permissionType).toBe('owner');
  });

  it('getChatRoom 应返回 ChatRoom 对象，列表项仍为纯数据对象', () => {
    const manager = new ChatRoomManager();
    manager.bind(createMockClient());

    const chatRoom = manager.getChatRoom('g1');
    const updateInput: ChatRoomUpdateInfoInput = {
      name: 'ChatRoom 1',
    };
    type GetChatRoomReturn = ReturnType<ChatRoomManager['getChatRoom']>;
    const sameTypeChatRoom: GetChatRoomReturn = chatRoom;

    expect(chatRoom).toBeInstanceOf(ChatRoom);
    expect(chatRoom.chatRoomId).toBe('g1');
    expect(updateInput.name).toBe('ChatRoom 1');
    expect(sameTypeChatRoom.chatRoomId).toBe('g1');
  });

  it('批量参数与目标参数应固定使用 chatRoomId 和 userIds', () => {
    const batchParams: ChatRoomUserBatchParams = {
      chatRoomId: 'g1',
      userIds: ['bob', 'carol'],
    };
    const target: ChatRoomMutationTarget = {
      chatRoomId: 'g1',
    };

    expect(batchParams.userIds).toEqual(['bob', 'carol']);
    expect(target.chatRoomId).toBe('g1');
  });

  it('聊天室事件 handler map 与 payload 类型应通过根导出可用', () => {
    const adminPayload: ChatRoomAdminAddedEventPayload = {
      chatRoomId: 'g1',
      admin: {
        userId: 'bob',
      },
    };
    const handlers: ChatRoomEventHandlerMap = {
      onAdminAdded: payload => {
        expect(payload.admin?.userId).toBe('bob');
      },
      onChatRoomInfoChanged: payload => {
        expect(payload.chatRoomInfo.chatRoomId).toBe('g1');
      },
      onAttributesUpdate: payload => {
        expect(payload.attributes.topic).toBe('sdk');
      },
    };

    void handlers.onAdminAdded?.(adminPayload);
    void handlers.onChatRoomInfoChanged?.({
      chatRoomId: 'g1',
      chatRoomInfo: {
        chatRoomId: 'g1',
        name: 'ChatRoom 1',
      },
    });
    void handlers.onAttributesUpdate?.({
      chatRoomId: 'g1',
      attributes: {
        topic: 'sdk',
      },
      from: {
        userId: 'alice',
      },
    });

    const membersHandlers: ChatRoomEventHandlerMap = {
      onMembersJoined: payload => {
        expect(payload.members[0]?.userId).toBe('bob');
      },
      onAllowListAdded: payload => {
        expect(payload.allowlist[0]?.userId).toBe('bob');
      },
    };

    void membersHandlers.onMembersJoined?.({
      chatRoomId: 'g1',
      members: [{ userId: 'bob' }],
    });
    void membersHandlers.onAllowListAdded?.({
      chatRoomId: 'g1',
      allowlist: [{ userId: 'bob' }],
    });

    const legacyMemberHandlers: ChatRoomEventHandlerMap = {
      // @ts-expect-error 028 已移除单数成员事件
      onMemberJoined: () => undefined,
    };
    const legacyWhiteListHandlers: ChatRoomEventHandlerMap = {
      // @ts-expect-error 028 已移除 WhiteList 旧命名事件
      onWhiteListAdded: () => undefined,
    };
    const legacySpecificationHandlers: ChatRoomEventHandlerMap = {
      // @ts-expect-error 028 已移除 onSpecificationChanged
      onSpecificationChanged: () => undefined,
    };
    expect(legacyMemberHandlers).toBeDefined();
    expect(legacyWhiteListHandlers).toBeDefined();
    expect(legacySpecificationHandlers).toBeDefined();
  });

  it('allowlist 自查接口类型应暴露当前登录用户语义', () => {
    type CheckIfInAllowListReturn = ReturnType<ChatRoomManager['checkIfInAllowList']>;
    type CheckIfInAllowListFacadeReturn = ReturnType<ChatRoom['checkIfInAllowList']>;

    const managerReturn: CheckIfInAllowListReturn = Promise.resolve(true);
    const facadeReturn: CheckIfInAllowListFacadeReturn = Promise.resolve(true);

    expect(managerReturn).toBeInstanceOf(Promise);
    expect(facadeReturn).toBeInstanceOf(Promise);
  });

  it('createChatRoom、getJoinedChatRoomList、destroyChatRoom、destroyForHandle、addMembers、addMembersForHandle 不应再出现在公开类型里', () => {
    const manager = new ChatRoomManager();

    // @ts-expect-error createChatRoom 已从 ChatRoomManager 公开面移除
    void manager.createChatRoom;
    // @ts-expect-error getJoinedChatRoomList 已从 ChatRoomManager 公开面移除
    void manager.getJoinedChatRoomList;
    // @ts-expect-error destroyChatRoom 已从 ChatRoomManager 公开面移除
    void manager.destroyChatRoom;
    // @ts-expect-error destroyForHandle 已从 ChatRoomManager 公开面移除
    void manager.destroyForHandle;
    // @ts-expect-error addMembers 已从 ChatRoomManager 公开面移除
    void manager.addMembers;
    // @ts-expect-error addMembersForHandle 已从 ChatRoomManager 公开面移除
    void manager.addMembersForHandle;

    expect(manager).toBeInstanceOf(ChatRoomManager);
  });
});
