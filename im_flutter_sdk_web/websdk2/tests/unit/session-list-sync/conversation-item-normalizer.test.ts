import { describe, expect, it } from 'vitest';

import type { ConversationSummary } from '@/cache/cache-types';
import type { ChatClient } from '@/chat-client';
import { normalizeConversationSummaryToConversationItem } from '@/core/session-list-sync/session-list-sync-normalizer';

const buildConversation = (overrides?: Partial<ConversationSummary>): ConversationSummary => {
  return {
    conversationId: 'u1',
    type: 'singleChat',
    lastMessage: {
      msgId: 'm1',
      type: 'text',
      body: { content: 'hello' },
      timestamp: 10,
    },
    unreadCount: 1,
    marks: [],
    lastAccess: 5,
    lastUpdate: 10,
    ...overrides,
  };
};

describe('conversation item normalizer', () => {
  it('should prefer contact remark for single chat display', async (): Promise<void> => {
    const client = {
      getContactSnapshot: () => ({
        items: [
          {
            userId: 'u1',
            remark: '备注名',
            addTs: 1,
            userInfo: {
              userId: 'u1',
              nickname: '昵称',
              avatarUrl: 'https://cdn.example.com/u1.png',
            },
          },
        ],
        source: 'cache',
        version: 'v1',
        complete: true,
      }),
      getCacheManager: () => ({
        getRuntimeUserInfo: () => null,
        getUserInfoSummaries: () => [],
      }),
      getCurrentUserId: () => 'self',
    } as unknown as ChatClient;

    const item = await normalizeConversationSummaryToConversationItem(buildConversation(), client);
    expect(item).toMatchObject({
      conversationId: 'u1',
      conversationType: 'singleChat',
      conversationName: '备注名',
      conversationAvatar: 'https://cdn.example.com/u1.png',
      lastMessage: {
        msgServerId: 'm1',
        from: 'u1',
        to: 'self',
        sender: { userId: 'u1' },
        body: { content: 'hello' },
      },
    });
    expect(item.lastMessage?.body).not.toHaveProperty('type');
  });

  it('should preserve last message profile version fields', async (): Promise<void> => {
    const client = {
      getContactSnapshot: () => null,
      getCacheManager: () => ({
        getRuntimeUserInfo: () => null,
        getUserInfoSummaries: () => [],
      }),
      getCurrentUserId: () => 'self',
    } as unknown as ChatClient;

    const item = await normalizeConversationSummaryToConversationItem(
      buildConversation({
        lastMessage: {
          msgId: 'm-profile',
          type: 'text',
          body: { content: 'profile' },
          timestamp: 10,
          userInfoUpdateTime: 1776825600,
          namecardUpdateTime: 1776825601,
        },
      }),
      client
    );

    expect(item.lastMessage).toMatchObject({
      userInfoUpdateTime: 1776825600,
      namecardUpdateTime: 1776825601,
    });
  });

  it('should fallback to cached user nickname when contact remark is missing', async (): Promise<void> => {
    const client = {
      getContactSnapshot: () => ({
        items: [],
        source: 'cache',
        version: 'v1',
        complete: true,
      }),
      getCacheManager: () => ({
        getRuntimeUserInfo: () => null,
        getUserInfoSummaries: () => [
          {
            userId: 'u1',
            nickname: '缓存昵称',
            avatarUrl: 'https://cdn.example.com/u1-cache.png',
            sign: '',
            ext: '',
            lastAccess: 0,
            lastUpdate: 0,
          },
        ],
      }),
    } as unknown as ChatClient;

    const item = await normalizeConversationSummaryToConversationItem(buildConversation(), client);
    expect(item).toMatchObject({
      conversationName: '缓存昵称',
      conversationAvatar: 'https://cdn.example.com/u1-cache.png',
    });
  });

  it('should prefer contact nickname over fallback session id for single chat display', async (): Promise<void> => {
    const client = {
      getContactSnapshot: () => ({
        items: [
          {
            userId: 'u1',
            remark: '',
            addTs: 1,
            userInfo: {
              userId: 'u1',
              nickname: '联系人昵称',
              avatarUrl: 'https://cdn.example.com/u1-contact.png',
            },
          },
        ],
        source: 'cache',
        version: 'v1',
        complete: true,
      }),
      getCacheManager: () => ({
        getRuntimeUserInfo: () => null,
        getUserInfoSummaries: () => [],
      }),
    } as unknown as ChatClient;

    const item = await normalizeConversationSummaryToConversationItem(buildConversation(), client);
    expect(item).toMatchObject({
      conversationName: '联系人昵称',
      conversationAvatar: 'https://cdn.example.com/u1-contact.png',
    });
  });

  it('should use group snapshot when group detail is available', async (): Promise<void> => {
    const client = {
      getContactSnapshot: () => null,
      getCacheManager: () => ({
        getRuntimeUserInfo: () => null,
        getUserInfoSummaries: () => [],
      }),
      groupManager: {
        getGroupInfo: async () => ({
          name: '群名称',
          avatarUrl: 'https://cdn.example.com/g1.png',
        }),
      },
    } as unknown as ChatClient;

    const item = await normalizeConversationSummaryToConversationItem(
      buildConversation({
        conversationId: 'g1',
        type: 'groupChat',
      }),
      client
    );

    expect(item).toMatchObject({
      conversationId: 'g1',
      conversationType: 'groupChat',
      conversationName: '群名称',
      conversationAvatar: 'https://cdn.example.com/g1.png',
    });
  });

  it('should fallback to session id when no display info is available', async (): Promise<void> => {
    const client = {
      getContactSnapshot: () => null,
      getCacheManager: () => ({
        getRuntimeUserInfo: () => null,
        getUserInfoSummaries: () => [],
      }),
    } as unknown as ChatClient;

    const item = await normalizeConversationSummaryToConversationItem(buildConversation(), client);
    expect(item).toMatchObject({
      conversationName: 'u1',
      conversationAvatar: undefined,
    });
  });
});
