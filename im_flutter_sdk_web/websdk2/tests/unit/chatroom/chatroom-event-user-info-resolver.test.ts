import { describe, expect, it, vi } from 'vitest';

import {
  buildMinimalChatRoomUserInfo,
  resolveChatRoomUserInfoMap,
  resolveChatRoomUserInfos,
} from '@/managers/chatroom/chatroom-event-user-info-resolver';

describe('chatroom event user info resolver', () => {
  it('应优先命中缓存并仅补拉缺失用户', async () => {
    const fetchUserInfos = vi.fn().mockResolvedValue([
      {
        userId: 'bob',
        nickname: 'Bob',
      },
    ]);

    const result = await resolveChatRoomUserInfoMap(['alice', 'bob'], {
      cacheManager: {
        getUserInfoSummaries: () => [
          {
            userId: 'alice',
            nickname: 'Alice',
            lastAccess: 1,
            lastUpdate: 1,
          },
        ],
      },
      fetchUserInfos,
    });

    expect(fetchUserInfos).toHaveBeenCalledWith({
      userIds: ['bob'],
    });
    expect(result.get('alice')).toEqual({
      userId: 'alice',
      nickname: 'Alice',
      avatarUrl: undefined,
      sign: undefined,
      ext: undefined,
    });
    expect(result.get('bob')).toEqual({
      userId: 'bob',
      nickname: 'Bob',
    });
  });

  it('补拉失败时应回退为最小 UserInfo 视图并保持顺序', async () => {
    const users = await resolveChatRoomUserInfos(['bob', 'alice'], {
      cacheManager: null,
      fetchUserInfos: vi.fn().mockResolvedValue([]),
    });

    expect(users).toEqual([
      buildMinimalChatRoomUserInfo('bob'),
      buildMinimalChatRoomUserInfo('alice'),
    ]);
  });
});
