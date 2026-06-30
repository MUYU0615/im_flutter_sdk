import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchContactMetadataVersion } from '@/rest/contact-metadata';
import { ERROR_CODES } from '@/utils/error-codes';
import { ValidationError } from '@/utils/errors';

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

describe('contact-metadata', () => {
  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('应解析 data.rosterVersion 与 need_sync 响应', async () => {
    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        requests.push({ input, init });
        return Promise.resolve(
          createJsonResponse({
            data: {
              rosterVersion: 'v-next',
              need_sync: true,
              timestamp: 123,
            },
          })
        );
      }
    );

    const result = await fetchContactMetadataVersion(
      {
        appKey: 'org#app',
        userId: 'user 1',
        token: 'token-1',
        restBaseUrl: 'https://rest.example.com',
        clientResource: 'web',
      },
      'v-prev'
    );

    expect(result).toEqual({
      version: 'v-next',
      requiresSync: true,
      checkedAt: 123,
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.input).toBe(
      'https://rest.example.com/org/app/user/user%201/roster/metadata/version'
    );
    const headers = requests[0]?.init?.headers;
    expect(headers).toBeDefined();
    expect((headers as Record<string, string>)['Authorization']).toBe('Bearer token-1');
  });

  it('requiresSync 缺失时应按 version 是否变化兜底判断', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> =>
        Promise.resolve(
          createJsonResponse({
            version: 'same-version',
          })
        )
    );

    const result = await fetchContactMetadataVersion(
      {
        appKey: 'org#app',
        userId: 'user-1',
        token: 'token-1',
        restBaseUrl: 'https://rest.example.com',
        clientResource: 'web',
      },
      'same-version'
    );

    expect(result.requiresSync).toBe(false);
  });

  it('响应结构非法时应抛出 ValidationError', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> =>
        Promise.resolve(createJsonResponse(null))
    );

    await expect(
      fetchContactMetadataVersion(
        {
          appKey: 'org#app',
          userId: 'user-1',
          token: 'token-1',
          restBaseUrl: 'https://rest.example.com',
          clientResource: 'web',
        },
        'v1'
      )
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('网络错误时应包装为 CONTACT_SYNC_METADATA_FAILED', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> =>
        Promise.reject(new Error('network down'))
    );
    try {
      await fetchContactMetadataVersion(
        {
          appKey: 'org#app',
          userId: 'user-1',
          token: 'token-1',
          restBaseUrl: 'https://rest.example.com',
          clientResource: 'web',
        },
        'v1'
      );
      expect.unreachable('expected fetchContactMetadataVersion to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error & { code?: number; details?: Record<string, unknown> }).code).toBe(
        ERROR_CODES.CONTACT_SYNC_METADATA_FAILED
      );
      expect(
        (error as Error & { details?: Record<string, unknown> }).details?.['stage']
      ).toBe('metadata');
    }
  });
});
