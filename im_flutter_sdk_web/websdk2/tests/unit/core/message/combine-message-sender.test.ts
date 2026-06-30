import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventHub } from '@/core/events/event-hub';
import { MessageSender } from '@/core/message/message-sender';
import type { SocketLike } from '@/platform';
import { MsyncCodec } from '@/protocol/msync/codec';
import type { Message } from '@/types';
import { attachmentFileStore } from '@/upload/attachment-file-store';

class MockWebSocket {
  public readyState: number = WebSocket.OPEN;
  public sentMessages: ArrayBuffer[] = [];

  send(data: string | ArrayBuffer): void {
    this.sentMessages.push(data as ArrayBuffer);
  }

  close(): void {
    this.readyState = WebSocket.CLOSED;
  }
}

const createCombineItem = (partial: Partial<Message> = {}): Message => {
  return {
    type: 'text',
    sender: {
      userId: 'user-1',
    },
    conversationId: 'target-1',
    conversationType: 'singleChat',
    timestamp: 1735689600000,
    body: {
      content: 'hello',
    },
    msgServerId: '',
    msgLocalId: '',
    from: '',
    to: '',
    status: 'sent',
    ext: {},
    ...partial,
  } as Message;
};

describe('combine message sender', () => {
  let sender: MessageSender;
  let codec: MsyncCodec;
  let originalCreateObjectURL: ((obj: Blob | MediaSource) => string) | undefined;

  beforeEach(() => {
    originalCreateObjectURL = (URL as { createObjectURL?: (obj: Blob | MediaSource) => string })
      .createObjectURL;
    (URL as { createObjectURL?: (obj: Blob | MediaSource) => string }).createObjectURL = vi
      .fn()
      .mockReturnValue('blob:combine');

    codec = new MsyncCodec({
      appKey: 'test#app',
      userId: 'user-1',
      token: 'token',
    });

    sender = new MessageSender(codec, new MockWebSocket() as unknown as SocketLike, new EventHub());
  });

  afterEach(() => {
    if (originalCreateObjectURL) {
      (URL as { createObjectURL?: (obj: Blob | MediaSource) => string }).createObjectURL =
        originalCreateObjectURL;
    } else {
      delete (URL as { createObjectURL?: (obj: Blob | MediaSource) => string }).createObjectURL;
    }
    sender.destroy();
    attachmentFileStore.clear();
  });

  it('应在发送前处理 combine 载荷并在 ack 后清理缓存', async () => {
    const message: Message = {
      msgServerId: '',
      msgLocalId: 'combine-local-1',
    from: '',
    to: '',
      sender: {
        userId: 'user-1',
      },
      conversationId: 'target-1',
      conversationType: 'singleChat',
      type: 'combine',
      status: 'sending',
      ext: {},
      timestamp: 1735689600000,
      body: {
        title: '聊天记录',
        summary: '共 1 条',
        compatibleText: '[聊天记录]',
        messageList: [createCombineItem()],
        filename: 'combine',
        filetype: 'application/octet-stream',
        combineLevel: 0,
      },
    };

    const sendPromise = sender.sendMessage(message);

    setTimeout(() => {
      sender.handleAck(codec.toProtocolId(message.msgLocalId));
    }, 0);

    const result = await sendPromise;
    expect(result.type).toBe('combine');
    expect(result.combineLevel).toBe(1);
    expect(result.body).toMatchObject({
      combineLevel: 1,
    });
    expect(attachmentFileStore.get(message.msgLocalId)).toBeUndefined();
  });
});
