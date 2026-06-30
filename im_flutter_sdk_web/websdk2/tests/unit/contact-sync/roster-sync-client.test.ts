import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RosterSyncClient } from '@/core/contact-sync/roster-sync-client';
import { SharedSyncWebSocketSession } from '@/core/sync/shared-sync-websocket-session';
import { getRosterRoot } from '@/protocol/roster/root';
import { RosterMessageType, RosterResponseType } from '@/protocol/roster/types';
import type { RosterRequest } from '@/protocol/roster/types';
import { ERROR_CODES } from '@/utils/error-codes';
import { SDKError } from '@/utils/errors';
import {
  buildRosterErrorFrame,
  buildRosterPingFrame,
  buildRosterResponseFrame,
  buildRosterUnknownFrame,
  toArrayBuffer,
} from '../../test-utils/contact-sync/build-roster-frame';

type MockMode =
  | 'success'
  | 'blob_success'
  | 'server_error'
  | 'invalid_payload'
  | 'unknown_frame'
  | 'hang'
  | 'idle_timeout';

type MockSocketAction =
  | {
      readonly type: 'message';
      readonly data: ArrayBuffer | Blob;
    }
  | {
      readonly type: 'close';
      readonly code?: number;
      readonly reason?: string;
    };

type LongLike = {
  toNumber: () => number;
};

const isLongLike = (value: unknown): value is LongLike => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'toNumber' in value &&
    typeof (value as LongLike).toNumber === 'function'
  );
};

const decodeRosterRequest = (
  payload: ArrayBuffer | ArrayBufferView
): {
  readonly cursor: number;
  readonly requestId: string;
} => {
  const root = getRosterRoot();
  const type = root.lookupType('easemob.imfusion.gateway.v1.GetRosterRequest');
  const decoded = type.decode(
    payload instanceof ArrayBuffer
      ? new Uint8Array(payload)
      : new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength)
  ) as unknown as Record<string, unknown>;
  const header = (decoded.header ?? {}) as Record<string, unknown>;
  const cursorValue = decoded.cursor;
  return {
    cursor: typeof cursorValue === 'number' ? cursorValue : isLongLike(cursorValue) ? cursorValue.toNumber() : 0,
    requestId: typeof header.requestId === 'string' ? header.requestId : '',
  };
};

class MockRosterWebSocket {
  public static readonly CONNECTING = 0;
  public static readonly OPEN = 1;
  public static readonly CLOSING = 2;
  public static readonly CLOSED = 3;
  public static readonly createdUrls: string[] = [];
  public static readonly requestRecords: Array<{
    readonly url: string;
    readonly cursor: number;
    readonly requestId: string;
  }> = [];
  public static failUrls = new Set<string>();
  public static scriptedActions = new Map<string, ReadonlyArray<MockSocketAction>>();
  public static mode: MockMode = 'success';
  public static rosterPayload = buildRosterResponseFrame({
    items: [],
    version: 'v1',
  });

  public readyState = MockRosterWebSocket.CONNECTING;
  public binaryType = 'arraybuffer';
  private readonly listeners = new Map<string, Set<(event: Event) => void>>();
  private hasResponded = false;

  public constructor(public readonly url: string) {
    MockRosterWebSocket.createdUrls.push(url);
    queueMicrotask(() => {
      if (MockRosterWebSocket.failUrls.has(url)) {
        this.emit('error', new Event('error'));
        this.close(1006, 'connect-failed');
        return;
      }
      this.readyState = MockRosterWebSocket.OPEN;
      this.emit('open', new Event('open'));
    });
  }

