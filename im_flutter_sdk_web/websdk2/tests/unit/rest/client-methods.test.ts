import { afterEach, describe, expect, it, vi } from 'vitest';

import { RestClient } from '@/rest/client';

const createJsonResponse = (data: unknown): Response => {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async (): Promise<unknown> => data,
    text: async (): Promise<string> => JSON.stringify(data),
  } as unknown as Response;
};

describe('RestClient methods', () => {
  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('post/put/delete/patch 应转发到 request 并携带 method', async () => {
    const client = new RestClient('https://api.example.com');
    const requestSpy = vi.spyOn(client, 'request').mockResolvedValue({ ok: true });

    await client.post('/p1', { a: 1 });
    await client.put('/p2', { b: 2 });
    await client.delete('/p3');
    await client.patch('/p4', { c: 3 });

    expect(requestSpy).toHaveBeenNthCalledWith(
      1,
      '/p1',
      expect.objectContaining({ method: 'POST' })
    );
    expect(requestSpy).toHaveBeenNthCalledWith(
      2,
      '/p2',
      expect.objectContaining({ method: 'PUT' })
    );
    expect(requestSpy).toHaveBeenNthCalledWith(
      3,
      '/p3',
      expect.objectContaining({ method: 'DELETE' })
    );
    expect(requestSpy).toHaveBeenNthCalledWith(
      4,
      '/p4',
      expect.objectContaining({ method: 'PATCH' })
    );
  });

  it('removeAuthToken 后请求头不应包含 Authorization', async () => {
    const client = new RestClient('https://api.example.com');
    client.setAuthToken('token-1');
    client.removeAuthToken();

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(createJsonResponse({ ok: true }));

    await client.get('/users?keyword=alice');

    const options = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const headers = options.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });
});
