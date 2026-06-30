import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CacheManager } from '@/cache/cache-manager';
import { ChatClient } from '@/chat-client';
import { ChatRoomManager } from '@/managers/chatroom-manager';
import { ChatRoomDispatchEventName } from '@/types/event-system';

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

const createClientWithCache = async (): Promise<{
  chatRoomManager: ChatRoomManager;
  eventContext: {
    dispatch: ReturnType<typeof vi.fn>;
    addEventHandler: ReturnType<typeof vi.fn>;
    removeEventHandler: ReturnType<typeof vi.fn>;
  };
}> => {
  const client = ChatClient.init({ appKey: 'org#app' });
  const cacheManager = new CacheManager({
    appKey: 'org#app',
    userId: 'alice',
    cacheEncryptionMode: 'off',
  });
  await cacheManager.prepare();
  cacheManager.setUserInfoSummaries([
    { userId: 'bob', nickname: 'Bob', lastAccess: 1, lastUpdate: 1 },
    { userId: 'carol', nickname: 'Carol', lastAccess: 1, lastUpdate: 1 },
  ]);
  (
    client as unknown as {
      cacheManager: CacheManager | null;
    }
  ).cacheManager = cacheManager;
  const chatRoomManager = new ChatRoomManager();
  const eventContext = {
    dispatch: vi.fn(),
    addEventHandler: vi.fn(),
    removeEventHandler: vi.fn(),
  };
  chatRoomManager.bind(client, eventContext);
  return { chatRoomManager, eventContext };
};

