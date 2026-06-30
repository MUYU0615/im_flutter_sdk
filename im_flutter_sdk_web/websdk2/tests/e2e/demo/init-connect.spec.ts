import { test } from '@playwright/test';
import {
  buildInvalidAppKey,
  openDemo,
  requireRealEnvE2EConfig,
  runInitAndLogin,
  waitForLoginFailure,
  waitForLoginSuccess,
} from '../fixtures/sdk-flow';

test.describe('E2E 真实 demo 初始化与登录', () => {
  test('应使用真实环境完成初始化与登录连接', async ({ page }) => {
    const config = requireRealEnvE2EConfig();
    await openDemo(page);
    await runInitAndLogin(page, config);
    await waitForLoginSuccess(page, config);
  });

  test('无效 AppKey 登录应失败且不应进入已连接状态', async ({ page }) => {
    const config = requireRealEnvE2EConfig();
    await openDemo(page);
    await runInitAndLogin(page, config, {
      appKey: buildInvalidAppKey(config),
      useDnsConfig: false,
    });
    await waitForLoginFailure(page);
  });
});
