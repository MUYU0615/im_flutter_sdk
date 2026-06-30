import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Root, configure, util, type INamespace } from 'protobufjs/light';
import Long from 'long';

import { ChatClient } from '@/chat-client';
import { ConnectionManager } from '@/core/connection/connection-manager';
import { GroupManager } from '@/managers/group-manager';
import { JoinedGroupsCodec } from '@/protocol/joined-groups/codec';
import joinedGroupsProtoJson from '@/protocol/joined-groups/proto';
import { JoinedGroupsMessageType } from '@/protocol/joined-groups/types';
import type { JoinedGroupsRequest } from '@/protocol/joined-groups/types';
import { SessionListCodec } from '@/protocol/session-list/codec';
import sessionListProtoJson from '@/protocol/session-list/proto';
import { SessionListMessageType } from '@/protocol/session-list/types';
import type { SessionListRequest } from '@/protocol/session-list/types';
import { ERROR_CODES } from '@/utils/error-codes';
import { buildProvisionResponse } from '../../test-utils/msync';
import type { SyncDataFinishedPayload } from '@/types/sync-data';

const APP_KEY = 'org#app';
const USER_ID = 'user-1';

util.Long = Long;
configure();

const sessionListRoot = Root.fromJSON(sessionListProtoJson as INamespace);
const sessionListResponseType = sessionListRoot.lookupType(
  'easemob.sessionlist.GetSessionListResponse'
);
const joinedGroupsRoot = Root.fromJSON(joinedGroupsProtoJson as INamespace);
const joinedGroupsResponseType = joinedGroupsRoot.lookupType(
  'easemob.joinedgroups.GetJoinedGroupsResponse'
);
const joinedGroupsErrorType = joinedGroupsRoot.lookupType('easemob.joinedgroups.ErrorDetail');

type GroupClient = ChatClient & {
  readonly groupManager: GroupManager;
};

const toArrayBuffer = (payload: Uint8Array): ArrayBuffer => {
  return payload.buffer.slice(
    payload.byteOffset,
    payload.byteOffset + payload.byteLength
  ) as ArrayBuffer;
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

const getRequestUrl = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
};

const buildSessionListResponseFrame = (requestId: string): ArrayBuffer => {
  return toArrayBuffer(
    sessionListResponseType
      .encode(
        sessionListResponseType.create({
          type: SessionListMessageType.GET_SESSION_LIST_RESPONSE,
          header: {
            resource: 'web',
            timestamp: Date.now(),
            request_id: requestId,
            protocol_version: 1,
          },
          sessions: [],
          is_last_batch: true,
          last_sync_finished_ts: 0,
        })
      )
      .finish()
  );
};

const buildJoinedGroupsResponseFrame = (requestId: string): ArrayBuffer => {
  return toArrayBuffer(
    joinedGroupsResponseType
      .encode(
        joinedGroupsResponseType.create({
          type: JoinedGroupsMessageType.GET_JOINED_GROUPS_RESPONSE,
          header: {
            resource: 'web',
            timestamp: Date.now(),
            request_id: requestId,
            protocol_version: 1,
          },
          groups: [
            {
              group_id: 'g1',
              group_name: 'Group 1',
              group_owner: 'owner',
              members_count: 12,
              mute_all: false,
              disabled: false,
              description: 'desc',
              group_avatar: 'https://cdn.example.com/g1.png',
              role: 2,
              mute_expiration: 0,
              remind_type: 1,
              create_at: 100,
              update_at: 200,
              joined_timestamp: 300,
            },
          ],
          is_last_batch: true,
          last_sync_finished_ts: 400,
        })
      )
      .finish()
  );
};

const buildJoinedGroupsErrorFrame = (requestId: string): ArrayBuffer => {
  return toArrayBuffer(
    joinedGroupsErrorType
      .encode(
        joinedGroupsErrorType.create({
          type: JoinedGroupsMessageType.ERROR,
          header: {
            resource: 'web',
            timestamp: Date.now(),
            request_id: requestId,
            protocol_version: 1,
          },
          code: 1003,
          message: 'rate limited',
        })
      )
      .finish()
  );
};

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

const isSessionListRequest = (value: { readonly type: number }): value is SessionListRequest => {
  return value.type === SessionListMessageType.GET_SESSION_LIST_REQUEST;
};

