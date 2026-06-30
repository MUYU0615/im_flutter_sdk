import { vi } from 'vitest';

import { ChatClient } from '@/chat-client';
import { EventHub } from '@/core/events/event-hub';
import { ChatManager } from '@/managers/chat-manager';
import { ConnectionStatus, type Message } from '@/types';

export type ClientWithChatManager = ChatClient & {
  readonly chatManager: ChatManager;
};

type CoreStub = {
  sendMessageAction?: (action: unknown, createAckError?: unknown) => Promise<unknown>;
  downloadAttachment?: (message: Message, timeoutMs?: number) => Promise<unknown>;
  downloadAndParseCombineMessage?: (params: unknown) => Promise<unknown>;
  decodeServerMessageMeta?: (payload: Uint8Array) => Message | null;
};

type ChatClientInternal = {
  restBaseUrl: string | null;
  authToken: string | null;
  currentUserId: string | null;
  clientResource: string | null;
  state: ConnectionStatus;
  core: CoreStub | null;
  eventHub: EventHub;
};

export type FetchCall = {
  readonly method: string;
  readonly url: URL;
  readonly body?: unknown;
};

export const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

export const primeRestContext = (
  client: ChatClient,
  options?: {
    readonly baseUrl?: string;
    readonly token?: string;
    readonly userId?: string;
    readonly resource?: string;
  }
): ChatClientInternal => {
  const internal = client as unknown as ChatClientInternal;
  internal.restBaseUrl = options?.baseUrl ?? 'https://api.example.com';
  internal.authToken = options?.token ?? 'mock-token';
  internal.currentUserId = options?.userId ?? 'alice';
  internal.clientResource = options?.resource ?? 'web';
  return internal;
};

export const primeConnectedCore = (
  client: ChatClient,
  overrides: CoreStub = {}
): ChatClientInternal => {
  const internal = client as unknown as ChatClientInternal;
  internal.currentUserId = internal.currentUserId ?? 'alice';
  internal.state = ConnectionStatus.CONNECTED;
  internal.core = {
    sendMessageAction:
      overrides.sendMessageAction ??
      vi.fn(async () => ({
        protocolId: 'p1',
        serverId: 's1',
        statusCode: 0,
      })),
    downloadAttachment:
      overrides.downloadAttachment ??
      vi.fn(async () => ({
        filename: 'attachment.bin',
        mimeType: 'application/octet-stream',
        data: new Uint8Array([1, 2, 3]),
        downloadUrl: 'https://cdn.example.com/attachment.bin',
      })),
    downloadAndParseCombineMessage:
      overrides.downloadAndParseCombineMessage ?? vi.fn(async () => []),
    decodeServerMessageMeta: overrides.decodeServerMessageMeta ?? vi.fn(() => null),
  };
  return internal;
};

export const buildTextMessage = (overrides: Partial<Message> = {}): Message => {
  return {
    msgServerId: overrides.msgServerId ?? 'msg-1',
    msgLocalId: overrides.msgLocalId ?? '',
    from: '',
    to: '',
    sender: overrides.sender ?? { userId: 'bob' },
    conversationId: overrides.conversationId ?? 'alice',
    conversationType: overrides.conversationType ?? 'singleChat',
    type: 'text',
    status: overrides.status ?? 'sent',
    ext: overrides.ext ?? {},
    timestamp: overrides.timestamp ?? 1714291200000,
    body: overrides.body ?? { content: 'hello' },
    direct: overrides.direct ?? 'RECEIVE',
  };
};

export const buildCombineMessage = (): Message => {
  return {
    msgServerId: 'combine-1',
    msgLocalId: '',
    from: '',
    to: '',
    sender: { userId: 'bob' },
    conversationId: 'alice',
    conversationType: 'singleChat',
    type: 'combine',
    status: 'sent',
    ext: {},
    timestamp: 1714291200000,
    body: {
      title: '聊天记录',
      summary: 'summary',
      compatibleText: '[聊天记录]',
      filename: 'combine',
      filetype: 'application/octet-stream',
      url: 'https://cdn.example.com/combine',
      secret: 'secret',
      fileLength: 12,
      combineLevel: 0,
    },
    direct: 'RECEIVE',
  };
};

export const buildImageMessage = (): Message => {
  return {
    msgServerId: 'img-1',
    msgLocalId: '',
    from: '',
    to: '',
    sender: { userId: 'bob' },
    conversationId: 'alice',
    conversationType: 'singleChat',
    type: 'image',
    status: 'sent',
    ext: {},
    timestamp: 1714291200000,
    body: {
      localUrl: '',
      filename: 'a.png',
      filetype: 'image/png',
      width: 10,
      height: 10,
      isGif: false,
      isOriginalImage: true,
      originalImageUrl: 'https://cdn.example.com/a.png',
      secret: 'secret',
      fileLength: 10,
    },
    direct: 'RECEIVE',
  };
};

export const createJsonResponse = (status: number, body: unknown): Response => {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
    headers: {
      get: (): string => 'application/json',
    },
    json: (): Promise<unknown> => Promise.resolve(body),
    text: (): Promise<string> => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
};

export const buildFetchMock = (handler: (call: FetchCall) => Response): typeof fetch => {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    );
    const method = init?.method ?? 'GET';
    const body =
      typeof init?.body === 'string' && init.body.length > 0
        ? (JSON.parse(init.body) as unknown)
        : undefined;

    return Promise.resolve(
      handler({
        method,
        url,
        body,
      })
    );
  }) as unknown as typeof fetch;
};
