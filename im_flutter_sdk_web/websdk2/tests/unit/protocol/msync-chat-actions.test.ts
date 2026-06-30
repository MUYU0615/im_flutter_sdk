import { describe, expect, it } from 'vitest';

import { MsyncCodec } from '@/protocol/msync/codec';
import { getMsyncRoot } from '@/protocol/msync/root';
import { ContentType, KeyValueType, MsyncMessageType, NameSpace } from '@/protocol/msync/types';

const buildChatActionSyncPayload = (options: {
  readonly messageType: number;
  readonly from: string;
  readonly to: string;
  readonly toDomain?: string;
  readonly ackMessageId?: string;
  readonly editMessageId?: string;
  readonly ackContent?: string;
  readonly allowGroupAck?: boolean;
  readonly text?: string;
  readonly messageMeta?: string;
  readonly ext?: ReadonlyArray<Record<string, unknown>>;
  readonly meta?: string;
}): Uint8Array => {
  const root = getMsyncRoot();
  const commSyncDlType = root.lookupType('easemob.pb.CommSyncDL');
  const messageBodyType = root.lookupType('easemob.pb.MessageBody');
  const contentType = root.lookupType('easemob.pb.MessageBody.Content');
  const metaType = root.lookupType('easemob.pb.Meta');

  const contents =
    options.text !== undefined
      ? [contentType.create({ type: ContentType.TEXT, text: options.text })]
      : [];
  const messageBody = messageBodyType.create({
    type: options.messageType,
    from: { name: options.from },
    to: { name: options.to },
    contents,
    ext: options.ext ?? [],
    ackMessageId: options.ackMessageId,
    ackContent: options.ackContent,
    msgConfig: options.allowGroupAck ? { allowGroupAck: true } : undefined,
    editMessageId: options.editMessageId,
    meta: options.messageMeta,
  });
  const meta = metaType.create({
    id: '1001',
    from: { name: options.from },
    to: { name: options.to, domain: options.toDomain },
    ns: NameSpace.CHAT,
    meta: options.meta,
    payload: messageBodyType.encode(messageBody).finish(),
    timestamp: '1714291200000',
  });

  return commSyncDlType.encode(
    commSyncDlType.create({
      metaId: '0',
      metas: [meta],
    })
  ).finish();
};

describe('msync chat action decode', () => {
  it('应从普通消息 meta.edit_msg 解码 modifiedInfo', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'alice',
      token: 'token',
    });

    const result = codec.decodeSync(
      buildChatActionSyncPayload({
        messageType: MsyncMessageType.SINGLECHAT,
        from: 'bob',
        to: 'alice',
        text: 'updated text',
        messageMeta: JSON.stringify({
          edit_msg: {
            operator: 'bob',
            count: '3',
            edit_time: '1714291198000',
          },
        }),
      })
    );

    expect(result.messages[0]?.modifiedInfo).toEqual({
      operatorId: 'bob',
      operationCount: 3,
      operationTime: 1714291198000,
    });
  });

  it('应把单聊 channel ack 解码为会话已读事件', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'alice',
      token: 'token',
    });

    const result = codec.decodeSync(
      buildChatActionSyncPayload({
        messageType: MsyncMessageType.CHANNEL_ACK,
        from: 'bob',
        to: 'alice',
      })
    );

    expect(result.notifies?.[0]).toEqual({
      type: 'conversation_read',
      data: {
        conversationId: 'bob',
        conversationType: 'singleChat',
        timestamp: 1714291200000,
      },
    });
  });

  it('应把群消息 read ack 解码为消息已读事件', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'alice',
      token: 'token',
    });

    const result = codec.decodeSync(
      buildChatActionSyncPayload({
        messageType: MsyncMessageType.READ_ACK,
        from: 'bob',
        to: 'group-1',
        toDomain: 'conference.easemob.com',
        ackMessageId: '2001',
        ackContent: 'seen',
        allowGroupAck: true,
      })
    );

    expect(result.notifies?.[0]).toEqual({
      type: 'message_read',
      data: {
        messageId: '2001',
        conversationId: 'group-1',
        conversationType: 'groupChat',
        isGroupAck: true,
        ackContent: 'seen',
        timestamp: 1714291200000,
      },
    });
  });

  it('应优先使用 meta.chat_type 把群 read ack 解码为消息已读事件', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'alice',
      token: 'token',
    });

    const result = codec.decodeSync(
      buildChatActionSyncPayload({
        messageType: MsyncMessageType.READ_ACK,
        from: 'bob',
        to: 'group-2',
        ackMessageId: '2002',
        ackContent: 'seen-meta',
        allowGroupAck: true,
        messageMeta: JSON.stringify({
          chat_type: 'chat:group',
        }),
      })
    );

    expect(result.notifies?.[0]).toEqual({
      type: 'message_read',
      data: {
        messageId: '2002',
        conversationId: 'group-2',
        conversationType: 'groupChat',
        isGroupAck: true,
        ackContent: 'seen-meta',
        timestamp: 1714291200000,
      },
    });
  });

  it('应在缺少域名与 meta 时使用 allowGroupAck 把群 read ack 解码为群事件', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'alice',
      token: 'token',
    });

    const result = codec.decodeSync(
      buildChatActionSyncPayload({
        messageType: MsyncMessageType.READ_ACK,
        from: 'bob',
        to: 'group-3',
        ackMessageId: '2003',
        ackContent: 'seen-allow-group',
        allowGroupAck: true,
      })
    );

    expect(result.notifies?.[0]).toEqual({
      type: 'message_read',
      data: {
        messageId: '2003',
        conversationId: 'group-3',
        conversationType: 'groupChat',
        isGroupAck: true,
        ackContent: 'seen-allow-group',
        timestamp: 1714291200000,
      },
    });
  });

  it('应把 recall 解码为撤回事件', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'alice',
      token: 'token',
    });

    const result = codec.decodeSync(
      buildChatActionSyncPayload({
        messageType: MsyncMessageType.RECALL,
        from: 'bob',
        to: 'alice',
        ackMessageId: '3001',
      })
    );

    expect(result.notifies?.[0]).toEqual({
      type: 'message_recalled',
      data: {
        messageId: '3001',
        conversationId: 'bob',
        conversationType: 'singleChat',
        timestamp: 1714291200000,
      },
    });
  });

  it('应把 edit 解码为消息更新事件', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'alice',
      token: 'token',
    });

    const result = codec.decodeSync(
      buildChatActionSyncPayload({
        messageType: MsyncMessageType.EDIT,
        from: 'bob',
        to: 'group-1',
        toDomain: 'conference.easemob.com',
        editMessageId: '4001',
        text: 'updated text',
        messageMeta: JSON.stringify({
          edit_msg: {
            chat_type: 'chat:group',
            operator: 'bob',
            count: 2,
            edit_time: 1714291199000,
          },
        }),
        ext: [
          {
            key: 'edited',
            type: KeyValueType.STRING,
            stringValue: 'true',
          },
        ],
      })
    );

    expect(result.notifies?.[0]).toEqual({
      type: 'message_updated',
      data: {
        messageId: '4001',
        conversationId: 'group-1',
        conversationType: 'groupChat',
        timestamp: 1714291200000,
        message: {
          type: 'text',
          body: {
            content: 'updated text',
          },
          ext: {
            edited: 'true',
          },
          modifiedInfo: {
            operatorId: 'bob',
            operationCount: 2,
            operationTime: 1714291199000,
          },
        },
      },
    });
  });
});
