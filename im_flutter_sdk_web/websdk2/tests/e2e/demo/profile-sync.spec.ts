import { expect, test } from '@playwright/test';
import {
  buildMessageText,
  openDemo,
  openTab,
  requireRealEnvE2EConfig,
  runLogin,
  sendTextMessage,
  waitForLoginSuccess,
  waitForSendSuccess,
} from '../fixtures/sdk-flow';

test.describe('E2E 真实 demo 资料补位', () => {
  test('enableUserInfoSync 开启后应在资料补位页展示消息版本信息', async ({ page }) => {
    const config = requireRealEnvE2EConfig();
    const messageText = buildMessageText();

    await openDemo(page);

    await openTab(page, 'init');
    const enableUserInfoSync = page.getByTestId('init-enable-user-info-sync-checkbox');
    if (!(await enableUserInfoSync.isChecked())) {
      await enableUserInfoSync.check();
    }
    await page.getByTestId('init-appkey-input').fill(config.appKey);
    await page.getByTestId('init-submit-button').click();
    await expect(page.getByTestId('demo-initialized')).toContainText('true');

    await runLogin(page, config);
    await waitForLoginSuccess(page, config);

    await sendTextMessage(page, config, messageText);
    await waitForSendSuccess(page, messageText);

    await openTab(page, 'profileSync');
    await expect(page.getByText('enableUserInfoSync', { exact: true })).toBeVisible();
    await expect(page.getByText('enableUserInfoSync开启')).toBeVisible();
    await expect(page.getByText(/userInfoUpdateTime=/).first()).toBeVisible();
    await expect(page.getByText(/lastMessage\.userInfoUpdateTime=/).first()).toBeVisible();
  });
});