  public send(data: unknown): void {
    if (!(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data)) {
      return;
    }
    const request = decodeRosterRequest(data);
    MockRosterWebSocket.requestRecords.push({
      url: this.url,
      cursor: request.cursor,
      requestId: request.requestId,
    });
    if (MockRosterWebSocket.mode === 'hang' || MockRosterWebSocket.mode === 'idle_timeout') {
      return;
    }
    if (this.hasResponded) {
      return;
    }
    this.hasResponded = true;
    const scriptedActions = MockRosterWebSocket.scriptedActions.get(this.url);
    if (scriptedActions) {
      queueMicrotask(() => {
        scriptedActions.forEach(action => {
          if (action.type === 'message') {
            this.emit('message', {
              data: action.data,
            } as MessageEvent as unknown as Event);
            return;
          }
          this.close(action.code, action.reason);
        });
      });
      return;
    }
    queueMicrotask(() => {
      if (MockRosterWebSocket.mode === 'server_error') {
        this.emit('message', {
          data: toArrayBuffer(
            buildRosterErrorFrame({
              code: '1102',
              message: 'server busy',
            })
          ),
        } as MessageEvent as unknown as Event);
        return;
      }
      if (MockRosterWebSocket.mode === 'invalid_payload') {
        this.emit('message', {
          data: { invalid: true },
        } as MessageEvent as unknown as Event);
        return;
      }
      if (MockRosterWebSocket.mode === 'unknown_frame') {
        this.emit('message', {
          data: toArrayBuffer(buildRosterUnknownFrame(99)),
        } as MessageEvent as unknown as Event);
        return;
      }
      this.emit('message', {
        data: toArrayBuffer(buildRosterPingFrame()),
      } as MessageEvent as unknown as Event);
      this.emit('message', {
        data:
          MockRosterWebSocket.mode === 'blob_success'
            ? new Blob([toArrayBuffer(MockRosterWebSocket.rosterPayload)])
            : toArrayBuffer(MockRosterWebSocket.rosterPayload),
      } as MessageEvent as unknown as Event);
    });
  }

  public close(code?: number, reason?: string): void {
    this.readyState = MockRosterWebSocket.CLOSED;
    this.emit('close', new CloseEvent('close', { code: code ?? 1000, reason: reason ?? '' }));
  }

  public addEventListener(type: string, listener: (event: Event) => void): void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }

  public removeEventListener(type: string, listener: (event: Event) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  private emit(type: string, event: Event): void {
    this.listeners.get(type)?.forEach(listener => listener(event));
  }
}

const createRequest = (): RosterRequest => {
  return {
    type: RosterMessageType.REQUEST,
    header: {
      resource: 'resource',
      timestamp: 1,
      requestId: 'r1',
      protocolVersion: 1,
    },
    org: 'org',
    app: 'app',
    username: 'u1',
    version: 'v1',
    cursor: 0,
  };
};

const createClient = (urls: ReadonlyArray<string>): RosterSyncClient => {
  return new RosterSyncClient(
    new SharedSyncWebSocketSession({
      getUrls: () => Promise.resolve(urls),
    })
  );
};

const flushMicrotasks = async (count: number = 4): Promise<void> => {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve();
  }
};