describe('ChatClient chatroom events', () => {
  beforeEach((): void => {
    resetSingleton();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it.each([
    {
      name: 'onMembersJoined',
      eventName: 'onMembersJoined',
      dispatchEvent: ChatRoomDispatchEventName.MEMBERS_JOINED,
      payload: {
        chatRoomId: 'r1',
        chatRoomName: 'Room 1',
        memberIds: ['bob'],
        ext: 'hello',
      },
      expected: {
        chatRoomId: 'r1',
        chatRoomName: 'Room 1',
        members: [{ userId: 'bob', nickname: 'Bob' }],
        ext: 'hello',
      },
    },
    {
      name: 'onRemovedFromChatRoom',
      eventName: 'onRemovedFromChatRoom',
      dispatchEvent: ChatRoomDispatchEventName.REMOVED_FROM_CHAT_ROOM,
      payload: {
        chatRoomId: 'r1',
        chatRoomName: 'Room 1',
        participantId: 'bob',
        reasonCode: 2,
      },
      expected: {
        chatRoomId: 'r1',
        chatRoomName: 'Room 1',
        participant: { userId: 'bob', nickname: 'Bob' },
        reason: 2,
      },
    },
    {
      name: 'onMuteListAdded',
      eventName: 'onMuteListAdded',
      dispatchEvent: ChatRoomDispatchEventName.MUTE_LIST_ADDED,
      payload: {
        chatRoomId: 'r1',
        userIds: ['bob', 'carol'],
        muteExpire: 88,
      },
      expected: {
        chatRoomId: 'r1',
        mutes: [
          { user: { userId: 'bob', nickname: 'Bob' }, muteExpire: 88 },
          { user: { userId: 'carol', nickname: 'Carol' }, muteExpire: 88 },
        ],
        muteExpire: 88,
      },
    },
    {
      name: 'onAllowListRemoved',
      eventName: 'onAllowListRemoved',
      dispatchEvent: ChatRoomDispatchEventName.ALLOW_LIST_REMOVED,
      payload: {
        chatRoomId: 'r1',
        userIds: ['bob'],
      },
      expected: {
        chatRoomId: 'r1',
        allowlist: [{ userId: 'bob', nickname: 'Bob' }],
      },
    },
    {
      name: 'onAllMemberMuteStateChanged',
      eventName: 'onAllMemberMuteStateChanged',
      dispatchEvent: ChatRoomDispatchEventName.ALL_MEMBER_MUTE_STATE_CHANGED,
      payload: {
        chatRoomId: 'r1',
        isMuted: 1,
      },
      expected: {
        chatRoomId: 'r1',
        isMuted: true,
      },
    },
    {
      name: 'onAdminRemoved',
      eventName: 'onAdminRemoved',
      dispatchEvent: ChatRoomDispatchEventName.ADMIN_REMOVED,
      payload: {
        chatRoomId: 'r1',
        adminId: 'bob',
      },
      expected: {
        chatRoomId: 'r1',
        admin: { userId: 'bob', nickname: 'Bob' },
      },
    },
    {
      name: 'onOwnerChanged',
      eventName: 'onOwnerChanged',
      dispatchEvent: ChatRoomDispatchEventName.OWNER_CHANGED,
      payload: {
        chatRoomId: 'r1',
        oldOwnerId: 'bob',
        newOwnerId: 'carol',
      },
      expected: {
        chatRoomId: 'r1',
        oldOwner: { userId: 'bob', nickname: 'Bob' },
        newOwner: { userId: 'carol', nickname: 'Carol' },
      },
    },
    {
      name: 'onAnnouncementChanged',
      eventName: 'onAnnouncementChanged',
      dispatchEvent: ChatRoomDispatchEventName.ANNOUNCEMENT_CHANGED,
      payload: {
        chatRoomId: 'r1',
        announcement: 'new announcement',
      },
      expected: {
        chatRoomId: 'r1',
        announcement: 'new announcement',
      },
    },
    {
      name: 'onChatRoomInfoChanged',
      eventName: 'onChatRoomInfoChanged',
      dispatchEvent: ChatRoomDispatchEventName.CHAT_ROOM_INFO_CHANGED,
      payload: {
        chatRoomId: 'r1',
        chatRoomPatch: {
          name: 'Room Patched',
          description: 'patched',
        },
      },
      expected: {
        chatRoomId: 'r1',
        chatRoomInfo: {
          chatRoomId: 'r1',
          name: 'Room Patched',
          description: 'patched',
        },
      },
    },
    {
      name: 'onAttributesUpdate',
      eventName: 'onAttributesUpdate',
      dispatchEvent: ChatRoomDispatchEventName.ATTRIBUTES_UPDATE,
      payload: {
        chatRoomId: 'r1',
        attributes: {
          topic: 'sdk',
        },
        from: 'bob',
      },
      expected: {
        chatRoomId: 'r1',
        attributes: {
          topic: 'sdk',
        },
        from: { userId: 'bob', nickname: 'Bob' },
      },
    },
    {
      name: 'onAttributesRemoved',
      eventName: 'onAttributesRemoved',
      dispatchEvent: ChatRoomDispatchEventName.ATTRIBUTES_REMOVED,
      payload: {
        chatRoomId: 'r1',
        keyList: ['topic'],
        from: 'bob',
      },
      expected: {
        chatRoomId: 'r1',
        keyList: ['topic'],
        from: { userId: 'bob', nickname: 'Bob' },
      },
    },
  ])('$name 应映射到公开聊天室事件载荷', async ({ eventName, dispatchEvent, payload, expected }) => {
    const { chatRoomManager, eventContext } = await createClientWithCache();

    await chatRoomManager.handleRawNotify({
      type: 'chatroom',
      payload: {
        eventName,
        payload,
      },
    });

    expect(eventContext.dispatch).toHaveBeenCalledWith(dispatchEvent, expected);
  });

  it('未知聊天室事件应被忽略', async () => {
    const { chatRoomManager, eventContext } = await createClientWithCache();

    await chatRoomManager.handleRawNotify({
      type: 'chatroom',
      payload: {
        eventName: 'unsupported',
        payload: {
          chatRoomId: 'r1',
        },
      },
    });

    expect(eventContext.dispatch).not.toHaveBeenCalled();
  });
});
