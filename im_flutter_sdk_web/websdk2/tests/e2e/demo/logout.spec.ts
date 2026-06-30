import { test } from '@playwright/test';
import {
  openDemo,
  requireRealEnvE2EConfig,
  runInitAndLogin,
  runLogout,
  waitForLoginSuccess,
  waitForLogoutSuccess,
} from '../fixtures/sdk-flow';

test.describe('E2E 真实 demo 登出链路', () => {
  test('登录成功后登出应恢复为未连接状态', async ({ page }) => {
    const config = requireRealEnvE2EConfig();
    await openDemo(page);
    await runInitAndLogin(page, config);
    await waitForLoginSuccess(page, config);
    await runLogout(page);
    await waitForLogoutSuccess(page);
  });
});
