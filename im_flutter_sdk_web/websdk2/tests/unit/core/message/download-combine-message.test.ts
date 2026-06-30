import { afterEach, describe, expect, it, vi } from 'vitest';
import { CombineMessageDownloader } from '@/core/message/combine-message-downloader';
import { encodeCombineMessageList } from '@/message/combine-payload-codec';
import type { RequestAdapter, RequestConfig, RequestResponse } from '@/platform';
import type { Message } from '@/types';
import { ERROR_CODES } from '@/utils/error-codes';
import { MessageReceiveError, ValidationError } from '@/utils/errors';

const createItem = (partial: Partial<Message> = {}): Message => {
  return {
    type: 'text',
    sender: {
      userId: 'user-1',
    },
    conversationId: 'target-1',
    conversationType: 'singleChat',
    timestamp: 1735689600000,
    body: {
      content: 'hello',
    },
    msgServerId: '',
    msgLocalId: '',
    from: '',
    to: '',
    status: 'sent',
    ext: {},
    ...partial,
  } as Message;
};

describe('CombineMessageDownloader', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('应下载并解码合并消息详情', async () => {
    const payload = encodeCombineMessageList([
      createItem({ msgLocalId: 'a' }),
      createItem({
        type: 'combine',
        combineLevel: 2,
        body: {
          title: '转发',
          summary: '1 条',
          compatibleText: '[聊天记录]',
          filename: 'combine',
          filetype: 'application/octet-stream',
          combineLevel: 2,
        },
      }),
    ]);

    const requestAdapter: RequestAdapter = {
      request: <TData>(_config: RequestConfig): Promise<RequestResponse<TData>> =>
        Promise.resolve({
          status: 200,
          headers: {},
          data: payload.buffer as TData,
        }),
    };

    const downloader = new CombineMessageDownloader(requestAdapter);
    const messages = await downloader.downloadAndParse({
      url: 'https://example.com/combine',
      secret: 'secret',
    });

    expect(messages).toHaveLength(2);
    expect(messages[0]?.type).toBe('text');
    expect(messages[1]?.type).toBe('combine');
    expect(messages[1]?.combineLevel).toBe(2);
  });

  it('maxItems 非法时应抛错', async () => {
    const requestAdapter: RequestAdapter = {
      request: <TData>(_config: RequestConfig): Promise<RequestResponse<TData>> =>
        Promise.resolve({
          status: 200,
          headers: {},
          data: encodeCombineMessageList([createItem()]).buffer as TData,
        }),
    };
    const downloader = new CombineMessageDownloader(requestAdapter);

    await expect(
      downloader.downloadAndParse({
        url: 'https://example.com/combine',
        maxItems: 301,
      })
    ).rejects.toThrow(ValidationError);
  });

  it('应支持 DataView 载荷并且只追加一次 share-secret', async () => {
    const payload = encodeCombineMessageList([createItem({ msgServerId: 'server-1' })]);
    const requestAdapter: RequestAdapter = {
      request: <TData>(config: RequestConfig): Promise<RequestResponse<TData>> => {
        expect(config.url).toBe('https://example.com/combine?share-secret=exists&em-redirect=true');
        return Promise.resolve({
          status: 200,
          headers: {},
          data: new DataView(payload.buffer) as TData,
        });
      },
    };
    const downloader = new CombineMessageDownloader(requestAdapter);

    const messages = await downloader.downloadAndParse({
      url: 'https://example.com/combine?share-secret=exists',
      secret: 'ignored',
    });

    expect(messages[0]?.msgServerId).toBe('server-1');
  });

  it('缺少 url 或 request adapter 时应抛出稳定错误', async () => {
    const downloaderWithUrlError = new CombineMessageDownloader({
      request: <TData>(): Promise<RequestResponse<TData>> =>
        Promise.resolve({
          status: 200,
          headers: {},
          data: new Uint8Array().buffer as TData,
        }),
    });

    await expect(
      downloaderWithUrlError.downloadAndParse({
        url: '   ',
      })
    ).rejects.toThrow(ValidationError);

    vi.stubGlobal('fetch', undefined);
    const downloaderWithoutAdapter = new CombineMessageDownloader();

    await expect(
      downloaderWithoutAdapter.downloadAndParse({
        url: 'https://example.com/combine',
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.COMBINE_DOWNLOAD_FAILED,
    });
  });

  it('下载失败、非法响应和底层异常应包装为 MessageReceiveError', async () => {
    const downloaderWithStatusError = new CombineMessageDownloader({
      request: <TData>(): Promise<RequestResponse<TData>> =>
        Promise.resolve({
          status: 500,
          headers: {},
          data: new Uint8Array().buffer as TData,
        }),
    });
    await expect(
      downloaderWithStatusError.downloadAndParse({
        url: 'https://example.com/combine',
      })
    ).rejects.toBeInstanceOf(MessageReceiveError);

    const downloaderWithInvalidPayload = new CombineMessageDownloader({
      request: <TData>(): Promise<RequestResponse<TData>> =>
        Promise.resolve({
          status: 200,
          headers: {},
          data: 123 as TData,
        }),
    });
    await expect(
      downloaderWithInvalidPayload.downloadAndParse({
        url: 'https://example.com/combine',
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.COMBINE_DOWNLOAD_FAILED,
    });

    const downloaderWithAdapterThrow = new CombineMessageDownloader({
      request: async <TData>(): Promise<RequestResponse<TData>> => {
        throw new Error('network');
      },
    });
    await expect(
      downloaderWithAdapterThrow.downloadAndParse({
        url: 'https://example.com/combine',
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.COMBINE_DOWNLOAD_FAILED,
      details: expect.objectContaining({
        cause: 'network',
      }),
    });
  });
});