const isJoinedGroupsRequest = (value: { readonly type: number }): value is JoinedGroupsRequest => {
  return value.type === JoinedGroupsMessageType.GET_JOINED_GROUPS_REQUEST;
};

const decodeSessionListRequest = (
  payload: ArrayBuffer | ArrayBufferView
): { readonly requestId: string } | null => {
  const bytes =
    payload instanceof ArrayBuffer
      ? new Uint8Array(payload)
      : new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength);
  const decoded = new SessionListCodec().decode(bytes);
  if (!isSessionListRequest(decoded)) {
    return null;
  }
  return {
    requestId: decoded.header?.requestId ?? '',
  };
};

class GroupSyncWebSocket {
  public static readonly CONNECTING = 0;
  public static readonly OPEN = 1;
  public static readonly CLOSING = 2;
  public static readonly CLOSED = 3;
  public static groupMode: 'success' | 'error' = 'success';
  public static groupRequests: Array<{
    readonly url: string;
    readonly requestId: string;
    readonly lastSyncTime?: number;
    readonly cursor?: string;
    readonly username: string;
  }> = [];
  public static beforeGroupResponse: (() => void) | null = null;

  public readyState = GroupSyncWebSocket.CONNECTING;
  public binaryType = 'arraybuffer';
  public onopen: ((event: Event) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  private readonly listeners = new Map<string, Set<(event: Event) => void>>();
  private provisionHandled = false;

  public constructor(public readonly url: string) {
    queueMicrotask(() => {
      this.readyState = GroupSyncWebSocket.OPEN;
      this.emit('open', new Event('open'));
      if (!this.isSyncSocket()) {
        this.emit('message', {
          data: buildProvisionResponse(),
        } as MessageEvent as unknown as Event);
      }
    });
  }

  public send(data: unknown): void {
    if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
      const decoded = new JoinedGroupsCodec().decode(
        data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      );
      if (isJoinedGroupsRequest(decoded)) {
        const requestId = decoded.header?.requestId ?? '';
        GroupSyncWebSocket.groupRequests.push({
          url: this.url,
          requestId,
          lastSyncTime: decoded.lastSyncTime,
          cursor: decoded.cursor,
          username: decoded.username,
        });
        queueMicrotask(() => {
          GroupSyncWebSocket.beforeGroupResponse?.();
          this.emit('message', {
            data:
              GroupSyncWebSocket.groupMode === 'error'
                ? buildJoinedGroupsErrorFrame(requestId)
                : buildJoinedGroupsResponseFrame(requestId),
          } as MessageEvent as unknown as Event);
        });
        return;
      }

      const sessionListRequest = decodeSessionListRequest(data);
      if (sessionListRequest) {
        queueMicrotask(() => {
          this.emit('message', {
            data: buildSessionListResponseFrame(sessionListRequest.requestId),
          } as MessageEvent as unknown as Event);
        });
        return;
      }
    }

    if (this.provisionHandled) {
      return;
    }
    this.provisionHandled = true;
    this.emit('message', { data: buildProvisionResponse() } as MessageEvent as unknown as Event);
  }

