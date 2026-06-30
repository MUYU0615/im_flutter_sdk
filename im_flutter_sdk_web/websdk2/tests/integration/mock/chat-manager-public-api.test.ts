// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatClient } from '@/chat-client';
import { EventHub } from '@/core/events/event-hub';
import { ChatManager } from '@/managers/chat-manager';
import { ChatEventName, ConnectionStatus, type Message, type SendMessageOptions } from '@/types';

type ClientWithChatManager = ChatClient & {
  readonly chatManager: ChatManager;
};

type ChatClientInternal = {
  currentUserId: string | null;
  state: ConnectionStatus;
  core: {
    sendMessage: (message: Message, options?: SendMessageOptions) => Promise<Message>;
  } | null;
  eventHub: EventHub;
};

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

const primeSendContext = (client: ChatClient): ChatClientInternal => {
  const internal = client as unknown as ChatClientInternal;
  internal.currentUserId = 'mock-user';
  internal.state = ConnectionStatus.CONNECTED;
  internal.core = {
    sendMessage: vi.fn(async (message: Message, options?: SendMessageOptions): Promise<Message> => {
      options?.onSending?.({
        ...message,
        status: 'sending',
      });
      const sentMessage: Message = {
        ...message,
        status: 'sent',
      };
      options?.onSuccess?.(sentMessage);
      return {
        ...sentMessage,
      };
    }),
  };
  return internal;
};

const waitForInboundMessage = (
  client: ClientWithChatManager,
  handlerId: string
): Promise<Message> => {
  return new Promise<Message>(resolve => {
    client.chatManager.addEventHandler(handlerId, {
      onMessage: message => {
        client.chatManager.removeEventHandler(handlerId);
        resolve(message);
      },
    });
  });
};

describe('ChatManager 公开 API integration mock-only', () => {
  beforeEach(() => {
    resetSingleton();
  });

  it('应完成 createTextMessage -> chatManager.sendMessage -> onMessage 主链路', async () => {
    const client = ChatClient.init({ appKey: 'org#app' }).use(ChatManager) as ClientWithChatManager;
    const internal = primeSendContext(client);

    const outbound = client.chatManager.createTextMessage({
      content: `chat-manager:${Date.now()}`,
      conversationId: 'mock-peer',
      conversationType: 'singleChat',
    });
    expect(outbound.sender.userId).toBe('mock-user');
    expect(outbound.conversationId).toBe('mock-peer');
    expect(outbound.conversationType).toBe('singleChat');

    const inboundPromise = waitForInboundMessage(client, 'chat-manager-public-api');
    const sent = await client.chatManager.sendMessage(outbound);

    const inbound: Message = {
      ...outbound,
      msgServerId: 'server-1',
      sender: { userId: 'mock-peer' },
      status: 'sent',
    };
    internal.eventHub.dispatch(ChatEventName.MESSAGE, inbound);

    expect(sent.status).toBe('sent');
    await expect(inboundPromise).resolves.toEqual(inbound);
    expect(internal.core?.sendMessage).toHaveBeenCalledWith(outbound, undefined);
  });

  it('sendMessage 应透传 options 回调', async () => {
    const client = ChatClient.init({ appKey: 'org#app' }).use(ChatManager) as ClientWithChatManager;
    const internal = primeSendContext(client);
    const onSending = vi.fn();
    const onSuccess = vi.fn();
    const onFailed = vi.fn();

    const outbound = client.chatManager.createTextMessage({
      content: 'options',
      conversationId: 'mock-peer',
      conversationType: 'singleChat',
    });
    const options: SendMessageOptions = {
      onSending,
      onSuccess,
      onFailed,
    };

    const sent = await client.chatManager.sendMessage(outbound, options);

    expect(sent.status).toBe('sent');
    expect(onSending).toHaveBeenCalledWith(expect.objectContaining({ status: 'sending' }));
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ status: 'sent' }));
    expect(onFailed).not.toHaveBeenCalled();
    expect(internal.core?.sendMessage).toHaveBeenCalledWith(outbound, options);
  });

  it('combine 消息应通过 onMessage 主链路分发', async () => {
    const client = ChatClient.init({ appKey: 'org#app' }).use(ChatManager) as ClientWithChatManager;
    const internal = primeSendContext(client);
    const inboundPromise = waitForInboundMessage(client, 'chat-manager-combine-message');

    const combineMessage = client.chatManager.createCombineMessage({
      title: '聊天记录',
      summary: '1 条',
      compatibleText: '[聊天记录]',
      messageList: [
        client.chatManager.createTextMessage({
          content: 'child',
          conversationId: 'mock-peer',
          conversationType: 'singleChat',
        }),
      ],
      conversationId: 'mock-peer',
      conversationType: 'singleChat',
    });
    const inbound: Message = {
      ...combineMessage,
      msgServerId: 'server-combine-1',
      status: 'sent',
      direct: 'RECEIVE',
    };

    internal.eventHub.dispatch(ChatEventName.MESSAGE, inbound);

    await expect(inboundPromise).resolves.toEqual(
      expect.objectContaining({
        type: 'combine',
        msgServerId: 'server-combine-1',
      })
    );
  });
});
