import { describe, expect, it } from 'vitest';

import { mapJoinedGroupsApiError } from '@/core/group-sync/group-sync-client';
import { mergeJoinedGroupSnapshot } from '@/core/group-sync/group-sync-merge';
import { normalizeJoinedGroupItems } from '@/core/group-sync/group-sync-normalizer';
import { GroupSyncSession } from '@/core/group-sync/group-sync-session';
import { JoinedGroupsMessageType } from '@/protocol/joined-groups/types';
import { ERROR_CODES } from '@/utils/error-codes';

describe('group sync helpers', () => {
  it('应按服务端 GroupItem 官方字段归一化为 JoinedGroupSummary', () => {
    expect(
      normalizeJoinedGroupItems([
        {
          group_id: ' g1 ',
          group_name: 'Group 1',
          group_owner: 'owner',
          members_count: 10,
          mute_all: true,
          disabled: false,
          description: 'desc',
          group_avatar: 'https://cdn.example.com/g1.png',
          role: 0,
          mute_expiration: 0,
          remind_type: 3,
          create_at: 100,
          update_at: 200,
          joined_timestamp: 300,
        },
        {
          group_id: '   ',
          group_name: 'ignored',
        },
      ])
    ).toEqual([
      {
        groupId: 'g1',
        name: 'Group 1',
        ownerId: 'owner',
        memberCount: 10,
        muteAllMembers: true,
        disabled: false,
        description: 'desc',
        avatarUrl: 'https://cdn.example.com/g1.png',
        role: 'owner',
        muteExpiration: 0,
        remindType: 'NONE',
        createdAt: 100,
        updatedAt: 200,
        joinedAt: 300,
      },
    ]);
  });

  it('合并同步批次时应保留未出现在结果中的本地群并拒绝旧 update_at 覆盖', () => {
    const snapshot = mergeJoinedGroupSnapshot({
      existingItems: [
        {
          groupId: 'g1',
          name: 'Old Group',
          updatedAt: 200,
          joinedAt: 20,
        },
        {
          groupId: 'g2',
          name: 'Existing Only',
          updatedAt: 100,
          joinedAt: 10,
        },
      ],
      incomingItems: [
        {
          groupId: 'g1',
          name: 'Stale Group',
          updatedAt: 199,
          joinedAt: 30,
        },
        {
          groupId: 'g3',
          name: 'New Group',
          updatedAt: 300,
          joinedAt: 30,
        },
      ],
      lastSyncFinishedTs: 400,
    });

    expect(snapshot.items.map(item => item.groupId)).toEqual(['g3', 'g1', 'g2']);
    expect(snapshot.items.find(item => item.groupId === 'g1')?.name).toBe('Old Group');
    expect(snapshot.items.find(item => item.groupId === 'g2')?.name).toBe('Existing Only');
    expect(snapshot.meta).toMatchObject({
      integrity: 'synced',
      limited: false,
      lastSyncFinishedTs: 400,
      source: 'sync',
    });
  });

  it('同步 session 应忽略缺失或不匹配 request_id 的响应帧', () => {
    const session = new GroupSyncSession('req-current');

    expect(
      session.push({
        type: JoinedGroupsMessageType.GET_JOINED_GROUPS_RESPONSE,
        groups: [{ group_id: 'missing-request-id' }],
        isLastBatch: false,
      })
    ).toEqual({ done: false });
    expect(
      session.push({
        type: JoinedGroupsMessageType.GET_JOINED_GROUPS_RESPONSE,
        header: {
          resource: 'web',
          timestamp: 1,
          requestId: 'req-other',
          protocolVersion: 1,
        },
        groups: [{ group_id: 'wrong-request-id' }],
        isLastBatch: false,
      })
    ).toEqual({ done: false });
    expect(
      session.push({
        type: JoinedGroupsMessageType.GET_JOINED_GROUPS_RESPONSE,
        header: {
          resource: 'web',
          timestamp: 2,
          requestId: 'req-current',
          protocolVersion: 1,
        },
        groups: [{ group_id: 'accepted' }],
        isLastBatch: true,
        lastSyncFinishedTs: 3,
      })
    ).toEqual({ done: true });

    expect(session.buildResult().batches).toHaveLength(1);
    expect(session.buildResult().batches[0]?.groups[0]?.group_id).toBe('accepted');
  });

  it.each([
    [1601, ERROR_CODES.VALIDATION_REQUIRED, 'request_send', false],
    [1602, ERROR_CODES.REST_BUSINESS_UNKNOWN, 'batch_merge', true],
    [1002, ERROR_CODES.AUTH_UNAUTHORIZED, 'auth', false],
    [1003, ERROR_CODES.SERVICE_LIMIT_EXCEEDED, 'server_limit', true],
  ] as const)(
    '应将服务端错误 %i 映射为 SDK 错误码 %i',
    (serverCode, sdkCode, stage, retryable) => {
      const error = mapJoinedGroupsApiError({
        type: JoinedGroupsMessageType.ERROR,
        header: {
          resource: 'web',
          timestamp: 1,
          requestId: 'req-1',
          protocolVersion: 1,
        },
        code: serverCode,
        message: `server error ${serverCode}`,
      });

      expect(error.code).toBe(sdkCode);
      expect(error.message).toBe(`server error ${serverCode}`);
      expect(error.details).toMatchObject({
        stage,
        serverCode,
        requestId: 'req-1',
        retryable,
      });
    }
  );
});
