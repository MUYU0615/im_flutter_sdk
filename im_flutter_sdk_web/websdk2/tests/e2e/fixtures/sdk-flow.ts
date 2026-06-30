import { expect, test, type Page } from '@playwright/test';
import {
  describeRealEnvConfigRedacted,
  getMissingRealEnvKeys,
  resolveRealEnvConfig,
  type RealEnvConfig,
} from '../../test-utils/layered/real-env-runner';

export type DemoConnectionState = 'disconnected' | 'connecting' | 'connected';
export type DemoTabKey =
  | 'init'
  | 'send'
  | 'chat-manager'
  | 'conversation'
  | 'message'
  | 'voice-to-text'
  | 'log'
  | 'profileSync';

const strictMode =
  process.env.LAYERED_GATE_STRICT === '1' || process.env.REAL_ENV_E2E_STRICT === '1';

const realEnvConfig = resolveRealEnvConfig();
const REAL_ENV_LOGIN_TIMEOUT = 30_000;

const parseLabelValue = (line: string): string => {
  const separatorIndex = line.indexOf(':');
  if (separatorIndex < 0) {
    throw new Error(`无效的 demo 字段格式: ${line}`);
  }
  return line.slice(separatorIndex + 1).trim();
};

export const requireRealEnvE2EConfig = (): RealEnvConfig => {
  if (realEnvConfig) {
    return realEnvConfig;
  }
  const missing = getMissingRealEnvKeys();
  const message = `真实环境 E2E 缺少环境变量: ${missing.join(', ')}`;
  if (strictMode) {
    throw new Error(message);
  }
  test.skip(true, message);
  throw new Error(message);
};

export const buildInvalidAppKey = (config: RealEnvConfig): string => {
  return `${config.appKey}-invalid-e2e`;
};

export const buildMessageText = (): string => {
  return `e2e-real-${Date.now()}`;
};

export const buildGroupNamecard = (): string => {
  return `group-card-${Date.now()}`;
};

export const openDemo = async (page: Page): Promise<void> => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'IM SDK Demo' })).toBeVisible();
  await expect(page.getByTestId('demo-connection-state')).toContainText('disconnected');
};

export const openTab = async (page: Page, tab: DemoTabKey): Promise<void> => {
  await page.getByTestId(`tab-${tab}`).click();
};

export const readConnectionState = async (page: Page): Promise<DemoConnectionState> => {
  const text = await page.getByTestId('demo-connection-state').innerText();
  const state = parseLabelValue(text);
  if (state !== 'disconnected' && state !== 'connecting' && state !== 'connected') {
    throw new Error(`未知连接状态: ${state}`);
  }
  return state;
};

export const expectConnectionState = async (
  page: Page,
  state: DemoConnectionState,
  options?: { timeout?: number }
): Promise<void> => {
  await expect(page.getByTestId('demo-connection-state')).toContainText(state, options);
};

export const expectInitialized = async (page: Page, initialized: boolean): Promise<void> => {
  await expect(page.getByTestId('demo-initialized')).toContainText(String(initialized));
};

export const expectCurrentUser = async (
  page: Page,
  userId: string,
  options?: { timeout?: number }
): Promise<void> => {
  await expect(page.getByTestId('demo-current-user')).toContainText(userId, options);
};

export const expectNoCurrentUser = async (page: Page): Promise<void> => {
  const text = await page.getByTestId('demo-current-user').innerText();
  expect(parseLabelValue(text)).toBe('');
};

const readCurrentUserValue = async (page: Page): Promise<string> => {
  const text = await page.getByTestId('demo-current-user').innerText();
  return parseLabelValue(text);
};

const readLogListText = async (page: Page): Promise<string> => {
  await openTab(page, 'log');
  return page.getByTestId('log-list').innerText();
};

const summarizeLogLines = (logText: string): string => {
  const lines = logText
    .split('\n')
    .map((line): string => line.trim())
    .filter(Boolean)
    .slice(0, 5);
  return lines.join(' || ');
};

const detectKnownLoginFailure = (logText: string): string | null => {
  if (
    logText.includes('Provision rejected') ||
    logText.includes('token or password does not match login info')
  ) {
    return '检测到 Provision rejected，通常表示当前注入的 `EASEMOB_TOKEN` 与 `EASEMOB_USERID` / `EASEMOB_APPKEY` 不匹配。当前 E2E 仅使用 token 登录，不会回退到 password，请先更新真实环境凭证。';
  }
  if (logText.includes('登录失败')) {
    return 'demo 已记录登录失败，请先检查日志中的 SDK 错误详情。';
  }
  return null;
};

