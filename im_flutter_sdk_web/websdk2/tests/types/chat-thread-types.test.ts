import { describe, expect, it } from 'vitest';

import {
  ChatClient,
  ChatThread,
  ChatThreadManager,
  type ChatThreadCreatedEventPayload,
  type ChatThreadDestroyedEventPayload,
  type ChatThreadDetail,
  type ChatThreadEventHandlerMap,
  type ChatThreadListResult,
  type ChatThreadMemberEntry,
  type ChatThreadUpdatedEventPayload,
  type ChatThreadUserRemovedEventPayload,
  type RemoveChatThreadMemberParams,
} from '@/index';
import {
  ChatThread as SubpathChatThread,
  ChatThreadManager as SubpathChatThreadManager,
} from '@/managers/chat-thread';
import type { RestContext } from '@/types/chat-client';

const DEFAULT_REST_CONTEXT: RestContext = {
  restBaseUrl: 'https://api.example.com',
  appKey: 'org#app',
  userId: 'alice',
  token: 'token',
  clientResource: 'web',
};

const createMockClient = (): ChatClient =>
  ({
    getRestContext: (): RestContext => DEFAULT_REST_CONTEXT,
  }) as unknown as ChatClient;

describe('chat-thread public types', () => {
  it('主入口和 manager 子路径应导出 ChatThreadManager 与 ChatThread', () => {
    const manager = new ChatThreadManager();
    const subpathManager = new SubpathChatThreadManager();
    manager.bind(createMockClient());
    subpathManager.bind(createMockClient());

    const thread = manager.getChatThread('t1');
    const subpathThread = subpathManager.getChatThread('t2');

    expect(thread).toBeInstanceOf(ChatThread);
    expect(subpathThread).toBeInstanceOf(SubpathChatThread);
  });

  it('client.use(ChatThreadManager) 应暴露 chatThreadManager 入口', () => {
    const client = ChatClient.init({ appKey: 'org#app' }).use(ChatThreadManager);
    const thread = client.chatThreadManager.getChatThread('t1');

    expect(thread.chatThreadId).toBe('t1');
  });

  it('公开结果和实体方法类型应可从根入口使用', () => {
    const detail: ChatThreadDetail = {
      chatThreadId: 't1',
      parentId: 'g1',
      name: 'topic',
      messageId: 'm1',
    };
    const list: ChatThreadListResult = {
      items: [detail],
      cursor: '',
    };
    const member: ChatThreadMemberEntry = {
      memberId: 'bob',
    };
    const removeParams: RemoveChatThreadMemberParams = {
      chatThreadId: 't1',
      memberId: 'bob',
    };

    type GetInfoReturn = ReturnType<ChatThread['getInfo']>;
    type JoinReturn = ReturnType<ChatThread['join']>;
    const getInfoPromise: GetInfoReturn = Promise.resolve(detail);
    const joinPromise: JoinReturn = Promise.resolve();

    expect(list.items[0]?.messageId).toBe('m1');
    expect(member.memberId).toBe('bob');
    expect(removeParams.memberId).toBe('bob');
    expect(getInfoPromise).toBeInstanceOf(Promise);
    expect(joinPromise).toBeInstanceOf(Promise);
  });

  it('4 个公开 Thread 事件 handler 与 payload 类型应可用', () => {
    const created: ChatThreadCreatedEventPayload = {
      chatThreadId: 't1',
      parentId: 'g1',
      chatThreadName: 'topic',
      messageId: 'm1',
      timestamp: 1,
    };
    const destroyed: ChatThreadDestroyedEventPayload = {
      chatThreadId: 't1',
      parentId: 'g1',
      timestamp: 2,
    };
    const updated: ChatThreadUpdatedEventPayload = {
      chatThreadId: 't1',
      parentId: 'g1',
      chatThreadName: 'topic2',
      messageCount: 3,
      timestamp: 3,
    };
    const removed: ChatThreadUserRemovedEventPayload = {
      chatThreadId: 't1',
      parentId: 'g1',
      memberId: 'alice',
      timestamp: 4,
    };
    const handlers: ChatThreadEventHandlerMap = {
      onChatThreadCreated: payload => {
        expect(payload.chatThreadId).toBe('t1');
      },
      onChatThreadDestroyed: payload => {
        expect(payload.parentId).toBe('g1');
      },
      onChatThreadUpdated: payload => {
        expect(payload.messageCount).toBe(3);
      },
      onChatThreadUserRemoved: payload => {
        expect(payload.memberId).toBe('alice');
      },
    };

    void handlers.onChatThreadCreated?.(created);
    void handlers.onChatThreadDestroyed?.(destroyed);
    void handlers.onChatThreadUpdated?.(updated);
    void handlers.onChatThreadUserRemoved?.(removed);

    const legacyHandlers: ChatThreadEventHandlerMap = {
      // @ts-expect-error onChatThreadChange 不再是公开 Thread 事件
      onChatThreadChange: () => undefined,
    };
    expect(legacyHandlers).toBeDefined();
  });
});
