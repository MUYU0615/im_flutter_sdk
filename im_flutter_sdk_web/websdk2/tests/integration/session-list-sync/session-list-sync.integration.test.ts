import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatClient } from '@/chat-client';
import { ChatManager } from '@/managers/chat-manager';
import { ContactManager } from '@/managers/contact';
import { UserInfoManager } from '@/managers/user-info';
import { ConnectionManager } from '@/core/connection/connection-manager';
import { CacheKeyName, buildCacheKey } from '@/cache/cache-keys';
import { CACHE_SCHEMA_VERSION } from '@/config/cache';
import * as sessionListRunner from '@/core/session-list-sync/session-list-sync-runner';
import { buildProvisionResponse } from '../../test-utils/msync';

const APP_KEY = 'org#app';
const USER_ID = 'user-1';

type TestClient = ChatClient & {
  readonly chatManager: ChatManager;
  readonly contactManager: ContactManager;
};

class MockWebSocket {
  public static readonly CONNECTING = 0;
  public static readonly OPEN = 1;
  public static readonly CLOSED = 3;
  public readyState = MockWebSocket.CONNECTING;
  public binaryType = 'arraybuffer';
  public onopen: ((event: Event) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  private readonly listeners = new Map<string, Set<(event: Event) => void>>();
  private provisionHandled = false;

  public constructor(public readonly url: string) {
    queueMicrotask(() => {
      this.readyState = MockWebSocket.OPEN;
      this.emit('open', new Event('open'));
    });
  }

  public send(_data: unknown): void {
    if (this.provisionHandled) {
      return;
    }
    this.provisionHandled = true;
    this.emit('message', {
      data: buildProvisionResponse(),
    } as MessageEvent as unknown as Event);
  }

  public close(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.emit('close', new CloseEvent('close'));
  }

  public addEventListener(type: string, listener: (event: Event) => void): void {
    const set = this.listeners.get(type) ?? new Set<(event: Event) => void>();
    set.add(listener);
    this.listeners.set(type, set);
  }

  public removeEventListener(type: string, listener: (event: Event) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  private emit(type: string, event: Event): void {
    if (type === 'open') {
      this.onopen?.(event);
    }
    if (type === 'close') {
      this.onclose?.(event as CloseEvent);
    }
    if (type === 'error') {
      this.onerror?.(event);
    }
    if (type === 'message') {
      this.onmessage?.(event as MessageEvent);
    }
    this.listeners.get(type)?.forEach(listener => listener(event));
  }
}

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

const createClient = (): TestClient => {
  return ChatClient.init({
    appKey: APP_KEY,
    enableSyncData: ['conversation', 'contact'],
    managers: [ChatManager, ContactManager, UserInfoManager] as const,
  }) as TestClient;
};

const createJsonResponse = (data: unknown): Response => {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: {
      get: (): string => 'application/json',
    },
    json: (): Promise<unknown> => Promise.resolve(data),
    text: (): Promise<string> => Promise.resolve(JSON.stringify(data)),
  } as unknown as Response;
};

const writeJsonCache = (key: string, value: unknown): void => {
  localStorage.setItem(key, JSON.stringify(value));
};

describe('session-list sync integration', () => {
  const originalWebSocket = globalThis.WebSocket;
  const originalFetch = globalThis.fetch;

  beforeEach((): void => {
    resetSingleton();
    localStorage.clear();
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/easemob/server.json')) {
        return Promise.resolve(
          createJsonResponse({
            rest: { hosts: [{ protocol: 'https', domain: 'rest.example.com', port: 443 }] },
            'msync-wx': { hosts: [{ protocol: 'https', domain: 'msync.example.com', port: 443 }] },
            'sync-ws': { hosts: [{ protocol: 'https', domain: 'sync.example.com', port: 443 }] },
          })
        );
      }
      if (url.includes('/conversations/users/')) {
        return Promise.resolve(
          createJsonResponse({
            cursor: '',
            count: 0,
            conversations: [],
          })
        );
      }
      return Promise.resolve(createJsonResponse({}));
    }) as unknown as typeof fetch;
    vi.spyOn(
      ConnectionManager.prototype as unknown as { startProvision: () => Promise<void> },
      'startProvision'
    ).mockResolvedValue(undefined);
  });

  afterEach((): void => {
    globalThis.WebSocket = originalWebSocket;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('登录后应先完成 session-list sync，再继续 contact sync', async () => {
    const client = createClient();
    const order: string[] = [];

    vi.spyOn(sessionListRunner, 'runSessionListSync').mockImplementation(async () => {
      order.push('session-list:request');
      return {
        items: [
          {
            conversationId: 'peer-1',
            conversationType: 'singleChat',
            unreadCount: 1,
            lastMessage: {
              msgServerId: 'msg-1',
              from: 'peer-1',
              to: USER_ID,
              sender: { userId: 'peer-1' },
              timestamp: 100,
              body: { content: 'hello' },
            },
            lastMessageAt: 100,
            marks: [],
            remindType: 'DEFAULT',
            conversationName: 'peer-1',
          },
        ],
        lastSyncFinishedTs: 100,
      };
    });
    vi.spyOn(client, 'refreshContactSnapshot').mockImplementation(async () => {
      order.push('contact-sync:start');
    });

    client.chatManager.addEventHandler('session-list-order', {
      onSyncDataStart: payload => {
        if (payload.dataType === 'conversation') {
          expect(payload).toEqual({ dataType: 'conversation' });
          expect(payload).not.toHaveProperty('startedAt');
          order.push('session-list:start');
        }
      },
      onSyncDataFinished: payload => {
        if (payload.dataType === 'conversation') {
          expect(payload).toEqual({ dataType: 'conversation', status: 'success' });
          expect(payload).not.toHaveProperty('finishedAt');
          expect(payload).not.toHaveProperty('meta');
          order.push('session-list:finish');
        }
      },
    });

    await client.login({
      userId: USER_ID,
      token: 'token-1',
    });

    expect(order).toEqual([
      'session-list:start',
      'session-list:request',
      'session-list:finish',
      'contact-sync:start',
    ]);
  });

  it('空快照/无变化时也应形成 start -> finish 闭环且不清空本地列表', async () => {
    const client = createClient();
    const events: string[] = [];

    const existing = {
      conversationId: 'peer-cache',
      conversationType: 'singleChat' as const,
      unreadCount: 9,
      lastMessage: {
        msgServerId: 'cache-msg',
        from: 'peer-cache',
        to: USER_ID,
        sender: { userId: 'peer-cache' },
        timestamp: 99,
        body: { content: 'cached' },
      },
      lastMessageAt: 99,
      marks: [],
      remindType: 'DEFAULT' as const,
      conversationName: 'peer-cache',
    };
    const context = {
      appKey: APP_KEY,
      userId: USER_ID,
      schemaVersion: CACHE_SCHEMA_VERSION,
    };
    writeJsonCache(buildCacheKey(context, CacheKeyName.SESSION_LIST), {
      items: [
        {
          ...existing,
          updatedAt: 99,
        },
      ],
      checkpoint: {
        lastSyncTime: 1,
        lastSyncFinishedTs: 1,
        sessionsLastSyncTs: 1,
        lastSuccessfulAt: 1,
      },
    });

    vi.spyOn(sessionListRunner, 'runSessionListSync').mockResolvedValue({
      items: [],
      lastSyncFinishedTs: 1,
    });
    vi.spyOn(client, 'refreshContactSnapshot').mockResolvedValue(undefined);

    client.chatManager.addEventHandler('session-list-empty', {
      onSyncDataStart: payload => {
        if (payload.dataType === 'conversation') {
          events.push('start');
        }
      },
      onSyncDataFinished: payload => {
        if (payload.dataType === 'conversation') {
          events.push('finish');
        }
      },
    });

    await client.login({
      userId: USER_ID,
      token: 'token-1',
    });

    expect(events).toEqual(['start', 'finish']);
    expect(client.chatManager.getConversationList()).toEqual([existing]);
  });
});
