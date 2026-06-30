import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatClient } from '@/chat-client';
import { ChatManager } from '@/managers/chat-manager';
import { ChatThreadManager } from '@/managers/chat-thread-manager';

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

const dispatchThreadNotify = (
  client: ChatClient,
  payload: Record<string, unknown>
): void => {
  (
    client as unknown as {
      eventHub: { dispatch: (event: string, payload: unknown) => void };
    }
  ).eventHub.dispatch('onChatThreadNotify', {
    eventName: 'onChatThreadChange',
    payload,
  });
};

const flushEvents = async (): Promise<void> => {
  await new Promise(resolve => {
    setTimeout(resolve, 0);
  });
};

describe('ChatClient chat-thread events', () => {
  beforeEach((): void => {
    resetSingleton();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('thread create notify 应映射为 onChatThreadCreated', async () => {
    const client = ChatClient.init({ appKey: 'org#app' }).use(ChatManager).use(ChatThreadManager);
    const onChatThreadCreated = vi.fn();
    client.chatThreadManager.addEventHandler('thread-ui', {
      onChatThreadCreated,
    });

    dispatchThreadNotify(client, {
      id: 'thread-1',
      name: 'topic-1',
      muc_parent_id: 'group-1',
      msg_parent_id: 'msg-parent-1',
      from: 'alice',
      operation: 'create',
      timestamp: 100,
    });

    await flushEvents();

    expect(onChatThreadCreated).toHaveBeenCalledWith({
      chatThreadId: 'thread-1',
      parentId: 'group-1',
      operatorId: 'alice',
      chatThreadName: 'topic-1',
      messageId: 'msg-parent-1',
      thread: {
        chatThreadId: 'thread-1',
        parentId: 'group-1',
        name: 'topic-1',
        messageId: 'msg-parent-1',
        messageCount: undefined,
        lastMessage: undefined,
      },
      timestamp: 100,
    });
  });

  it('thread delete notify 应映射为 onChatThreadDestroyed', async () => {
    const client = ChatClient.init({ appKey: 'org#app' }).use(ChatManager).use(ChatThreadManager);
    const onChatThreadDestroyed = vi.fn();
    client.chatThreadManager.addEventHandler('thread-ui', {
      onChatThreadDestroyed,
    });

    dispatchThreadNotify(client, {
      id: 'thread-2',
      muc_parent_id: 'group-2',
      from: 'bob',
      operation: 'delete',
      timestamp: 101,
    });

    await flushEvents();

    expect(onChatThreadDestroyed).toHaveBeenCalledWith({
      chatThreadId: 'thread-2',
      parentId: 'group-2',
      operatorId: 'bob',
      timestamp: 101,
    });
  });

  it('thread update notify 应映射为 onChatThreadUpdated 并保留消息摘要', async () => {
    const client = ChatClient.init({ appKey: 'org#app' }).use(ChatManager).use(ChatThreadManager);
    const onChatThreadUpdated = vi.fn();
    client.chatThreadManager.addEventHandler('thread-ui', {
      onChatThreadUpdated,
    });

    dispatchThreadNotify(client, {
      id: 'thread-3',
      name: 'topic-3',
      muc_parent_id: 'group-3',
      msg_parent_id: 'msg-parent-3',
      from: 'carol',
      operation: 'update',
      timestamp: 102,
      message_count: 3,
      last_message: {
        id: 'msg-1',
        timestamp: 99,
        payload: {
          type: 'txt',
          msg: 'hello',
        },
      },
    });

    await flushEvents();

    expect(onChatThreadUpdated).toHaveBeenCalledWith({
      chatThreadId: 'thread-3',
      parentId: 'group-3',
      operatorId: 'carol',
      chatThreadName: 'topic-3',
      messageId: 'msg-parent-3',
      messageCount: 3,
      lastMessage: {
        msgId: 'msg-1',
        type: 'txt',
        body: {
          type: 'txt',
          msg: 'hello',
        },
        timestamp: 99,
      },
      thread: {
        chatThreadId: 'thread-3',
        parentId: 'group-3',
        name: 'topic-3',
        messageId: 'msg-parent-3',
        messageCount: 3,
        lastMessage: {
          msgId: 'msg-1',
          type: 'txt',
          body: {
            type: 'txt',
            msg: 'hello',
          },
          timestamp: 99,
        },
      },
      timestamp: 102,
    });
  });

  it('thread update_msg notify 应映射为 onChatThreadUpdated', async () => {
    const client = ChatClient.init({ appKey: 'org#app' }).use(ChatManager).use(ChatThreadManager);
    const onChatThreadUpdated = vi.fn();
    client.chatThreadManager.addEventHandler('thread-ui', {
      onChatThreadUpdated,
    });

    dispatchThreadNotify(client, {
      id: 'thread-4',
      name: 'topic-4',
      muc_parent_id: 'group-4',
      operation: 'update_msg',
      timestamp: 103,
    });

    await flushEvents();

    expect(onChatThreadUpdated).toHaveBeenCalledWith({
      chatThreadId: 'thread-4',
      parentId: 'group-4',
      operatorId: undefined,
      chatThreadName: 'topic-4',
      messageId: undefined,
      messageCount: undefined,
      lastMessage: undefined,
      thread: {
        chatThreadId: 'thread-4',
        parentId: 'group-4',
        name: 'topic-4',
        messageId: undefined,
        messageCount: undefined,
        lastMessage: undefined,
      },
      timestamp: 103,
    });
  });

  it('thread kick notify 应映射为 onChatThreadUserRemoved', async () => {
    const client = ChatClient.init({ appKey: 'org#app' }).use(ChatManager).use(ChatThreadManager);
    const onChatThreadUserRemoved = vi.fn();
    client.chatThreadManager.addEventHandler('thread-ui', {
      onChatThreadUserRemoved,
    });

    dispatchThreadNotify(client, {
      id: 'thread-5',
      muc_parent_id: 'group-5',
      from: 'owner',
      userIds: ['alice'],
      operation: 'kick',
      timestamp: 104,
    });

    await flushEvents();

    expect(onChatThreadUserRemoved).toHaveBeenCalledWith({
      chatThreadId: 'thread-5',
      parentId: 'group-5',
      operatorId: 'owner',
      memberId: 'alice',
      timestamp: 104,
    });
  });

  it('join/leave/未知 operation 与字段不足通知不派发公开 Thread 事件', async () => {
    const client = ChatClient.init({ appKey: 'org#app' }).use(ChatManager).use(ChatThreadManager);
    const handlers = {
      onChatThreadCreated: vi.fn(),
      onChatThreadDestroyed: vi.fn(),
      onChatThreadUpdated: vi.fn(),
      onChatThreadUserRemoved: vi.fn(),
    };
    client.chatThreadManager.addEventHandler('thread-ui', handlers);

    dispatchThreadNotify(client, {
      id: 'thread-6',
      muc_parent_id: 'group-6',
      operation: 'join',
    });
    dispatchThreadNotify(client, {
      id: 'thread-7',
      muc_parent_id: 'group-7',
      operation: 'leave',
    });
    dispatchThreadNotify(client, {
      id: 'thread-8',
      muc_parent_id: 'group-8',
      operation: 'unknown',
    });
    dispatchThreadNotify(client, {
      muc_parent_id: 'group-9',
      operation: 'create',
    });
    dispatchThreadNotify(client, {
      id: 'thread-10',
      operation: 'create',
    });

    await flushEvents();

    expect(handlers.onChatThreadCreated).not.toHaveBeenCalled();
    expect(handlers.onChatThreadDestroyed).not.toHaveBeenCalled();
    expect(handlers.onChatThreadUpdated).not.toHaveBeenCalled();
    expect(handlers.onChatThreadUserRemoved).not.toHaveBeenCalled();
  });

  it('未注册 ChatThreadManager 时不派发公开 Thread 事件', async () => {
    const client = ChatClient.init({ appKey: 'org#app' }).use(ChatManager);
    const onChatThreadCreated = vi.fn();
    client.addEventHandler('app', {
      onChatThreadCreated,
    });

    dispatchThreadNotify(client, {
      id: 'thread-11',
      muc_parent_id: 'group-11',
      operation: 'create',
      timestamp: 105,
    });

    await flushEvents();

    expect(onChatThreadCreated).not.toHaveBeenCalled();
  });
});
