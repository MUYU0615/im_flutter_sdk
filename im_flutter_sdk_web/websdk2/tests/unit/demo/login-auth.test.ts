import { describe, expect, it, vi } from 'vitest';
import {
  buildPasswordTokenExchangeUrl,
  exchangePasswordForToken,
  resolveDemoLoginMode,
} from '../../../demo/src/login-auth';

describe('demo login auth helpers', () => {
  it('resolveDemoLoginMode 应优先选择 token', () => {
    expect(
      resolveDemoLoginMode({
        token: ' token-1 ',
        password: '1',
      })
    ).toEqual({
      mode: 'token',
      credential: 'token-1',
    });
  });

  it('resolveDemoLoginMode 应在缺少 token 时回退到 password', () => {
    expect(
      resolveDemoLoginMode({
        token: '   ',
        password: ' 1 ',
      })
    ).toEqual({
      mode: 'password',
      credential: '1',
    });
  });

  it('resolveDemoLoginMode 在 token/password 都为空时返回 null', () => {
    expect(
      resolveDemoLoginMode({
        token: ' ',
        password: ' ',
      })
    ).toBeNull();
  });

  it('buildPasswordTokenExchangeUrl 应按 appKey 拼出 token 接口地址', () => {
    expect(buildPasswordTokenExchangeUrl('https://a1-hsb.easemob.com/', 'easemob-demo#chatdemoui'))
      .toBe('https://a1-hsb.easemob.com/easemob-demo/chatdemoui/token');
  });

  it('exchangePasswordForToken 应优先读取 access_token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'access-token-1',
      }),
    });

    await expect(
      exchangePasswordForToken({
        restBaseUrl: 'https://a1-hsb.easemob.com',
        appKey: 'easemob-demo#chatdemoui',
        userId: 'tst',
        password: '1',
        fetchImpl,
      })
    ).resolves.toBe('access-token-1');

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://a1-hsb.easemob.com/easemob-demo/chatdemoui/token',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('exchangePasswordForToken 在 access_token 不存在时应兼容 token 字段', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        token: 'token-1',
      }),
    });

    await expect(
      exchangePasswordForToken({
        restBaseUrl: 'https://a1-hsb.easemob.com',
        appKey: 'easemob-demo#chatdemoui',
        userId: 'tst',
        password: '1',
        fetchImpl,
      })
    ).resolves.toBe('token-1');
  });

  it('exchangePasswordForToken 在 HTTP 失败时应抛出明确错误', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'unauthorized',
    });

    await expect(
      exchangePasswordForToken({
        restBaseUrl: 'https://a1-hsb.easemob.com',
        appKey: 'easemob-demo#chatdemoui',
        userId: 'tst',
        password: '1',
        fetchImpl,
      })
    ).rejects.toThrow('密码换取 token 失败: HTTP 401 unauthorized');
  });

  it('exchangePasswordForToken 在响应缺少 token 时应抛错', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        expires_in: 3600,
      }),
    });

    await expect(
      exchangePasswordForToken({
        restBaseUrl: 'https://a1-hsb.easemob.com',
        appKey: 'easemob-demo#chatdemoui',
        userId: 'tst',
        password: '1',
        fetchImpl,
      })
    ).rejects.toThrow('密码换取 token 失败: 响应中缺少 token');
  });
});
