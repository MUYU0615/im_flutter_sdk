/**
 * REST API token 获取工具
 *
 * 通过 password grant_type 从服务端获取用户 token。
 * 如果 .env 中已配置 token 则跳过请求。
 */

export interface TokenResult {
  readonly accessToken: string;
  readonly expireTimestamp: number;
}

/**
 * 从 appKey 解析 orgName 和 appName
 */
function parseAppKey(appKey: string): { orgName: string; appName: string } {
  const parts = appKey.split('#');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid appKey format: "${appKey}", expected "orgName#appName"`);
  }
  return { orgName: parts[0], appName: parts[1] };
}

/**
 * 通过 REST API 获取用户 token
 *
 * @param restUrl - REST 基础地址（如 https://a1.easemob.com）
 * @param appKey - 应用 appKey（orgName#appName）
 * @param userId - 用户 ID
 * @param password - 用户密码
 */
export async function fetchUserToken(
  restUrl: string,
  appKey: string,
  userId: string,
  password: string
): Promise<TokenResult> {
  const { orgName, appName } = parseAppKey(appKey);
  const url = `${restUrl.replace(/\/$/, '')}/${orgName}/${appName}/token`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'password',
      username: userId,
      password,
      timestamp: Date.now(),
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `fetchUserToken failed: HTTP ${response.status} for user "${userId}" at ${url}. Response: ${text}`
    );
  }

  const data = (await response.json()) as Record<string, unknown>;
  const accessToken = data.access_token as string | undefined;
  if (!accessToken) {
    throw new Error(`fetchUserToken: response missing access_token for user "${userId}"`);
  }

  const expiresIn = (data.expires_in as number) ?? 0;
  return {
    accessToken,
    expireTimestamp: Date.now() + expiresIn * 1000,
  };
}

/**
 * 获取 token：优先使用已配置的 token，否则通过 REST API 获取
 */
export async function resolveToken(options: {
  restUrl: string;
  appKey: string;
  userId: string;
  password?: string | null;
  existingToken?: string | null;
}): Promise<string> {
  if (options.existingToken) {
    return options.existingToken;
  }
  if (!options.password) {
    throw new Error(
      `No token or password configured for user "${options.userId}". Set EASEMOB_TOKEN or EASEMOB_PASSWORD in .env`
    );
  }
  const result = await fetchUserToken(options.restUrl, options.appKey, options.userId, options.password);
  return result.accessToken;
}
