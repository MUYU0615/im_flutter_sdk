import { describe, it, expect, vi } from 'vitest';
import { requestSearchMessages } from '@/rest/chat-management';
import type { RestContext } from '@/types/chat-client';

const DEFAULT_CONTEXT: RestContext = {
  restBaseUrl: 'https://api.example.com',
  appKey: 'org#app',
  userId: 'currentUser',
  token: 'token-1',
  clientResource: 'web',
};

const createRestClient = () => ({
  post: vi.fn((): Promise<unknown> => Promise.resolve({ data: { items: [], pagination: { pageNum: 1, pageSize: 20, totalPages: 0, isFinished: 1 } } })),
  get: vi.fn((): Promise<unknown> => Promise.resolve(undefined)),
  put: vi.fn((): Promise<unknown> => Promise.resolve(undefined)),
  delete: vi.fn((): Promise<unknown> => Promise.resolve(undefined)),
  request: vi.fn((): Promise<unknown> => Promise.resolve(undefined)),
});

describe('requestSearchMessages - conversationType mapping', () => {
  it('singleChat 映射为 participantPairs', async () => {
    const client = createRestClient();
    await requestSearchMessages(client, DEFAULT_CONTEXT, {
      option: { keywordList: ['hello'], conversationId: 'user1', conversationType: 'singleChat' },
    });
    const body = client.post.mock.calls[0][1] as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data.participantPairs).toEqual([{ userId1: 'currentUser', userId2: 'user1' }]);
    expect(data.groupIds).toBeUndefined();
    expect(data.chatroomIds).toBeUndefined();
  });

  it('groupChat 映射为 groupIds', async () => {
    const client = createRestClient();
    await requestSearchMessages(client, DEFAULT_CONTEXT, {
      option: { keywordList: ['hello'], conversationId: 'group1', conversationType: 'groupChat' },
    });
    const body = client.post.mock.calls[0][1] as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data.groupIds).toEqual(['group1']);
    expect(data.participantPairs).toBeUndefined();
    expect(data.chatroomIds).toBeUndefined();
  });

  it('chatRoom 映射为 chatroomIds', async () => {
    const client = createRestClient();
    await requestSearchMessages(client, DEFAULT_CONTEXT, {
      option: { keywordList: ['hello'], conversationId: 'room1', conversationType: 'chatRoom' },
    });
    const body = client.post.mock.calls[0][1] as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data.chatroomIds).toEqual(['room1']);
    expect(data.participantPairs).toBeUndefined();
    expect(data.groupIds).toBeUndefined();
  });

  it('不传 conversationType 时不生成 participantPairs/groupIds/chatroomIds', async () => {
    const client = createRestClient();
    await requestSearchMessages(client, DEFAULT_CONTEXT, {
      option: { keywordList: ['hello'] },
    });
    const body = client.post.mock.calls[0][1] as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data.participantPairs).toBeUndefined();
    expect(data.groupIds).toBeUndefined();
    expect(data.chatroomIds).toBeUndefined();
  });
});
