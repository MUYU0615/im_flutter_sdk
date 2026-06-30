import { describe, expect, it, vi } from 'vitest';

import { EventHub } from '@/core/events/event-hub';
import { MessageReceiver } from '@/core/message/message-receiver';
import type { MessageSender } from '@/core/message/message-sender';
import { MsyncCodec } from '@/protocol/msync/codec';

const createMessageSenderStub = (): Pick<MessageSender, 'handleAck' | 'handleSendError'> => {
  return {
    handleAck: vi.fn(),
    handleSendError: vi.fn(),
  };
};

describe('MessageReceiver user-info notify events', () => {
  it('应识别 subscribe_metadata_updated 并分发内部用户资料通知事件', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'alice',
      token: 'test-token',
    });
    const eventHub = new EventHub();
    const receiver = new MessageReceiver(codec, createMessageSenderStub() as MessageSender, eventHub);

    const onUserInfoNotify = vi.fn();
    eventHub.addEventHandler('test', {
      onUserInfoNotify,
    });

    vi.spyOn(codec, 'decodeSync').mockReturnValue({
      ack: undefined,
      messages: [],
      notifies: [
        {
          type: 'subscribe_metadata_updated',
          data: {
            username: 'bob',
            metadata: {
              nickname: 'Bob',
            },
            lastModified: 10,
          },
        },
      ],
    });

    receiver.handleSyncPayload(new Uint8Array([1, 2, 3]));

    expect(onUserInfoNotify).toHaveBeenCalledWith({
      notifyType: 'subscribe_metadata_updated',
      userId: 'bob',
      metadata: {
        nickname: 'Bob',
      },
      lastModified: 10,
    });
  });

  it('应识别 contact_metadata_updated 并兼容 eventName 形式', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'alice',
      token: 'test-token',
    });
    const eventHub = new EventHub();
    const receiver = new MessageReceiver(codec, createMessageSenderStub() as MessageSender, eventHub);

    const onUserInfoNotify = vi.fn();
    eventHub.addEventHandler('test', {
      onUserInfoNotify,
    });

    vi.spyOn(codec, 'decodeSync').mockReturnValue({
      ack: undefined,
      messages: [],
      notifies: [
        {
          type: 'custom',
          eventName: 'contact_metadata_updated',
          data: {
            userId: 'friend-1',
            metadata: {
              avatarurl: 'https://cdn.example.com/friend.png',
            },
            lastModified: '20',
          },
        },
      ],
    });

    receiver.handleSyncPayload(new Uint8Array([1, 2, 3]));

    expect(onUserInfoNotify).toHaveBeenCalledWith({
      notifyType: 'contact_metadata_updated',
      userId: 'friend-1',
      metadata: {
        avatarurl: 'https://cdn.example.com/friend.png',
      },
      lastModified: 20,
    });
  });

  it('应识别 user_metadata_updated 并在 data 缺少 userId 时回填当前用户', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'alice',
      token: 'test-token',
    });
    const eventHub = new EventHub();
    const receiver = new MessageReceiver(codec, createMessageSenderStub() as MessageSender, eventHub);

    const onUserInfoNotify = vi.fn();
    eventHub.addEventHandler('test', {
      onUserInfoNotify,
    });

    vi.spyOn(codec, 'decodeSync').mockReturnValue({
      ack: undefined,
      messages: [],
      notifies: [
        {
          type: 'user_metadata_updated',
          data: {
            metadata: {
              nickname: 'Alice New',
            },
            lastModified: 30,
          },
        },
      ],
    });

    receiver.handleSyncPayload(new Uint8Array([1, 2, 3]));

    expect(onUserInfoNotify).toHaveBeenCalledWith({
      notifyType: 'user_metadata_updated',
      userId: 'alice',
      metadata: {
        nickname: 'Alice New',
      },
      lastModified: 30,
    });
  });

  it('非法用户资料通知不应透传原始 payload', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'alice',
      token: 'test-token',
    });
    const eventHub = new EventHub();
    const receiver = new MessageReceiver(codec, createMessageSenderStub() as MessageSender, eventHub);

    const onUserInfoNotify = vi.fn();
    eventHub.addEventHandler('test', {
      onUserInfoNotify,
    });

    vi.spyOn(codec, 'decodeSync').mockReturnValue({
      ack: undefined,
      messages: [],
      notifies: [
        {
          type: 'subscribe_metadata_updated',
          data: {
            username: '',
            metadata: 'bad',
            lastModified: 'NaN',
          },
        },
      ],
    });

    receiver.handleSyncPayload(new Uint8Array([1, 2, 3]));

    expect(onUserInfoNotify).not.toHaveBeenCalled();
  });
});
