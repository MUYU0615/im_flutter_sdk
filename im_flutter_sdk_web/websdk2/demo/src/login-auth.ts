import { parseAppKey } from '../../src/upload/utils';

export type DemoLoginMode = 'token' | 'password';

export interface ResolveDemoLoginModeInput {
  readonly token: string;
  readonly password: string;
}

export interface ResolveDemoLoginModeResult {
  readonly mode: DemoLoginMode;
  readonly credential: string;
}

export interface PasswordTokenExchangeOptions {
  readonly restBaseUrl: string;
  readonly appKey: string;
  readonly userId: string;
  readonly password: string;
  readonly fetchImpl?: typeof fetch;
}

interface TokenExchangeResponse {
  readonly access_token?: unknown;
  readonly token?: unknown;
}

export const resolveDemoLoginMode = (
  input: ResolveDemoLoginModeInput
): ResolveDemoLoginModeResult | null => {
  const token = input.token.trim();
  if (token) {
    return {
      mode: 'token',
      credential: token,
    };
  }

  const password = input.password.trim();
  if (password) {
    return {
      mode: 'password',
      credential: password,
    };
  }

  return null;
};

export const buildPasswordTokenExchangeUrl = (restBaseUrl: string, appKey: string): string => {
  const trimmedBaseUrl = restBaseUrl.trim();
  if (!trimmedBaseUrl) {
    throw new Error('REST 地址为空，无法使用密码换取 token');
  }

  const { orgName, appName } = parseAppKey(appKey.trim());
  return `${trimmedBaseUrl.replace(/\/+$/, '')}/${orgName}/${appName}/token`;
};

const extractTokenFromResponse = (payload: TokenExchangeResponse): string | null => {
  if (typeof payload.access_token === 'string' && payload.access_token.trim().length > 0) {
    return payload.access_token.trim();
  }
  if (typeof payload.token === 'string' && payload.token.trim().length > 0) {
    return payload.token.trim();
  }
  return null;
};

export const exchangePasswordForToken = async (
  options: PasswordTokenExchangeOptions
): Promise<string> => {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = buildPasswordTokenExchangeUrl(options.restBaseUrl, options.appKey);
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'password',
      username: options.userId.trim(),
      password: options.password,
      timestamp: Date.now(),
    }),
  });

  if (!response.ok) {
    const responseText = await response.text().catch((): string => '');
    const detail = responseText.trim();
    throw new Error(detail ? `密码换取 token 失败: HTTP ${response.status} ${detail}` : `密码换取 token 失败: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as TokenExchangeResponse;
  const token = extractTokenFromResponse(payload);
  if (!token) {
    throw new Error('密码换取 token 失败: 响应中缺少 token');
  }
  return token;
};
