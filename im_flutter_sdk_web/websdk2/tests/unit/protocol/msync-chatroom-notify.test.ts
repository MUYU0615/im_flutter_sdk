import { describe, expect, it } from 'vitest';

import { MsyncCodec } from '@/protocol/msync/codec';
import { getMsyncRoot } from '@/protocol/msync/root';
import { NameSpace } from '@/protocol/msync/types';

const buildChatRoomMucSyncPayload = (options: {
  readonly operation: number;
  readonly from: string;
  readonly to?: ReadonlyArray<string>;
  readonly chatRoomId: string;
  readonly chatRoomName?: string;
  readonly reason?: string;
  readonly eventExt?: string;
  readonly members?: ReadonlyArray<string>;
}): Uint8Array => {
  const root = getMsyncRoot();
  const commSyncDlType = root.lookupType('easemob.pb.CommSyncDL');
  const metaType = root.lookupType('easemob.pb.Meta');
  const mucBodyType = root.lookupType('easemob.pb.MUCBody');

  const mucBody = mucBodyType.create({
    operation: options.operation,
    isChatroom: true,
    mucId: { name: options.chatRoomId },
    mucName: options.chatRoomName ?? '',
    from: { name: options.from },
    to: (options.to ?? []).map(item => ({ name: item })),
    reason: options.reason ?? '',
    eventInfo: {
      ext: options.eventExt ?? '',
    },
    members: options.members ?? [],
  });
  const meta = metaType.create({
    id: '1001',
    ns: NameSpace.MUC,
    payload: mucBodyType.encode(mucBody).finish(),
  });

  return commSyncDlType.encode(
    commSyncDlType.create({
      metaId: '0',
      metas: [meta],
    })
  ).finish();
};

describe('msync chatroom notify decode', () => {
  it('应把聊天室 UPDATE 解码为内部聊天室通知', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'alice',
      token: 'token',
    });

    const result = codec.decodeSync(
      buildChatRoomMucSyncPayload({
        operation: 14,
        from: 'bob',
        chatRoomId: 'r1',
        chatRoomName: 'Room 1',
        eventExt: JSON.stringify({
          name: 'Room 2',
          members_only: true,
        }),
      })
    );

    expect(result.notifies).toEqual([
      {
        type: 'chatroom',
        eventName: 'onChatRoomNotify',
        data: {
          eventName: 'onChatRoomInfoChanged',
          payload: {
            chatRoomId: 'r1',
            chatRoomName: 'Room 1',
            shouldFetchChatRoomDetail: true,
            chatRoomPatch: {
              name: 'Room 2',
            },
          },
        },
      },
    ]);
  });

  it('应把聊天室 ATTRIBUTES_UPDATE 解码为聊天室属性更新通知', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'alice',
      token: 'token',
    });

    const result = codec.decodeSync(
      buildChatRoomMucSyncPayload({
        operation: 43,
        from: 'bob',
        chatRoomId: 'r1',
        eventExt: JSON.stringify({
          operator: 'alice',
          properties: {
            topic: 'sdk',
          },
          result: {
            successKeys: ['topic'],
          },
        }),
      })
    );

    expect(result.notifies?.[0]).toEqual({
      type: 'chatroom',
      eventName: 'onChatRoomNotify',
      data: {
        eventName: 'onAttributesUpdate',
        payload: {
          chatRoomId: 'r1',
          chatRoomName: '',
          attributes: {
            topic: 'sdk',
          },
          from: 'alice',
        },
      },
    });
  });
});
