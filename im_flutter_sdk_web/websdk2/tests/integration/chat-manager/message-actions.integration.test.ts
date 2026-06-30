import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatClient } from '@/chat-client';
import { ChatManager } from '@/managers/chat-manager';

import {
  type ClientWithChatManager,
  primeConnectedCore,
  buildTextMessage,
  resetSingleton,
} from './helpers';

describe('ChatManager message actions integration', () => {
  let client: ClientWithChatManager;

  beforeEach(() => {
    resetSingleton();
    client = ChatClient.init({ appKey: 'org#app' }).use(ChatManager) as ClientWithChatManager;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetSingleton();
  });

  it('read ack / recall / update 应走真实 manager 编排并派发本地相关事件', async () => {
    const sendMessageAction = vi.fn(async () => ({
      protocolId: 'p1',
      serverId: 's1',
      statusCode: 0,
    }));
    const internal = primeConnectedCore(client, {
      sendMessageAction,
    });

    const onMessageRecalled = vi.fn();
    const onMessageUpdated = vi.fn();
    client.chatManager.addEventHandler('message-actions', {
      onMessageRecalled,
      onMessageUpdated,
    });

    const readMessage = buildTextMessage({
      msgServerId: 'read-1',
      conversationId: 'peer-1',
      conversationType: 'singleChat',
    });
    const groupReadMessage = buildTextMessage({
      msgServerId: 'group-read-1',
      conversationId: 'group-1',
      conversationType: 'groupChat',
    });

    await client.chatManager.markConversationRead({
      conversationId: 'peer-1',
      conversationType: 'singleChat',
    });
    await client.chatManager.markMessageRead({
      messages: [{ message: readMessage }],
    });
    await client.chatManager.markMessageRead({
      messages: [{ message: groupReadMessage, ackContent: 'seen' }],
    });
    const recalled = await client.chatManager.recallMessage({
      messageId: 'recall-1',
      conversationId: 'peer-1',
      conversationType: 'singleChat',
    });
    const updated = await client.chatManager.modifyMessage({
      messageId: 'update-1',
      conversationId: 'peer-1',
      conversationType: 'singleChat',
      message: {
        type: 'text',
        body: { content: 'edited' },
        ext: { edited: 'true' },
      },
    });

    expect(sendMessageAction).toHaveBeenNthCalledWith(
      1,
      {
        kind: 'conversationRead',
        conversationId: 'peer-1',
        conversationType: 'singleChat',
      },
      expect.any(Function)
    );
    expect(sendMessageAction).toHaveBeenNthCalledWith(
      2,
      {
        kind: 'messageRead',
        conversationId: 'peer-1',
        conversationType: 'singleChat',
        messageId: 'read-1',
      },
      expect.any(Function)
    );
    expect(sendMessageAction).toHaveBeenNthCalledWith(
      3,
      {
        kind: 'groupMessageRead',
        conversationId: 'group-1',
        conversationType: 'groupChat',
        messageId: 'group-read-1',
        ackContent: 'seen',
      },
      expect.any(Function)
    );
    expect(sendMessageAction).toHaveBeenNthCalledWith(
      4,
      {
        kind: 'recall',
        conversationId: 'peer-1',
        conversationType: 'singleChat',
        messageId: 'recall-1',
        ext: undefined,
      },
      expect.any(Function)
    );
    expect(sendMessageAction).toHaveBeenNthCalledWith(
      5,
      {
        kind: 'update',
        conversationId: 'peer-1',
        conversationType: 'singleChat',
        messageId: 'update-1',
        body: { content: 'edited' },
        messageType: 'text',
        ext: { edited: 'true' },
      },
      expect.any(Function)
    );

    expect(onMessageRecalled).toHaveBeenCalledWith(recalled);
    expect(onMessageUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: 'update-1',
        conversationId: 'peer-1',
        conversationType: 'singleChat',
        message: expect.objectContaining({
          type: 'text',
          body: { content: 'edited' },
          ext: { edited: 'true' },
          modifiedInfo: expect.objectContaining({
            operatorId: 'alice',
            operationCount: 1,
          }),
        }),
      })
    );
    expect(updated.sender.userId).toBe(internal.currentUserId);
  });
});