  public close(code?: number, reason?: string): void {
    this.readyState = GroupSyncWebSocket.CLOSED;
    this.emit('close', new CloseEvent('close', { code: code ?? 1000, reason: reason ?? '' }));
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

  private isSyncSocket(): boolean {
    try {
      return new URL(this.url).host.startsWith('sync');
    } catch {
      return false;
    }
  }
}

const createFetchMock = (): typeof fetch => {
  return vi.fn((input: RequestInfo | URL) => {
    const url = getRequestUrl(input);
    if (url.includes('/easemob/server.json')) {
      return Promise.resolve(
        createJsonResponse({
          rest: { hosts: [{ protocol: 'http', domain: 'rest.example.com', port: 80 }] },
          'msync-wx': { hosts: [{ protocol: 'http', domain: 'msync.example.com', port: 80 }] },
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
};

const createClient = (): GroupClient => {
  return ChatClient.init({
    appKey: APP_KEY,
    enableSyncData: ['group'],
    managers: [GroupManager] as const,
  }) as GroupClient;
};

describe('group auto sync integration', () => {
  const originalWebSocket = globalThis.WebSocket;
  const originalFetch = globalThis.fetch;

  beforeEach((): void => {
    resetSingleton();
    localStorage.clear();
    GroupSyncWebSocket.groupMode = 'success';
    GroupSyncWebSocket.groupRequests = [];
    GroupSyncWebSocket.beforeGroupResponse = null;
    globalThis.WebSocket = GroupSyncWebSocket as unknown as typeof WebSocket;
    globalThis.fetch = createFetchMock();
    vi.spyOn(
      ConnectionManager.prototype as unknown as { startProvision: () => Promise<void> },
      'startProvision'
    ).mockResolvedValue(undefined);
  });

  afterEach((): void => {
    globalThis.WebSocket = originalWebSocket;
    globalThis.fetch = originalFetch;
    GroupSyncWebSocket.groupRequests = [];
    GroupSyncWebSocket.beforeGroupResponse = null;
    vi.restoreAllMocks();
  });

  it('enableSyncData 包含 group 时登录后应发起全量 joined-groups 同步并写入本地快照', async () => {
    const client = createClient();
    const conversationUpdated = new Promise<unknown>(resolve => {
      client.addEventHandler('group-session-display', {
        onConversationListUpdate: payload => {
          const groupSession = payload.items.find(item => item.conversationId === 'g1');
          if (groupSession?.conversationName === 'Group 1') {
            resolve(payload);
          }
        },
      });
    });
    const groupFinished = new Promise<SyncDataFinishedPayload>(resolve => {
      client.addEventHandler('group-sync-success', {
        onSyncDataFinished: payload => {
          if (payload.dataType === 'group') {
            resolve(payload);
          }
        },
      });
    });

    GroupSyncWebSocket.beforeGroupResponse = (): void => {
      client.getCacheManager()?.replaceSessionList([
        {
          conversationId: 'g1',
          conversationType: 'groupChat',
          unreadCount: 0,
          lastMessage: null,
          lastMessageAt: 100,
          marks: [],
          remindType: 'NONE',
          conversationName: 'Old Group',
          conversationAvatar: 'https://cdn.example.com/old.png',
        },
      ]);
    };

    await client.login({
      userId: USER_ID,
      token: 'token-1',
    });
    const payload = await groupFinished;
    await conversationUpdated;

    expect(GroupSyncWebSocket.groupRequests).toHaveLength(1);
    expect(GroupSyncWebSocket.groupRequests[0]).toMatchObject({
      url: 'wss://sync.example.com/ws?token=token-1',
      lastSyncTime: 0,
      cursor: undefined,
      username: USER_ID,
    });
    expect(payload).toMatchObject({
      dataType: 'group',
      status: 'success',
    });
    expect(payload).not.toHaveProperty('finishedAt');
    expect(payload).not.toHaveProperty('meta');
    expect(payload.status).not.toBe('limited');
    expect(payload.status).not.toBe('cancelled');
    expect(client.groupManager.getJoinedGroupList()).toMatchObject([
      {
        groupId: 'g1',
        name: 'Group 1',
        role: 'member',
        updatedAt: 200,
        joinedAt: 300,
      },
    ]);
    expect(client.groupManager.getJoinedGroupSnapshotForSync().meta).toMatchObject({
      integrity: 'synced',
      source: 'sync',
      lastSyncFinishedTs: 400,
    });
    expect(client.getCacheManager()?.loadSessionList()).toEqual([
      expect.objectContaining({
        conversationId: 'g1',
        conversationType: 'groupChat',
        conversationName: 'Group 1',
        conversationAvatar: 'https://cdn.example.com/g1.png',
        remindType: 'ALL',
      }),
    ]);
  });

  it('服务端 ErrorDetail 不应阻塞登录主链路，并应派发 group 失败事件', async () => {
    GroupSyncWebSocket.groupMode = 'error';
    const client = createClient();
    const groupFinished = new Promise<SyncDataFinishedPayload>(resolve => {
      client.addEventHandler('group-sync-error', {
        onSyncDataFinished: payload => {
          if (payload.dataType === 'group') {
            resolve(payload);
          }
        },
      });
    });

    await client.login({
      userId: USER_ID,
      token: 'token-1',
    });
    const payload = await groupFinished;

    expect(client.getConnectionState()).toBe('connected');
    expect(payload).toMatchObject({
      dataType: 'group',
      status: 'failed',
      error: {
        code: ERROR_CODES.SERVICE_LIMIT_EXCEEDED,
        stage: 'server_limit',
        serverCode: 1003,
        retryable: true,
      },
    });
  });
});
