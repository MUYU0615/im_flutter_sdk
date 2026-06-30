import { describe, expect, it } from 'vitest';

import { mapMucOperationToChatRoomEvent } from '@/managers/chatroom/chatroom-event-mapper';

describe('chatroom event mapper', () => {
  it('应把 UPDATE 映射为 onChatRoomInfoChanged 并归一化 patch 字段', () => {
    expect(
      mapMucOperationToChatRoomEvent({
        operation: 14,
        chatRoomId: 'g1',
        chatRoomName: 'ChatRoom 1',
        eventExt: JSON.stringify({
          name: 'New ChatRoom',
          members_only: true,
          allow_user_invites: false,
          max_users: 300,
          custom: '{"a":1}',
        }),
      })
    ).toEqual({
      eventName: 'onChatRoomInfoChanged',
      payload: {
        chatRoomId: 'g1',
        chatRoomName: 'ChatRoom 1',
        shouldFetchChatRoomDetail: true,
        chatRoomPatch: {
          name: 'New ChatRoom',
          maxMembers: 300,
          ext: '{"a":1}',
        },
      },
    });
  });

  it('应把 MUTE 映射为 onMuteListAdded', () => {
    expect(
      mapMucOperationToChatRoomEvent({
        operation: 23,
        chatRoomId: 'g1',
        members: ['bob', 'carol'],
        reason: '3600',
      })
    ).toEqual({
      eventName: 'onMuteListAdded',
      payload: {
        chatRoomId: 'g1',
        chatRoomName: undefined,
        userIds: ['bob', 'carol'],
        muteMembers: { bob: 4638873600000, carol: 4638873600000 },
        muteExpire: 3600,
      },
    });
  });

  it('应把 ATTRIBUTES_UPDATE 映射为 onAttributesUpdate', () => {
    expect(
      mapMucOperationToChatRoomEvent({
        operation: 43,
        chatRoomId: 'g1',
        from: {
          name: 'bob',
          clientResource: 'ios',
        },
        eventExt: JSON.stringify({
          operator: 'alice',
          properties: {
            topic: 'sdk',
            notice: 'v028',
          },
          result: {
            successKeys: ['topic', 'notice'],
          },
        }),
      })
    ).toEqual({
      eventName: 'onAttributesUpdate',
      payload: {
        chatRoomId: 'g1',
        chatRoomName: undefined,
        attributes: {
          topic: 'sdk',
          notice: 'v028',
        },
        from: 'alice',
      },
    });
  });
});
