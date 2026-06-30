import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatClient } from '@/chat-client';
import { ChatRoom } from '@/managers/chatroom';
import { ChatRoomManager } from '@/managers/chatroom-manager';
import { RestClient } from '@/rest/client';
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

describe('ChatRoom', () => {
  let manager: ChatRoomManager;

  beforeEach((): void => {
    manager = new ChatRoomManager();
    manager.bind(createMockClient());
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('getAdminList 应复用现有对象化补齐链路', async () => {
    vi.spyOn(RestClient.prototype, 'request').mockImplementation(
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

    const chatRoom = manager.getChatRoom('g1');
    const admins = await chatRoom.getAdminList();

    expect(admins).toEqual([
      {
        userId: 'bob',
        nickname: 'Bob',
        avatarUrl: 'https://cdn.example.com/bob.png',
      },
    ]);
  });

  it('updateInfo 应把 chatRoomId 绑定到单聊天室上下文里', async () => {
    const requestSpy = vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({});
    const chatRoom = manager.getChatRoom('g1');

    await chatRoom.updateInfo({
      name: 'ChatRoom 1',
      description: 'desc',
    });

    expect(requestSpy).toHaveBeenCalledWith('/org/app/chatrooms/g1?resource=web', {
      method: 'PUT',
      body: {
        groupname: 'ChatRoom 1',
        description: 'desc',
      },
      operation: 'updateChatRoomInfo',
    });
  });

  it('应将单聊天室 API 委托到带 chatRoomId 的 manager 方法', async () => {
    const managerStub = {
      getChatRoomInfo: vi.fn().mockResolvedValue({ chatRoomId: 'g1', name: 'ChatRoom 1' }),
      updateChatRoomInfo: vi.fn().mockResolvedValue({ nameUpdated: true }),
      leaveChatRoom: vi.fn().mockResolvedValue(undefined),
      getMemberList: vi.fn().mockResolvedValue({ items: [] }),
      removeMembers: vi.fn().mockResolvedValue({ items: [] }),
      getAdminList: vi.fn().mockResolvedValue([]),
      addAdmin: vi.fn().mockResolvedValue(undefined),
      removeAdmin: vi.fn().mockResolvedValue(undefined),
      getMuteList: vi.fn().mockResolvedValue([]),
      muteMembers: vi.fn().mockResolvedValue(undefined),
      unmuteMembers: vi.fn().mockResolvedValue(undefined),
      muteAllMembers: vi.fn().mockResolvedValue(undefined),
      unmuteAllMembers: vi.fn().mockResolvedValue(undefined),
      checkIfInMuteList: vi.fn().mockResolvedValue({ muted: false }),
      getBlocklist: vi.fn().mockResolvedValue([]),
      blockMembers: vi.fn().mockResolvedValue({ items: [] }),
      unblockMembers: vi.fn().mockResolvedValue({ items: [] }),
      getAllowlist: vi.fn().mockResolvedValue([]),
      addUsersToAllowlist: vi.fn().mockResolvedValue({ items: [] }),
      removeUsersFromAllowlist: vi.fn().mockResolvedValue({ items: [] }),
      checkIfInAllowList: vi.fn().mockResolvedValue(true),
      getAnnouncement: vi.fn().mockResolvedValue({ chatRoomId: 'g1', announcement: 'notice' }),
      updateAnnouncement: vi.fn().mockResolvedValue(undefined),
      getAttributes: vi.fn().mockResolvedValue({ chatRoomId: 'g1', attributes: {} }),
      setAttributes: vi
        .fn()
        .mockResolvedValue({ chatRoomId: 'g1', appliedKeys: [], failedKeys: {} }),
      removeAttributes: vi
        .fn()
        .mockResolvedValue({ chatRoomId: 'g1', appliedKeys: [], failedKeys: {} }),
    };

    const chatRoom = new ChatRoom('g1', managerStub as unknown as ChatRoomManager);

    await chatRoom.getInfo();
    await chatRoom.refresh();
    await chatRoom.updateInfo({ name: 'ChatRoom 1' });
    await chatRoom.leaveChatRoom();
    await chatRoom.getMembers({ cursor: 'c1', pageSize: 20 });
    await chatRoom.removeMembers({ userIds: ['bob', 'carol'] });
    await chatRoom.getAdminList();
    await chatRoom.addAdmin({ userId: 'bob' });
    await chatRoom.removeAdmin({ userId: 'bob' });
    await chatRoom.getMuteList();
    await chatRoom.getMuteList({ pageNum: 1, pageSize: 10 });
    await chatRoom.muteMembers({ userIds: ['bob'], duration: 60 });
    await chatRoom.unmuteMembers({ userIds: ['bob'] });
    await chatRoom.muteAllMembers();
    await chatRoom.unmuteAllMembers();
    await chatRoom.checkIfInMuteList();
    await chatRoom.getBlocklist();
    await chatRoom.blockMembers({ userIds: ['bob'] });
    await chatRoom.unblockMembers({ userIds: ['bob'] });
    await chatRoom.getAllowlist();
    await chatRoom.addUsersToAllowlist({ userIds: ['bob'] });
    await chatRoom.removeUsersFromAllowlist({ userIds: ['bob'] });
    await chatRoom.checkIfInAllowList();
    await chatRoom.getAnnouncement();
    await chatRoom.updateAnnouncement({ announcement: 'updated' });
    await chatRoom.getAttributes({ keys: ['topic'] });
    await chatRoom.setAttributes({ attributes: { topic: 'sdk' } });
    await chatRoom.removeAttributes({ keys: ['topic'] });

    expect(managerStub.getChatRoomInfo).toHaveBeenNthCalledWith(1, { chatRoomId: 'g1' });
    expect(managerStub.getChatRoomInfo).toHaveBeenNthCalledWith(2, { chatRoomId: 'g1' });
    expect(managerStub.updateChatRoomInfo).toHaveBeenCalledWith({
      chatRoomId: 'g1',
      name: 'ChatRoom 1',
    });
    expect(managerStub.leaveChatRoom).toHaveBeenCalledWith({ chatRoomId: 'g1' });
    expect(managerStub.getMemberList).toHaveBeenCalledWith({
      chatRoomId: 'g1',
      cursor: 'c1',
      pageSize: 20,
    });
    expect(managerStub.removeMembers).toHaveBeenCalledWith({
      chatRoomId: 'g1',
      userIds: ['bob', 'carol'],
    });
    expect(managerStub.addAdmin).toHaveBeenCalledWith({ chatRoomId: 'g1', userId: 'bob' });
    expect(managerStub.removeAdmin).toHaveBeenCalledWith({ chatRoomId: 'g1', userId: 'bob' });
    expect(managerStub.muteMembers).toHaveBeenCalledWith({
      chatRoomId: 'g1',
      userIds: ['bob'],
      duration: 60,
    });
    expect(managerStub.unmuteMembers).toHaveBeenCalledWith({
      chatRoomId: 'g1',
      userIds: ['bob'],
    });
    expect(managerStub.blockMembers).toHaveBeenCalledWith({
      chatRoomId: 'g1',
      userIds: ['bob'],
    });
    expect(managerStub.addUsersToAllowlist).toHaveBeenCalledWith({
      chatRoomId: 'g1',
      userIds: ['bob'],
    });
    expect(managerStub.checkIfInAllowList).toHaveBeenCalledWith({ chatRoomId: 'g1' });
    expect(managerStub.updateAnnouncement).toHaveBeenCalledWith({
      chatRoomId: 'g1',
      announcement: 'updated',
    });
    expect(managerStub.getAttributes).toHaveBeenCalledWith({
      chatRoomId: 'g1',
      keys: ['topic'],
    });
  });
});
