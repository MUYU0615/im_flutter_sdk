import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatClient } from '@/chat-client';
import { EventHub } from '@/core/events/event-hub';
import { MessageReceiver } from '@/core/message/message-receiver';
import type { MessageSender } from '@/core/message/message-sender';
import { ChatThreadManager } from '@/managers/chat-thread-manager';
import { MsyncCodec } from '@/protocol/msync/codec';

type ClientWithChatThreadManager = ChatClient & {
  readonly chatThreadManager: ChatThreadManager;
};

type ChatClientInternal = {
  eventHub: EventHub;
};

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

const createMessageSenderStub = (): Pick<
  MessageSender,
  'handleAck' | 'handleAckFailure' | 'handleSendError' | 'sendAction'
> => {
  return {
    handleAck: vi.fn(),
    handleAckFailure: vi.fn(),
    handleSendError: vi.fn(),
    sendAction: vi.fn(() =>
      Promise.resolve({
        protocolId: 'action-1',
        serverId: 'server-action-1',
        statusCode: 0,
      })
    ),
  };
};

const createReceiver = (client: ChatClient): { readonly codec: MsyncCodec; readonly receiver: MessageReceiver } => {
  const codec = new MsyncCodec({
    appKey: 'org#app',
    userId: 'alice',
    token: 'token',
  });
  const eventHub = (client as unknown as ChatClientInternal).eventHub;
  return {
    codec,
    receiver: new MessageReceiver(codec, createMessageSenderStub() as MessageSender, eventHub),
  };
};

const flushEvents = async (): Promise<void> => {
  await new Promise(resolve => {
    setTimeout(resolve, 0);
  });
};

describe('chat-thread events integration', () => {
  beforeEach((): void => {
    resetSingleton();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('MessageReceiver -> ChatThreadManager -> EventHub 应派发 4 个公开 Thread 事件', async () => {
    const client = ChatClient.init({ appKey: 'org#app' }).use(
      ChatThreadManager
    ) as ClientWithChatThreadManager;
    const { codec, receiver } = createReceiver(client);
    const handlers = {
      onChatThreadCreated: vi.fn(),
      onChatThreadDestroyed: vi.fn(),
      onChatThreadUpdated: vi.fn(),
      onChatThreadUserRemoved: vi.fn(),
    };
    client.chatThreadManager.addEventHandler('thread-integration', handlers);

    vi.spyOn(codec, 'decodeSync').mockReturnValue({
      ack: undefined,
      messages: [],
      notifies: [
        {
          type: 'thread',
          eventName: 'onChatThreadChange',
          data: {
            eventName: 'onChatThreadChange',
            payload: {
              id: 'thread-created',
              name: 'created topic',
              muc_parent_id: 'group-1',
              msg_parent_id: 'msg-parent',
              from: 'alice',
              operation: 'create',
              timestamp: 1,
            },
          },
        },
        {
          type: 'thread',
          eventName: 'onChatThreadChange',
          data: {
            eventName: 'onChatThreadChange',
            payload: {
              id: 'thread-updated',
              name: 'updated topic',
              muc_parent_id: 'group-1',
              from: 'bob',
              operation: 'update_msg',
              message_count: 2,
              last_message: {
                id: 'msg-last',
                timestamp: 2,
                payload: {
                  type: 'txt',
                  msg: 'hello',
                },
              },
              timestamp: 2,
            },
          },
        },
        {
          type: 'thread',
          eventName: 'onChatThreadChange',
          data: {
            eventName: 'onChatThreadChange',
            payload: {
              id: 'thread-destroyed',
              muc_parent_id: 'group-1',
              from: 'owner',
              operation: 'delete',
              timestamp: 3,
            },
          },
        },
        {
          type: 'thread',
          eventName: 'onChatThreadChange',
          data: {
            eventName: 'onChatThreadChange',
            payload: {
              id: 'thread-removed',
              muc_parent_id: 'group-1',
              from: 'owner',
              userIds: ['alice'],
              operation: 'kick',
              timestamp: 4,
            },
          },
        },
      ],
    });

    receiver.handleSyncPayload(new Uint8Array([1, 2, 3]));
    await flushEvents();

    expect(handlers.onChatThreadCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        chatThreadId: 'thread-created',
        parentId: 'group-1',
        chatThreadName: 'created topic',
        messageId: 'msg-parent',
      })
    );
    expect(handlers.onChatThreadUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        chatThreadId: 'thread-updated',
        parentId: 'group-1',
        chatThreadName: 'updated topic',
        messageCount: 2,
        lastMessage: {
          msgId: 'msg-last',
          type: 'txt',
          body: {
            type: 'txt',
            msg: 'hello',
          },
          timestamp: 2,
        },
      })
    );
    expect(handlers.onChatThreadDestroyed).toHaveBeenCalledWith(
      expect.objectContaining({
        chatThreadId: 'thread-destroyed',
        parentId: 'group-1',
      })
    );
    expect(handlers.onChatThreadUserRemoved).toHaveBeenCalledWith(
      expect.objectContaining({
        chatThreadId: 'thread-removed',
        parentId: 'group-1',
        memberId: 'alice',
      })
    );
  });

  it('未注册 ChatThreadManager capability 时 MessageReceiver 不应派发公开 Thread 事件', async () => {
    const client = ChatClient.init({ appKey: 'org#app' });
    const { codec, receiver } = createReceiver(client);
    const onChatThreadCreated = vi.fn();
    client.addEventHandler('app', {
      onChatThreadCreated,
    });

    vi.spyOn(codec, 'decodeSync').mockReturnValue({
      ack: undefined,
      messages: [],
      notifies: [
        {
          type: 'thread',
          eventName: 'onChatThreadChange',
          data: {
            eventName: 'onChatThreadChange',
            payload: {
              id: 'thread-1',
              name: 'topic',
              muc_parent_id: 'group-1',
              operation: 'create',
              timestamp: 1,
            },
          },
        },
      ],
    });

    receiver.handleSyncPayload(new Uint8Array([1, 2, 3]));
    await flushEvents();

    expect(onChatThreadCreated).not.toHaveBeenCalled();
  });
});
