/**
 * 消息接收器单元测试
 *
 * 验证 ACK 与消息解析流程。
 */

import { describe, it, expect, vi } from 'vitest';
import { MessageReceiver } from '@/core/message/message-receiver';
import { EventHub } from '@/core/events/event-hub';
import { MsyncCodec } from '@/protocol/msync/codec';
import { getMsyncRoot } from '@/protocol/msync/root';
import { ContentType, KeyValueType, MsyncMessageType, NameSpace } from '@/protocol/msync/types';
import type { Message } from '@/types';

const buildAckPayload = () => {
  const root = getMsyncRoot();
  const commSyncDlType = root.lookupType('easemob.pb.CommSyncDL');
  const payload = commSyncDlType.create({
    metaId: '123456',
    serverId: '654321',
    status: { errorCode: 0 },
  });
  return commSyncDlType.encode(payload).finish();
};

describe('MessageReceiver', () => {
  it('应该处理 ACK 并通知消息发送器', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'test-user',
      token: 'test-token',
    });
    const eventHub = new EventHub();
    const messageSender = {
      handleAck: vi.fn(),
      handleSendError: vi.fn(),
    };
    const receiver = new MessageReceiver(codec, messageSender as any, eventHub);

    receiver.handleSyncPayload(buildAckPayload());

    expect(messageSender.handleAck).toHaveBeenCalledWith('123456', '654321', undefined);
  });

  it('应该在回执中返回替换后的内容', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'test-user',
      token: 'test-token',
      useReplacedMessageContents: true,
    });
    const eventHub = new EventHub();
    const messageSender = {
      handleAck: vi.fn(),
      handleSendError: vi.fn(),
    };
    const receiver = new MessageReceiver(codec, messageSender as any, eventHub);

    const root = getMsyncRoot();
    const commSyncDlType = root.lookupType('easemob.pb.CommSyncDL');
    const messageBodyType = root.lookupType('easemob.pb.MessageBody');
    const contentType = root.lookupType('easemob.pb.MessageBody.Content');
    const metaType = root.lookupType('easemob.pb.Meta');
    const content = contentType.create({ type: ContentType.TEXT, text: 'replaced' });
    const messageBody = messageBodyType.create({
      type: MsyncMessageType.SINGLECHAT,
      from: { name: 'alice' },
      to: { name: 'bob' },
      contents: [content],
      ext: [],
    });
    const payload = messageBodyType.encode(messageBody).finish();
    const meta = metaType.create({
      id: '2001',
      from: { name: 'alice' },
      to: { name: 'bob' },
      ns: NameSpace.CHAT,
      payload,
    });
    const commSyncDl = commSyncDlType.create({
      metaId: '123456',
      serverId: '2001',
      status: { errorCode: 0 },
      metas: [meta],
    });
    const ackPayload = commSyncDlType.encode(commSyncDl).finish();

    receiver.handleSyncPayload(ackPayload);

    expect(messageSender.handleAck).toHaveBeenCalledWith(
      '123456',
      '2001',
      expect.objectContaining({
        type: 'text',
        body: { content: 'replaced' },
      })
    );
  });

  it('应该解析文本消息并触发 onMessage', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'test-user',
      token: 'test-token',
    });
    const eventHub = new EventHub();
    const messageSender = {
      handleAck: vi.fn(),
      handleSendError: vi.fn(),
    };
    const receiver = new MessageReceiver(codec, messageSender as any, eventHub);
    const sampleMessage: Message = {
      msgServerId: 'server-1',
      msgLocalId: '',
    from: '',
    to: '',
      sender: { userId: 'alice' },
      conversationId: 'alice',
      conversationType: 'singleChat',
      type: 'text',
      status: 'sent',
      ext: {},
      timestamp: Date.now(),
      body: { content: 'Hello' },
    };
    vi.spyOn(codec, 'decodeSync').mockReturnValue({
      ack: undefined,
      messages: [sampleMessage],
    });

    const onMessage = vi.fn();
    eventHub.addEventHandler('test', {
      onMessage: message => onMessage(message),
    });

    receiver.handleSyncPayload(new Uint8Array([1, 2, 3]));

    expect(onMessage).toHaveBeenCalled();
    const firstCall = onMessage.mock.calls[0];
    expect(firstCall).toBeDefined();
    const message = firstCall?.[0];
    expect(message?.sender.userId).toBe('alice');
    expect(message?.body.content).toBe('Hello');
  });

  it('普通非流式消息和合并消息都应该触发 onMessage', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'test-user',
      token: 'test-token',
    });
    const eventHub = new EventHub();
    const messageSender = {
      handleAck: vi.fn(),
      handleSendError: vi.fn(),
    };
    const receiver = new MessageReceiver(codec, messageSender as any, eventHub);
    const textMessage: Message = {
      msgServerId: 'server-text',
      msgLocalId: 'local-text',
      from: '',
      to: '',
      sender: { userId: 'alice' },
      conversationId: 'alice',
      conversationType: 'singleChat',
      type: 'text',
      status: 'sent',
      ext: {},
      timestamp: Date.now(),
      body: { content: 'Hello' },
    };
    const combineMessage: Message = {
      ...textMessage,
      msgServerId: 'server-combine',
      msgLocalId: 'local-combine',
      type: 'combine',
      body: {
        title: '聊天记录',
        summary: '1 条',
        compatibleText: '[聊天记录]',
        filename: 'combine',
        filetype: 'application/octet-stream',
        combineLevel: 1,
      },
      combineLevel: 1,
    };
    vi.spyOn(codec, 'decodeSync').mockReturnValue({
      ack: undefined,
      messages: [textMessage, combineMessage],
    });

    const onMessage = vi.fn();
    eventHub.addEventHandler('test', {
      onMessage: message => onMessage(message),
    });

    receiver.handleSyncPayload(new Uint8Array([1, 2, 3]));

    expect(onMessage).toHaveBeenCalledTimes(2);
    expect(onMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ type: 'text' }));
    expect(onMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ type: 'combine' }));
  });

  it('应该解析下行消息扩展字段并补充 RECEIVE 方向', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'test-user',
      token: 'test-token',
    });
    const eventHub = new EventHub();
    const messageSender = {
      handleAck: vi.fn(),
      handleSendError: vi.fn(),
    };
    const receiver = new MessageReceiver(codec, messageSender as any, eventHub);

    const root = getMsyncRoot();
    const commSyncDlType = root.lookupType('easemob.pb.CommSyncDL');
    const messageBodyType = root.lookupType('easemob.pb.MessageBody');
    const contentType = root.lookupType('easemob.pb.MessageBody.Content');
    const metaType = root.lookupType('easemob.pb.Meta');

    const content = contentType.create({ type: ContentType.TEXT, text: 'room-message' });
    const messageBody = messageBodyType.create({
      type: MsyncMessageType.CHATROOM,
      from: { name: 'alice' },
      to: { name: 'room-1' },
      contents: [content],
      ext: [],
    });
    const payload = messageBodyType.encode(messageBody).finish();
    const notifyMeta = new TextEncoder().encode(JSON.stringify({ callback_replace: true }));
    const meta = metaType.create({
      id: '4001',
      from: { name: 'alice' },
      to: { name: 'room-1' },
      ns: NameSpace.CHAT,
      payload,
      ext: [
        { key: 'is_broadcast', type: KeyValueType.BOOL, varintValue: 1 },
        { key: 'chatroom_msg_tag', type: KeyValueType.INT, varintValue: 0 },
      ],
      meta: notifyMeta,
    });
    const commSyncDl = commSyncDlType.create({
      metaId: '0',
      metas: [meta],
    });
    const downlinkPayload = commSyncDlType.encode(commSyncDl).finish();

    const onMessage = vi.fn();
    eventHub.addEventHandler('test', {
      onMessage: message => onMessage(message),
    });

    receiver.handleSyncPayload(downlinkPayload);

    expect(onMessage).toHaveBeenCalledTimes(1);
    const firstCall = onMessage.mock.calls[0];
    expect(firstCall).toBeDefined();
    const message = firstCall?.[0];
    expect(message?.direct).toBe('RECEIVE');
    expect(message?.isOnline).toBe(true);
    expect(message?.isBroadcast).toBe(true);
    expect(message?.isContentReplaced).toBe(true);
    expect(message?.priority).toBe('high');
  });

  it('应该根据 is_online=0 标记离线消息', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'test-user',
      token: 'test-token',
    });
    const eventHub = new EventHub();
    const messageSender = {
      handleAck: vi.fn(),
      handleSendError: vi.fn(),
    };
    const receiver = new MessageReceiver(codec, messageSender as any, eventHub);

    const root = getMsyncRoot();
    const commSyncDlType = root.lookupType('easemob.pb.CommSyncDL');
    const messageBodyType = root.lookupType('easemob.pb.MessageBody');
    const contentType = root.lookupType('easemob.pb.MessageBody.Content');
    const metaType = root.lookupType('easemob.pb.Meta');

    const content = contentType.create({ type: ContentType.TEXT, text: 'offline-message' });
    const messageBody = messageBodyType.create({
      type: MsyncMessageType.SINGLECHAT,
      from: { name: 'alice' },
      to: { name: 'test-user' },
      contents: [content],
      ext: [],
    });
    const payload = messageBodyType.encode(messageBody).finish();
    const meta = metaType.create({
      id: '5001',
      from: { name: 'alice' },
      to: { name: 'test-user' },
      ns: NameSpace.CHAT,
      payload,
      ext: [{ key: 'is_online', type: KeyValueType.INT, varintValue: 0 }],
    });
    const commSyncDl = commSyncDlType.create({
      metaId: '0',
      metas: [meta],
    });
    const downlinkPayload = commSyncDlType.encode(commSyncDl).finish();

    const onMessage = vi.fn();
    eventHub.addEventHandler('test', {
      onMessage: message => onMessage(message),
    });

    receiver.handleSyncPayload(downlinkPayload);

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'text',
        isOnline: false,
      })
    );
  });

  it('不应该将 ACK 类型消息回调到 onMessage', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'test-user',
      token: 'test-token',
    });
    const eventHub = new EventHub();
    const messageSender = {
      handleAck: vi.fn(),
      handleSendError: vi.fn(),
    };
    const receiver = new MessageReceiver(codec, messageSender as any, eventHub);

    const root = getMsyncRoot();
    const commSyncDlType = root.lookupType('easemob.pb.CommSyncDL');
    const messageBodyType = root.lookupType('easemob.pb.MessageBody');
    const contentType = root.lookupType('easemob.pb.MessageBody.Content');
    const metaType = root.lookupType('easemob.pb.Meta');
    const content = contentType.create({ type: ContentType.TEXT, text: 'ack-internal' });
    const messageBody = messageBodyType.create({
      type: MsyncMessageType.READ_ACK,
      from: { name: 'alice' },
      to: { name: 'bob' },
      contents: [content],
      ext: [],
    });
    const payload = messageBodyType.encode(messageBody).finish();
    const meta = metaType.create({
      id: '3001',
      from: { name: 'alice' },
      to: { name: 'bob' },
      ns: NameSpace.CHAT,
      payload,
    });
    const commSyncDl = commSyncDlType.create({
      metaId: '0',
      metas: [meta],
    });
    const ackLikePayload = commSyncDlType.encode(commSyncDl).finish();

    const onMessage = vi.fn();
    eventHub.addEventHandler('test', {
      onMessage: message => onMessage(message),
    });

    receiver.handleSyncPayload(ackLikePayload);

    expect(onMessage).not.toHaveBeenCalled();
  });
});
