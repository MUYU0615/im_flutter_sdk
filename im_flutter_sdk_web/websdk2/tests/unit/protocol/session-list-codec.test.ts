import { describe, expect, it } from 'vitest';
import { Root, configure, util, type INamespace } from 'protobufjs/light';
import Long from 'long';

import { SessionListCodec } from '@/protocol/session-list/codec';
import sessionListProtoJson from '@/protocol/session-list/proto';
import {
  SessionListMessageType,
  SessionListProtocolRemindType,
  SessionListProtocolSessionType,
} from '@/protocol/session-list/types';
import { buildSessionListRequest, toSessionListItems } from '@/protocol/session-list/gateway';

util.Long = Long;
configure();

const root = Root.fromJSON(sessionListProtoJson as INamespace);
const responseType = root.lookupType('easemob.sessionlist.GetSessionListResponse');
const errorType = root.lookupType('easemob.sessionlist.ErrorDetail');

describe('SessionListCodec', () => {
  it('should encode and decode session-list request', () => {
    const codec = new SessionListCodec();
    const request = buildSessionListRequest({
      requestId: 'req-1',
      resource: 'web',
      org: 'org',
      app: 'app',
      username: 'u1',
      lastSyncTime: 0,
      params: {
        includeEmpty: false,
        includeMark: true,
      },
    });

    const bytes = codec.encodeRequest(request);
    const decoded = codec.decode(bytes);

    expect(decoded).toMatchObject({
      type: SessionListMessageType.GET_SESSION_LIST_REQUEST,
      org: 'org',
      app: 'app',
      username: 'u1',
      lastSyncTime: 0,
      includeEmpty: false,
      includeMark: true,
      header: {
        requestId: 'req-1',
        resource: 'web',
      },
    });
  });

  it('should decode response and map protocol enums to public values', () => {
    const codec = new SessionListCodec();
    const responseBytes = responseType
      .encode(
        responseType.create({
          type: SessionListMessageType.GET_SESSION_LIST_RESPONSE,
          header: {
            resource: 'web',
            timestamp: 100,
            request_id: 'req-2',
            protocol_version: 1,
          },
          is_last_batch: true,
          last_sync_finished_ts: 99,
          sessions: [
            {
              session_id: 'g1',
              session_type: SessionListProtocolSessionType.GROUP_CHAT,
              updated_at: 12,
              unread_count: 3,
              remind_type: SessionListProtocolRemindType.AT,
              marks: ['mark_1', 'mark_2'],
              group_name: 'group-1',
              group_avatar: 'https://cdn.example.com/g1.png',
            },
          ],
        })
      )
      .finish();

    const decoded = codec.decode(responseBytes);
    expect(decoded).toMatchObject({
      type: SessionListMessageType.GET_SESSION_LIST_RESPONSE,
      isLastBatch: true,
      lastSyncFinishedTs: 99,
      header: expect.objectContaining({
        requestId: 'req-2',
      }),
    });

    const items = toSessionListItems(decoded as Extract<typeof decoded, { type: 11 }>, 'u1');
    expect(items).toEqual([
      expect.objectContaining({
        conversationId: 'g1',
        conversationType: 'groupChat',
        unreadCount: 3,
        remindType: 'AT',
        marks: [1, 2],
        conversationName: 'group-1',
        conversationAvatar: 'https://cdn.example.com/g1.png',
      }),
    ]);
  });

  it('should hydrate single-chat peer sender from server metadata only', () => {
    const items = toSessionListItems(
      {
        type: SessionListMessageType.GET_SESSION_LIST_RESPONSE,
        sessions: [
          {
            session_id: 'peer-1',
            session_type: SessionListProtocolSessionType.SINGLE_CHAT,
            updated_at: 12,
            unread_count: 1,
            metadata: JSON.stringify({
              remark: 'Peer Remark',
              nickname: 'Peer Nick',
              avatarurl: 'https://cdn.example.com/peer.png',
            }),
            last_message: {
              id: 'msg-1',
              from: { name: 'org_app_peer-1' },
              timestamp: 12,
            },
          },
          {
            session_id: 'group-1',
            session_type: SessionListProtocolSessionType.GROUP_CHAT,
            updated_at: 13,
            unread_count: 1,
            group_name: 'Group Name',
            group_avatar: 'https://cdn.example.com/group.png',
            last_message: {
              id: 'msg-2',
              from: { name: 'org_app_peer-1' },
              timestamp: 13,
            },
          },
        ],
      },
      'self'
    );

    expect(items[0]).toMatchObject({
      conversationId: 'peer-1',
      conversationName: 'Peer Remark',
      conversationAvatar: 'https://cdn.example.com/peer.png',
      lastMessage: {
        sender: {
          userId: 'peer-1',
          nickname: 'Peer Remark',
          avatarUrl: 'https://cdn.example.com/peer.png',
        },
      },
    });
    expect(items[1]).toMatchObject({
      conversationId: 'group-1',
      conversationName: 'Group Name',
      conversationAvatar: 'https://cdn.example.com/group.png',
      lastMessage: {
        sender: {
          userId: 'peer-1',
        },
      },
    });
    expect(items[1]?.lastMessage?.sender).not.toHaveProperty('nickname');
    expect(items[1]?.lastMessage?.sender).not.toHaveProperty('avatarUrl');
  });

  it('should decode error detail', () => {
    const codec = new SessionListCodec();
    const bytes = errorType
      .encode(
        errorType.create({
          type: SessionListMessageType.ERROR,
          code: 1003,
          message: 'server busy',
        })
      )
      .finish();

    expect(codec.decode(bytes)).toEqual({
      type: SessionListMessageType.ERROR,
      header: undefined,
      code: 1003,
      message: 'server busy',
    });
  });
});
