import { describe, expect, it, vi } from 'vitest';

import { ChatClient, ChatThreadManager } from '@/index';
import { RestClient } from '@/rest/client';

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

describe('chat-thread docs examples', () => {
  it('docs/integration/thread.md 的 manager 与 entity 示例应保持类型可用', async () => {
    resetSingleton();
    const client = ChatClient.init({
      appKey: 'org#app',
    }).use(ChatThreadManager);
    (
      client as unknown as {
        restBaseUrl: string | null;
        authToken: string | null;
        currentUserId: string | null;
        clientResource: string | null;
      }
    ).restBaseUrl = 'https://api.example.com';
    (
      client as unknown as {
        restBaseUrl: string | null;
        authToken: string | null;
        currentUserId: string | null;
        clientResource: string | null;
      }
    ).authToken = 'token';
    (
      client as unknown as {
        restBaseUrl: string | null;
        authToken: string | null;
        currentUserId: string | null;
        clientResource: string | null;
      }
    ).currentUserId = 'alice';
    (
      client as unknown as {
        restBaseUrl: string | null;
        authToken: string | null;
        currentUserId: string | null;
        clientResource: string | null;
      }
    ).clientResource = 'web';

    client.chatThreadManager.addEventHandler('thread-ui', {
      onChatThreadCreated: event => {
        expect(event.chatThreadId).toBe('thread-1');
        expect(event.parentId).toBe('group-1');
      },
      onChatThreadDestroyed: event => {
        expect(event.chatThreadId).toBe('thread-1');
      },
      onChatThreadUpdated: event => {
        expect(event.chatThreadName).toBe('new topic');
      },
      onChatThreadUserRemoved: event => {
        expect(event.memberId).toBe('alice');
      },
    });

    vi.spyOn(RestClient.prototype, 'post').mockResolvedValueOnce({
      data: {
        thread_id: 'thread-1',
      },
    });
    vi.spyOn(RestClient.prototype, 'get').mockImplementation(
      async (endpoint: string): Promise<unknown> => {
        if (endpoint.includes('/users?')) {
          return {
            entities: [{ user: 'alice' }],
            cursor: '',
          };
        }
        return {
          data: {
            thread_id: 'thread-1',
            group_id: 'group-1',
            name: 'topic',
          },
        };
      }
    );
    vi.spyOn(RestClient.prototype, 'put').mockResolvedValue({});
    vi.spyOn(RestClient.prototype, 'delete').mockResolvedValue({});

    const created = await client.chatThreadManager.createChatThread({
      parentId: 'group-1',
      name: 'topic',
      messageId: 'msg-1',
    });
    const detail = await client.chatThreadManager.getChatThreadInfo({
      chatThreadId: created.chatThreadId,
    });
    const thread = client.chatThreadManager.getChatThread('thread-1');
    const info = await thread.getInfo();
    const refreshed = await thread.refresh();
    await thread.updateName({ name: 'new topic' });
    const members = await thread.getMemberList({ pageSize: 20, cursor: '' });

    expect(created.chatThreadId).toBe('thread-1');
    expect(detail.parentId).toBe('group-1');
    expect(info.chatThreadId).toBe('thread-1');
    expect(refreshed.chatThreadId).toBe('thread-1');
    expect(members.items[0]?.memberId).toBe('alice');
  });

  it('docs/integration/thread.md 不应回退到旧 onChatThreadChange 示例类型', () => {
    const client = ChatClient.init({ appKey: 'org#app' }).use(ChatThreadManager);

    client.chatThreadManager.addEventHandler('thread-negative-doc-example', {
      // @ts-expect-error 文档不得再使用旧聚合事件
      onChatThreadChange: () => undefined,
    });

    expect(client.chatThreadManager).toBeInstanceOf(ChatThreadManager);
  });
});
