import { describe, expect, it, vi } from 'vitest';

import {
  buildMinimalGroupUserInfo,
  mergeGroupUserInfo,
  resolveGroupUserInfoMap,
  resolveGroupUserInfos,
} from '@/managers/group/group-event-user-info-resolver';

describe('group event user info resolver', () => {
  it('应优先命中缓存并仅补拉缺失用户', async () => {
    const fetchUserInfos = vi.fn().mockResolvedValue([
      {
        userId: 'bob',
        nickname: 'Bob',
      },
    ]);

    const result = await resolveGroupUserInfoMap(['alice', 'bob'], {
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
    const users = await resolveGroupUserInfos(['bob', 'alice'], {
      cacheManager: null,
      fetchUserInfos: vi.fn().mockResolvedValue([]),
    });

    expect(users).toEqual([
      buildMinimalGroupUserInfo('bob'),
      buildMinimalGroupUserInfo('alice'),
    ]);
  });

  it('应去重空值并优先合并 incoming 资料字段', async () => {
    const fetchUserInfos = vi.fn().mockResolvedValue([
      {
        userId: 'carol',
        nickname: 'Carol',
      },
    ]);

    const users = await resolveGroupUserInfos(['  carol  ', 'carol', '  ', 'dave'], {
      cacheManager: null,
      fetchUserInfos,
    });

    expect(fetchUserInfos).toHaveBeenCalledWith({
      userIds: ['carol', 'dave'],
    });
    expect(users).toEqual([
      {
        userId: 'carol',
        nickname: 'Carol',
      },
      {
        userId: 'dave',
      },
    ]);
    expect(
      mergeGroupUserInfo(
        {
          userId: 'carol',
          nickname: 'old',
          avatarUrl: 'old-avatar',
        },
        {
          userId: 'carol',
          nickname: 'new',
        },
        'carol'
      )
    ).toEqual({
      userId: 'carol',
      nickname: 'new',
      avatarUrl: 'old-avatar',
    });
  });

  it('邀请类/成员类/管理员类/allowlist/禁言事件用户字段应保持首见顺序并回退最小视图', async () => {
    const fetchUserInfos = vi.fn().mockResolvedValue([
      {
        userId: 'inviter',
        nickname: 'Inviter',
      },
      {
        userId: 'admin',
        nickname: 'Admin',
      },
    ]);

    const users = await resolveGroupUserInfos(
      ['inviter', 'member', 'admin', 'allow-user', 'mute-user', 'member'],
      {
        cacheManager: {
          getUserInfoSummaries: () => [
            {
              userId: 'allow-user',
              nickname: 'Allow User',
              lastAccess: 1,
              lastUpdate: 1,
            },
            {
              userId: 'mute-user',
              nickname: 'Mute User',
              lastAccess: 1,
              lastUpdate: 1,
            },
          ],
        },
        fetchUserInfos,
      }
    );

    expect(fetchUserInfos).toHaveBeenCalledWith({
      userIds: ['inviter', 'member', 'admin'],
    });
    expect(users).toEqual([
      {
        userId: 'inviter',
        nickname: 'Inviter',
      },
      {
        userId: 'member',
      },
      {
        userId: 'admin',
        nickname: 'Admin',
      },
      {
        userId: 'allow-user',
        nickname: 'Allow User',
        avatarUrl: undefined,
        sign: undefined,
        ext: undefined,
      },
      {
        userId: 'mute-user',
        nickname: 'Mute User',
        avatarUrl: undefined,
        sign: undefined,
        ext: undefined,
      },
    ]);
  });
});
