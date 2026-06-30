import { describe, expect, it } from 'vitest';

import {
  normalizeChatRoomAttributeMutationResult,
  normalizeChatRoomAttributesSnapshot,
  normalizeChatRoomBooleanStatus,
  normalizeChatRoomDetail,
  normalizeChatRoomListResult,
  normalizeChatRoomMemberActionListResult,
  normalizeChatRoomMemberListResult,
  normalizeChatRoomMuteEntries,
  normalizeChatRoomMuteStatus,
  normalizeChatRoomSharedFileListResult,
} from '@/managers/chatroom/chatroom-normalizers';

describe('chatroom-normalizers', () => {
  it('normalizeChatRoomDetail 应归一化详情与当前用户状态', () => {
    const result = normalizeChatRoomDetail(
      {
        data: [
          {
            id: 'r1',
            title: 'Room 1',
            description: 'desc',
            owner: 'alice',
            affiliations_count: '2',
            max_users: '300',
            created: '1772600000000',
            public: 'true',
            members_only: 'false',
            allow_user_invites: 'true',
            invite_need_confirm: 'false',
            mute: 'true',
            disabled: 'false',
            custom: 'ext-info',
            announcement: 'hello',
            white: 'true',
            muted: 'false',
            mute_expire: '120',
          },
        ],
      },
      'alice'
    );

    expect(result).toEqual({
      chatRoomId: 'r1',
      name: 'Room 1',
      description: 'desc',
      owner: { userId: 'alice' },
      memberCount: 2,
      maxMembers: 300,
      createdAt: 1772600000000,
      disabled: false,
      ext: 'ext-info',
      announcement: 'hello',
      permissionType: 'owner',
      currentUserStatus: {
        inAllowlist: true,
        muted: false,
        muteExpireAt: 120,
        permissionType: 'owner',
      },
    });
  });

  it('normalizeChatRoomListResult 应兼容 entities envelope 并计算 hasMore', () => {
    const result = normalizeChatRoomListResult(
      {
        entities: [
          {
            chatroomid: 'r1',
            groupname: 'Room 1',
            owner: 'org_app_bob',
          },
        ],
        count: '25',
        params: {
          pagenum: ['1'],
          pagesize: ['20'],
        },
      },
      {
        stripOwnerAppKeyPrefix: true,
      }
    );

    expect(result).toEqual({
      items: [
        {
          chatRoomId: 'r1',
          name: 'Room 1',
          owner: { userId: 'app_bob' },
          memberCount: undefined,
          disabled: undefined,
        },
      ],
      pageNum: 1,
      pageSize: 20,
      total: 25,
      hasMore: true,
    });
  });

  it('normalizeChatRoomMemberListResult 应识别 owner/admin/member 与 joined_time', () => {
    const result = normalizeChatRoomMemberListResult({
      data: [
        { owner: 'owner1', joined_time: '1' },
        { admin: 'admin1', joinedAt: 2 },
        { member: 'member1' },
        { other: 'ignored' },
      ],
      cursor: 'next_page_cursor',
    });

    expect(result).toEqual({
      items: [
        { user: { userId: 'owner1' }, role: 'owner', joinedAt: 1 },
        { user: { userId: 'admin1' }, role: 'admin', joinedAt: 2 },
        { user: { userId: 'member1' }, role: 'member', joinedAt: undefined },
      ],
      cursor: 'next_page_cursor',
      hasMore: true,
    });
  });

  it('normalizeChatRoomMuteEntries 应同时兼容字符串列表和对象列表', () => {
    expect(
      normalizeChatRoomMuteEntries({
        data: ['bob', 'carol'],
      })
    ).toEqual([{ user: { userId: 'bob' } }, { user: { userId: 'carol' } }]);

    expect(
      normalizeChatRoomMuteEntries({
        data: [{ member: 'dave', expired: '60' }, { user: 'erin', muteExpire: 120 }],
      })
    ).toEqual([
      { user: { userId: 'dave' }, muteExpire: 60 },
      { user: { userId: 'erin' }, muteExpire: 120 },
    ]);
  });

  it('normalizeChatRoomSharedFileListResult 应过滤非法项并保留分页字段', () => {
    const result = normalizeChatRoomSharedFileListResult({
      data: [
        {
          file_id: 'f1',
          file_name: 'a.txt',
          file_owner: 'bob',
          file_size: '100',
          created: '5',
        },
        {
          file_id: 'f2',
        },
      ],
      params: {
        pagenum: ['1'],
        pagesize: ['10'],
      },
    });

    expect(result).toEqual({
      items: [
        {
          fileId: 'f1',
          fileName: 'a.txt',
          fileOwner: { userId: 'bob' },
          fileSize: 100,
          createdAt: 5,
        },
      ],
      pageNum: 1,
      pageSize: 10,
    });
  });

  it('attributes 与 mutation 结果应过滤非字符串字段', () => {
    expect(
      normalizeChatRoomAttributesSnapshot(
        {
          data: {
            topic: 'sdk',
            count: 1,
          },
        },
        'r1'
      )
    ).toEqual({
      chatRoomId: 'r1',
      attributes: {
        topic: 'sdk',
      },
    });

    expect(
      normalizeChatRoomAttributeMutationResult(
        {
          data: {
            successKeys: ['topic', 1],
            errorKeys: {
              notice: 'denied',
              ignored: 2,
            },
          },
        },
        'r1'
      )
    ).toEqual({
      chatRoomId: 'r1',
      appliedKeys: ['topic'],
      failedKeys: {
        notice: { code: 303, message: 'denied' },
      },
    });
  });

  it('normalizeChatRoomMemberActionListResult/BooleanStatus/MuteStatus 应覆盖剩余状态分支', () => {
    expect(
      normalizeChatRoomMemberActionListResult({
        data: {
          id: 'r1',
          user: 'bob',
          action: 'block',
          result: 'true',
          reason: 'manual',
        },
      })
    ).toEqual({
      succeeded: [
        {
          chatRoomId: 'r1',
          user: { userId: 'bob' },
          action: 'block',
          reason: 'manual',
        },
      ],
      failed: [],
    });

    expect(
      normalizeChatRoomBooleanStatus({
        data: {
          white: 'true',
        },
      })
    ).toBe(true);

    expect(
      normalizeChatRoomMuteStatus({
        data: {
          value: 'true',
          mute_expire: '600',
        },
      })
    ).toEqual({
      muted: true,
      muteExpireAt: 600,
    });
  });
});
