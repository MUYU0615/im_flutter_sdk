import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CacheManager } from '@/cache/cache-manager';
import { ChatClient } from '@/chat-client';
import { GroupManager } from '@/managers/group-manager';
import { GroupEventName } from '@/types/event-system';

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

const createClientWithCache = async (): Promise<{
  cacheManager: CacheManager;
  groupManager: GroupManager;
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
    { userId: 'owner-1', nickname: 'Owner 1', lastAccess: 1, lastUpdate: 1 },
    { userId: 'owner-2', nickname: 'Owner 2', lastAccess: 1, lastUpdate: 1 },
  ]);
  const groupManager = new GroupManager();
  const eventContext = {
    dispatch: vi.fn(),
    addEventHandler: vi.fn(),
    removeEventHandler: vi.fn(),
  };

  (
    client as unknown as {
      cacheManager: CacheManager | null;
      currentUserId: string | null;
    }
  ).cacheManager = cacheManager;
  (
    client as unknown as {
      cacheManager: CacheManager | null;
      currentUserId: string | null;
    }
  ).currentUserId = 'alice';

  groupManager.bind(client, eventContext);

  return { cacheManager, groupManager, eventContext };
};

describe('ChatClient group event payloads', () => {
  beforeEach((): void => {
    resetSingleton();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it.each([
    {
      name: 'onMuteListAdded',
      eventName: GroupEventName.MUTE_LIST_ADDED,
      payload: {
        groupId: 'g1',
        userIds: ['bob', 'carol'],
        muteExpire: 123,
      },
      expected: {
        groupId: 'g1',
        mutes: [
          { userId: 'bob', nickname: 'Bob' },
          { userId: 'carol', nickname: 'Carol' },
        ],
        muteExpire: 123,
      },
    },
    {
      name: 'onAllowListRemoved',
      eventName: GroupEventName.ALLOW_LIST_REMOVED,
      payload: {
        groupId: 'g1',
        userIds: ['bob'],
      },
      expected: {
        groupId: 'g1',
        allowlist: [{ userId: 'bob', nickname: 'Bob' }],
      },
    },
    {
      name: 'onAdminRemoved',
      eventName: GroupEventName.ADMIN_REMOVED,
      payload: {
        groupId: 'g1',
        administratorId: 'bob',
      },
      expected: {
        groupId: 'g1',
        administrator: { userId: 'bob', nickname: 'Bob' },
      },
    },
    {
      name: 'onMembersJoined',
      eventName: GroupEventName.MEMBERS_JOINED,
      payload: {
        groupId: 'g1',
        memberIds: ['bob', 'carol'],
      },
      expected: {
        groupId: 'g1',
        members: [
          { userId: 'bob', nickname: 'Bob' },
          { userId: 'carol', nickname: 'Carol' },
        ],
      },
    },
    {
      name: 'onMembersExited',
      eventName: GroupEventName.MEMBERS_EXITED,
      payload: {
        groupId: 'g1',
        memberIds: ['bob', 'carol'],
      },
      expected: {
        groupId: 'g1',
        members: [
          { userId: 'bob', nickname: 'Bob' },
          { userId: 'carol', nickname: 'Carol' },
        ],
      },
    },
    {
      name: 'onAnnouncementChanged',
      eventName: GroupEventName.ANNOUNCEMENT_CHANGED,
      payload: {
        groupId: 'g1',
        announcement: 'hello',
      },
      expected: {
        groupId: 'g1',
        announcement: 'hello',
      },
    },
    {
      name: 'onSharedFileAdded',
      eventName: GroupEventName.SHARED_FILE_ADDED,
      payload: {
        groupId: 'g1',
        sharedFile: {
          fileId: 'f1',
          fileName: 'demo.txt',
          fileOwner: { userId: 'bob' },
        },
      },
      expected: {
        groupId: 'g1',
        sharedFile: {
          fileId: 'f1',
          fileName: 'demo.txt',
          fileOwner: { userId: 'bob', nickname: 'Bob' },
        },
      },
    },
    {
      name: 'onSharedFileDeleted',
      eventName: GroupEventName.SHARED_FILE_DELETED,
      payload: {
        groupId: 'g1',
        fileId: 'f1',
      },
      expected: {
        groupId: 'g1',
        fileId: 'f1',
      },
    },
    {
      name: 'onGroupDisabledChanged',
      eventName: GroupEventName.GROUP_DISABLED_CHANGED,
      payload: {
        groupId: 'g1',
        isDisabled: 1,
        groupPatch: {
          name: 'Group Patched',
          description: 'patched',
        },
      },
      expected: {
        groupId: 'g1',
        groupInfo: {
          groupId: 'g1',
          name: 'Group Patched',
          description: 'patched',
          disabled: 1,
          owner: undefined,
        },
        disabled: true,
      },
    },
    {
      name: 'onGroupMemberAttributeChanged',
      eventName: GroupEventName.GROUP_MEMBER_ATTRIBUTE_CHANGED,
      payload: {
        groupId: 'g1',
        userId: 'bob',
        attribute: {
          groupNamecard: 'Bob Card',
        },
        from: 'alice',
        source: 'sync',
      },
      expected: {
        groupId: 'g1',
        user: { userId: 'bob', nickname: 'Bob' },
        attribute: {
          groupNamecard: 'Bob Card',
        },
        from: 'alice',
        source: 'sync',
      },
    },
  ])('$name 应返回归一化 payload', async ({ eventName, payload, expected }) => {
    const { groupManager, eventContext } = await createClientWithCache();

    await groupManager.handleRawNotify({
      type: 'group',
      payload: {
        eventName,
        payload,
      },
    });

    expect(eventContext.dispatch).toHaveBeenCalledWith(eventName, expected);
  });

  it('未知群事件应返回 null', async () => {
    const { groupManager, eventContext } = await createClientWithCache();

    await groupManager.handleRawNotify({
      type: 'group',
      payload: {
        eventName: 'unsupported',
        payload: {
          groupId: 'g1',
        },
      },
    });

    expect(eventContext.dispatch).not.toHaveBeenCalled();
  });

  it('成员属性事件带群名片时应写缓存并追加派发 USER_GROUP_NAMECARD_UPDATED', async () => {
    const { cacheManager, groupManager, eventContext } = await createClientWithCache();

    await groupManager.handleRawNotify({
      type: 'group',
      payload: {
        eventName: GroupEventName.GROUP_MEMBER_ATTRIBUTE_CHANGED,
        payload: {
          groupId: 'g1',
          userId: 'bob',
          attribute: {
            group_namecard: 'Bob Card',
          },
        },
      },
    });

    expect(cacheManager.getGroupNamecard('g1', 'bob', false)).toEqual(
      expect.objectContaining({
        groupId: 'g1',
        userId: 'bob',
        namecard: 'Bob Card',
      })
    );
    expect(eventContext.dispatch).toHaveBeenNthCalledWith(1, GroupEventName.GROUP_MEMBER_ATTRIBUTE_CHANGED, {
      groupId: 'g1',
      user: { userId: 'bob', nickname: 'Bob' },
      attribute: {
        group_namecard: 'Bob Card',
      },
      from: undefined,
      source: undefined,
    });
    expect(eventContext.dispatch).toHaveBeenNthCalledWith(2, GroupEventName.USER_GROUP_NAMECARD_UPDATED, {
      groupId: 'g1',
      userId: 'bob',
      namecard: 'Bob Card',
    });
  });
});