describe('RosterSyncClient', () => {
  const originalWebSocket = globalThis.WebSocket;

  beforeEach((): void => {
    MockRosterWebSocket.mode = 'success';
    MockRosterWebSocket.scriptedActions.clear();
    MockRosterWebSocket.requestRecords.length = 0;
  });

  afterEach((): void => {
    globalThis.WebSocket = originalWebSocket;
    MockRosterWebSocket.createdUrls.length = 0;
    MockRosterWebSocket.failUrls.clear();
    MockRosterWebSocket.scriptedActions.clear();
    MockRosterWebSocket.requestRecords.length = 0;
    vi.useRealTimers();
  });

  it('应在首个 sync-ws 失败后切换到下一个地址', async () => {
    globalThis.WebSocket = MockRosterWebSocket as unknown as typeof WebSocket;
    MockRosterWebSocket.failUrls.add('wss://sync-a.example.com/ws');
    MockRosterWebSocket.rosterPayload = buildRosterResponseFrame({
      items: [
        {
          contact: 'u1',
          remark: 'r1',
          metadata: '{"nickname":"n1","avatarUrl":"a1","sign":"s1"}',
          createdAt: 1,
          updatedAt: 2,
          metadataUpdatedAt: 3,
        },
      ],
      version: 'v2',
      responseType: RosterResponseType.FULL,
    });

    const client = createClient(['wss://sync-a.example.com/ws', 'wss://sync-b.example.com/ws']);
    const result = await client.sync({
      urls: ['wss://sync-a.example.com/ws', 'wss://sync-b.example.com/ws'],
      request: createRequest(),
    });

    expect(MockRosterWebSocket.createdUrls).toEqual([
      'wss://sync-a.example.com/ws',
      'wss://sync-b.example.com/ws',
    ]);
    expect(result.mode).toBe('full');
    expect(result.version).toBe('v2');
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]?.data[0]?.contact).toBe('u1');
  });

  it('单轮地址耗尽后应再额外重试一轮', async () => {
    const createdUrls: string[] = [];
    const requestRecords: Array<{
      readonly url: string;
      readonly cursor: number;
      readonly requestId: string;
    }> = [];
    const responseFrame = toArrayBuffer(
      buildRosterResponseFrame({
        items: [
          {
            contact: 'u9',
            remark: 'r9',
            metadata: '{"nickname":"n9","avatarUrl":"a9","sign":"s9"}',
            createdAt: 9,
            updatedAt: 10,
            metadataUpdatedAt: 11,
          },
        ],
        version: 'v-retry',
        responseType: RosterResponseType.FULL,
      })
    );

    globalThis.WebSocket = class RoundRetryWebSocket {
      public static readonly CONNECTING = 0;
      public static readonly OPEN = 1;
      public static readonly CLOSING = 2;
      public static readonly CLOSED = 3;
      public readyState = RoundRetryWebSocket.CONNECTING;
      public binaryType = 'arraybuffer';
      private readonly listeners = new Map<string, Set<(event: Event) => void>>();

      public constructor(public readonly url: string) {
        createdUrls.push(url);
        queueMicrotask(() => {
          if (createdUrls.length < 3) {
            this.emit('error', new Event('error'));
            this.close(1006, 'connect-failed');
            return;
          }
          this.readyState = RoundRetryWebSocket.OPEN;
          this.emit('open', new Event('open'));
        });
      }

      public send(data: unknown): void {
        if (!(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data)) {
          return;
        }
        const request = decodeRosterRequest(data);
        requestRecords.push({
          url: this.url,
          cursor: request.cursor,
          requestId: request.requestId,
        });
        queueMicrotask(() => {
          this.emit('message', {
            data: responseFrame,
          } as MessageEvent as unknown as Event);
        });
      }

      public close(code?: number, reason?: string): void {
        this.readyState = RoundRetryWebSocket.CLOSED;
        this.emit('close', new CloseEvent('close', { code: code ?? 1000, reason: reason ?? '' }));
      }

      public addEventListener(type: string, listener: (event: Event) => void): void {
        const set = this.listeners.get(type) ?? new Set();
        set.add(listener);
        this.listeners.set(type, set);
      }

      public removeEventListener(type: string, listener: (event: Event) => void): void {
        this.listeners.get(type)?.delete(listener);
      }

      private emit(type: string, event: Event): void {
        this.listeners.get(type)?.forEach(listener => listener(event));
      }
    } as unknown as typeof WebSocket;

    const client = createClient(['wss://sync-a.example.com/ws', 'wss://sync-b.example.com/ws']);
    const result = await client.sync({
      urls: ['wss://sync-a.example.com/ws', 'wss://sync-b.example.com/ws'],
      request: createRequest(),
    });

    expect(createdUrls).toEqual([
      'wss://sync-a.example.com/ws',
      'wss://sync-b.example.com/ws',
      'wss://sync-a.example.com/ws',
    ]);
    expect(requestRecords).toHaveLength(1);
    expect(requestRecords[0]).toMatchObject({
      url: 'wss://sync-a.example.com/ws',
      cursor: 0,
    });
    expect(result.mode).toBe('full');
    expect(result.version).toBe('v-retry');
    expect(result.pages[0]?.data[0]?.contact).toBe('u9');
  });

  it('中途断线后应基于上次 cursor 切换到下一个地址继续同步', async () => {
    globalThis.WebSocket = MockRosterWebSocket as unknown as typeof WebSocket;
    MockRosterWebSocket.scriptedActions.set('wss://sync-a.example.com/ws', [
      {
        type: 'message',
        data: toArrayBuffer(
          buildRosterResponseFrame({
            items: [
              {
                contact: 'u1',
                remark: 'r1',
                metadata: '{"nickname":"n1","avatarUrl":"a1","sign":"s1"}',
                createdAt: 1,
                updatedAt: 2,
                metadataUpdatedAt: 3,
              },
            ],
            version: 'v2',
            responseType: RosterResponseType.FULL,
            cursor: 9,
          })
        ),
      },
      {
        type: 'close',
        code: 1006,
        reason: 'network-lost',
      },
    ]);
    MockRosterWebSocket.scriptedActions.set('wss://sync-b.example.com/ws', [
      {
        type: 'message',
        data: toArrayBuffer(
          buildRosterResponseFrame({
            items: [
              {
                contact: 'u2',
                remark: 'r2',
                metadata: '{"nickname":"n2","avatarUrl":"a2","sign":"s2"}',
                createdAt: 4,
                updatedAt: 5,
                metadataUpdatedAt: 6,
              },
            ],
            version: '',
            responseType: RosterResponseType.FULL,
            cursor: 0,
          })
        ),
      },
    ]);

    const client = createClient(['wss://sync-a.example.com/ws', 'wss://sync-b.example.com/ws']);
    const result = await client.sync({
      urls: ['wss://sync-a.example.com/ws', 'wss://sync-b.example.com/ws'],
      request: createRequest(),
    });

    expect(MockRosterWebSocket.requestRecords).toHaveLength(2);
    expect(MockRosterWebSocket.requestRecords[0]).toMatchObject({
      url: 'wss://sync-a.example.com/ws',
      cursor: 0,
    });
    expect(MockRosterWebSocket.requestRecords[1]).toMatchObject({
      url: 'wss://sync-b.example.com/ws',
      cursor: 9,
    });
    expect(MockRosterWebSocket.requestRecords[0]?.requestId).toBe(
      MockRosterWebSocket.requestRecords[1]?.requestId
    );
    expect(result.mode).toBe('full');
    expect(result.version).toBe('v2');
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0]?.data[0]?.contact).toBe('u1');
    expect(result.pages[1]?.data[0]?.contact).toBe('u2');
  });

  it('Blob 形式的响应帧解码失败时应返回外层 socket failed 错误', async () => {
    globalThis.WebSocket = MockRosterWebSocket as unknown as typeof WebSocket;
    MockRosterWebSocket.mode = 'blob_success';
    MockRosterWebSocket.rosterPayload = buildRosterResponseFrame({
      items: [],
      version: 'v-blob',
      responseType: RosterResponseType.INCREMENTAL,
    });

    const client = createClient(['wss://sync-a.example.com/ws']);
    try {
      await client.sync({
        urls: ['wss://sync-a.example.com/ws'],
        request: createRequest(),
      });
      expect.unreachable('expected client.sync to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(SDKError);
      const sdkError = error as SDKError;
      expect(sdkError.code).toBe(ERROR_CODES.CONTACT_SYNC_PROTO_DECODE_FAILED);
      expect(sdkError.details?.['stage']).toBe('response_decode');
    }
  });

  it('服务端返回 ErrorDetail 时应抛出 socket failed 错误', async () => {
    globalThis.WebSocket = MockRosterWebSocket as unknown as typeof WebSocket;
    MockRosterWebSocket.mode = 'server_error';

    const client = createClient(['wss://sync-a.example.com/ws']);

    try {
      await client.sync({
        urls: ['wss://sync-a.example.com/ws'],
        request: createRequest(),
      });
      expect.unreachable('expected client.sync to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(SDKError);
      const sdkError = error as SDKError;
      expect(sdkError.code).toBe(ERROR_CODES.CONTACT_SYNC_SOCKET_FAILED);
      expect(sdkError.details?.['stage']).toBe('sync_page');
      expect(sdkError.message).toBe('server busy');
    }
  });

  it('响应 payload 类型非法时应抛出 decode failed 错误', async () => {
    globalThis.WebSocket = MockRosterWebSocket as unknown as typeof WebSocket;
    MockRosterWebSocket.mode = 'invalid_payload';

    const client = createClient(['wss://sync-a.example.com/ws']);

    try {
      await client.sync({
        urls: ['wss://sync-a.example.com/ws'],
        request: createRequest(),
      });
      expect.unreachable('expected client.sync to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(SDKError);
      const sdkError = error as SDKError;
      expect(sdkError.code).toBe(ERROR_CODES.CONTACT_SYNC_PROTO_DECODE_FAILED);
      expect(sdkError.details?.['stage']).toBe('response_decode');
    }
  });

  it('收到未知帧类型时应忽略并最终按空闲超时失败', async () => {
    vi.useFakeTimers();
    globalThis.WebSocket = MockRosterWebSocket as unknown as typeof WebSocket;
    MockRosterWebSocket.mode = 'unknown_frame';

    const client = createClient(['wss://sync-a.example.com/ws']);
    const pending = client.sync({
      urls: ['wss://sync-a.example.com/ws'],
      request: createRequest(),
    });
    const rejection = pending.catch((error: unknown) => error);

    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(33002);
    const error = await rejection;
    expect(error).toBeInstanceOf(SDKError);
    const sdkError = error as SDKError;
    expect(sdkError.code).toBe(ERROR_CODES.CONTACT_SYNC_SOCKET_FAILED);
    expect(sdkError.details?.['stage']).toBe('sync_page');
    expect(sdkError.message).toBe('sync websocket socket idle timeout');
  });

  it('取消同步时应抛出 cancelled 错误', async () => {
    globalThis.WebSocket = MockRosterWebSocket as unknown as typeof WebSocket;
    MockRosterWebSocket.mode = 'hang';

    const client = createClient(['wss://sync-a.example.com/ws']);
    const pending = client.sync({
      urls: ['wss://sync-a.example.com/ws'],
      request: createRequest(),
    });
    const rejection = pending.catch((error: unknown) => error);

    await flushMicrotasks();
    client.cancel();
    const error = await rejection;
    expect(error).toBeInstanceOf(SDKError);
    const sdkError = error as SDKError;
    expect(sdkError.code).toBe(ERROR_CODES.CONTACT_SYNC_CANCELLED);
    expect(sdkError.details?.['stage']).toBe('cancelled');
  });

  it('连接超时时应抛出 socket connect 错误', async () => {
    vi.useFakeTimers();
    globalThis.WebSocket = class ConnectTimeoutWebSocket {
      public static readonly CONNECTING = 0;
      public static readonly OPEN = 1;
      public static readonly CLOSING = 2;
      public static readonly CLOSED = 3;
      public readyState = ConnectTimeoutWebSocket.CONNECTING;
      public binaryType = 'arraybuffer';
      public constructor(_url: string) {}
      public addEventListener(_type: string, _listener: (event: Event) => void): void {}
      public removeEventListener(_type: string, _listener: (event: Event) => void): void {}
      public send(_data: unknown): void {}
      public close(_code?: number, _reason?: string): void {
        this.readyState = ConnectTimeoutWebSocket.CLOSED;
      }
    } as unknown as typeof WebSocket;

    const client = createClient(['wss://sync-a.example.com/ws']);
    const pending = client.sync({
      urls: ['wss://sync-a.example.com/ws'],
      request: createRequest(),
    });
    const rejection = pending.catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(22002);
    const error = await rejection;
    expect(error).toBeInstanceOf(SDKError);
    const sdkError = error as SDKError;
    expect(sdkError.code).toBe(ERROR_CODES.CONTACT_SYNC_SOCKET_FAILED);
    expect(sdkError.details?.['stage']).toBe('socket_connect');
    expect(sdkError.message).toBe('sync websocket socket connect timeout');
  });

  it('空闲超时时应抛出 sync page 错误', async () => {
    vi.useFakeTimers();
    globalThis.WebSocket = MockRosterWebSocket as unknown as typeof WebSocket;
    MockRosterWebSocket.mode = 'idle_timeout';

    const client = createClient(['wss://sync-a.example.com/ws']);
    const pending = client.sync({
      urls: ['wss://sync-a.example.com/ws'],
      request: createRequest(),
    });
    const rejection = pending.catch((error: unknown) => error);

    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(33002);
    const error = await rejection;
    expect(error).toBeInstanceOf(SDKError);
    const sdkError = error as SDKError;
    expect(sdkError.code).toBe(ERROR_CODES.CONTACT_SYNC_SOCKET_FAILED);
    expect(sdkError.details?.['stage']).toBe('sync_page');
    expect(sdkError.message).toBe('sync websocket socket idle timeout');
  });

  it('WebSocket 构造失败时应抛出 exhausted 错误', async () => {
    vi.useFakeTimers();
    globalThis.WebSocket = class ThrowingWebSocket {
      public static readonly CONNECTING = 0;
      public static readonly OPEN = 1;
      public static readonly CLOSING = 2;
      public static readonly CLOSED = 3;
      public constructor(_url: string) {
        throw new Error('create failed');
      }
    } as unknown as typeof WebSocket;

    const client = createClient(['wss://sync-a.example.com/ws']);
    const pending = client.sync({
      urls: ['wss://sync-a.example.com/ws'],
      request: createRequest(),
    });
    const rejection = pending.catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(3002);
    const error = await rejection;
    expect(error).toBeInstanceOf(SDKError);
    const sdkError = error as SDKError;
    expect(sdkError.code).toBe(ERROR_CODES.CONTACT_SYNC_SOCKET_FAILED);
    expect(sdkError.details?.['stage']).toBe('socket_connect');
    expect(sdkError.message).toBe('sync websocket socket create failed');
  });
});