const buildLoginFailureDiagnosis = async (page: Page): Promise<string> => {
  const connectionState = await readConnectionState(page);
  const currentUserId = await readCurrentUserValue(page);
  const logText = await readLogListText(page);
  const realEnvSummary = describeRealEnvConfigRedacted();
  const knownFailure = detectKnownLoginFailure(logText);
  const summary = [
    `connectionState=${connectionState}`,
    `currentUserId=${currentUserId || '[empty]'}`,
    `realEnv=${realEnvSummary}`,
    `recentLogs=${summarizeLogLines(logText) || '[empty]'}`,
  ].join('; ');

  if (knownFailure) {
    return `${knownFailure} ${summary}`;
  }
  return `未观察到登录成功。${summary}`;
};

export const runInit = async (
  page: Page,
  config: RealEnvConfig,
  overrides?: {
    appKey?: string;
    restUrl?: string;
    wsUrl?: string;
    syncWsUrl?: string;
    useDnsConfig?: boolean;
    enableUserInfoSync?: boolean;
  }
): Promise<void> => {
  await openTab(page, 'init');
  await page.getByTestId('init-appkey-input').fill(overrides?.appKey ?? config.appKey);
  const enableUserInfoSyncCheckbox = page.getByTestId('init-enable-user-info-sync-checkbox');
  if (overrides?.enableUserInfoSync !== undefined) {
    if (overrides.enableUserInfoSync) {
      await enableUserInfoSyncCheckbox.check();
    } else {
      await enableUserInfoSyncCheckbox.uncheck();
    }
  }
  const dnsToggle = page.getByTestId('init-use-http-dns-checkbox');
  if (await dnsToggle.isVisible()) {
    const wantDnsConfig = overrides?.useDnsConfig ?? (await dnsToggle.isChecked());
    const currentlyChecked = await dnsToggle.isChecked();
    if (wantDnsConfig !== currentlyChecked) {
      await dnsToggle.click();
    }
    if (wantDnsConfig) {
      await page.getByTestId('init-dns-input').fill('');
    } else {
      if (overrides?.restUrl !== undefined) {
        await page.getByTestId('init-rest-url-input').fill(overrides.restUrl);
      }
      if (overrides?.wsUrl !== undefined) {
        await page.getByTestId('init-ws-url-input').fill(overrides.wsUrl);
      }
      if (overrides?.syncWsUrl !== undefined) {
        await page.getByTestId('init-sync-ws-url-input').fill(overrides.syncWsUrl);
      }
    }
  }
  await page.getByTestId('init-submit-button').click();
  await expectInitialized(page, true);
};

export const runLogin = async (
  page: Page,
  config: RealEnvConfig,
  overrides?: { userId?: string; token?: string }
): Promise<void> => {
  await openTab(page, 'init');
  await page.getByTestId('login-userid-input').fill(overrides?.userId ?? config.userId);
  await page.getByTestId('login-token-input').fill(overrides?.token ?? config.token);
  await page.getByTestId('login-submit-button').click();
};

export const runInitAndLogin = async (
  page: Page,
  config: RealEnvConfig,
  overrides?: {
    appKey?: string;
    userId?: string;
    token?: string;
    restUrl?: string;
    wsUrl?: string;
    syncWsUrl?: string;
    useDnsConfig?: boolean;
    enableUserInfoSync?: boolean;
  }
): Promise<void> => {
  await runInit(page, config, {
    appKey: overrides?.appKey,
    restUrl: overrides?.restUrl,
    wsUrl: overrides?.wsUrl,
    syncWsUrl: overrides?.syncWsUrl,
    useDnsConfig: overrides?.useDnsConfig,
    enableUserInfoSync: overrides?.enableUserInfoSync,
  });
  await runLogin(page, config, {
    userId: overrides?.userId,
    token: overrides?.token,
  });
};

export const waitForLoginSuccess = async (page: Page, config: RealEnvConfig): Promise<void> => {
  try {
    await expectConnectionState(page, 'connected', { timeout: REAL_ENV_LOGIN_TIMEOUT });
    await expectCurrentUser(page, config.userId, { timeout: REAL_ENV_LOGIN_TIMEOUT });
    await openTab(page, 'log');
    await expect(page.getByTestId('log-list')).toContainText('登录成功', {
      timeout: REAL_ENV_LOGIN_TIMEOUT,
    });
  } catch (error) {
    const diagnosis = await buildLoginFailureDiagnosis(page);
    const originalMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`真实环境登录未成功。${diagnosis}\n原始断言: ${originalMessage}`);
  }
};

export const waitForLoginSuccessAs = async (page: Page, userId: string): Promise<void> => {
  try {
    await expectConnectionState(page, 'connected', { timeout: REAL_ENV_LOGIN_TIMEOUT });
    await expectCurrentUser(page, userId, { timeout: REAL_ENV_LOGIN_TIMEOUT });
    await openTab(page, 'log');
    await expect(page.getByTestId('log-list')).toContainText('登录成功', {
      timeout: REAL_ENV_LOGIN_TIMEOUT,
    });
  } catch (error) {
    const diagnosis = await buildLoginFailureDiagnosis(page);
    const originalMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`真实环境登录未成功。${diagnosis}\n原始断言: ${originalMessage}`);
  }
};

export const waitForLoginFailure = async (page: Page): Promise<void> => {
  await openTab(page, 'log');
  await expect(page.getByTestId('log-list')).toContainText('登录失败', { timeout: 30000 });
  const state = await readConnectionState(page);
  expect(state).not.toBe('connected');
};

export const sendTextMessage = async (
  page: Page,
  config: RealEnvConfig,
  messageText: string
): Promise<void> => {
  await openTab(page, 'send');
  await page.getByTestId('send-message-type-select').selectOption('text');
  await page.getByTestId('send-channel-type-select').selectOption('single');
  await page.getByTestId('send-targetid-input').fill(config.targetId ?? config.userId);
  await page.getByTestId('send-text-input').fill(messageText);
  await page.getByTestId('send-submit-button').click();
};

export const sendGroupTextMessage = async (
  page: Page,
  groupId: string,
  messageText: string
): Promise<void> => {
  await openTab(page, 'send');
  await page.getByTestId('send-message-type-select').selectOption('text');
  await page.getByTestId('send-channel-type-select').selectOption('group');
  await page.getByTestId('send-targetid-input').fill(groupId);
  await page.getByTestId('send-text-input').fill(messageText);
  await page.getByTestId('send-submit-button').click();
};

export const sendVoiceMessage = async (
  page: Page,
  config: RealEnvConfig,
  filePath: string,
  durationSeconds: number
): Promise<void> => {
  await openTab(page, 'send');
  await page.getByTestId('send-message-type-select').selectOption('voice');
  await page.getByTestId('send-channel-type-select').selectOption('single');
  await page.getByTestId('send-targetid-input').fill(config.targetId ?? config.userId);
  await page.getByTestId('send-voice-file-input').setInputFiles(filePath);
  await page.getByTestId('send-voice-duration-input').fill(String(durationSeconds));
  await page.getByTestId('send-submit-button').click();
};

export const updateOwnGroupNamecard = async (
  page: Page,
  groupId: string,
  userId: string,
  namecard: string
): Promise<void> => {
  await openTab(page, 'profileSync');
  await page.locator('#profile-sync-group-id').fill(groupId);
  await page.locator('#profile-sync-group-user-id').fill(userId);
  await page.locator('#profile-sync-group-namecard').fill(namecard);
  await page.getByRole('button', { name: '更新群名片', exact: true }).click();
  await openTab(page, 'log');
  await expect(page.getByTestId('log-list')).toContainText('更新群名片成功');
};

export const markConversationRead = async (page: Page): Promise<void> => {
  await openTab(page, 'send');
  await page.getByTestId('send-mark-conversation-read-button').click();
};

export const waitForSendSuccess = async (page: Page, messageText: string): Promise<void> => {
  await openTab(page, 'log');
  await expect(page.getByTestId('log-list')).toContainText('本次发送成功');
  await openTab(page, 'message');
  await expect(page.getByTestId('message-list')).toContainText(messageText);
  await expect(page.getByTestId('message-list')).toContainText('状态: sent');
};

export const waitForVoiceSendSuccess = async (page: Page, filename: string): Promise<void> => {
  await openTab(page, 'log');
  await expect(page.getByTestId('log-list')).toContainText('本次发送成功');
  await openTab(page, 'message');
  await expect(page.getByTestId('message-list')).toContainText('类型: 语音');
  await expect(page.getByTestId('message-list')).toContainText(filename);
  await expect(page.getByTestId('message-list')).toContainText('状态: sent');
};

export const waitForMarkConversationReadSuccess = async (page: Page): Promise<void> => {
  await openTab(page, 'log');
  await expect(page.getByTestId('log-list')).toContainText('会话已读标记成功');
};

export const runLogout = async (page: Page): Promise<void> => {
  await openTab(page, 'init');
  await page.getByTestId('logout-button').click();
};

export const waitForLogoutSuccess = async (page: Page): Promise<void> => {
  await expectConnectionState(page, 'disconnected');
  await expectNoCurrentUser(page);
  await openTab(page, 'log');
  await expect(page.getByTestId('log-list')).toContainText('登出成功');
};
