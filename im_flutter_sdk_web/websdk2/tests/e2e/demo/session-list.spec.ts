import { expect, test } from '@playwright/test';
import {
  openDemo,
  openTab,
  requireRealEnvE2EConfig,
  runInitAndLogin,
  runLogin,
  waitForLoginSuccess,
} from '../fixtures/sdk-flow';

const expectLogContains = async (
  page: import('@playwright/test').Page,
  text: string
): Promise<void> => {
  await openTab(page, 'log');
  await expect(page.getByTestId('log-list')).toContainText(text);
};

test.describe('E2E demo ConversationItem 面板', () => {
  test.skip(true, '依赖真实环境 token 登录，当前 token 每日变化，暂不纳入稳定 E2E');

  test('登录后应可看到 ConversationItem 面板并触发 refreshSessionList', async ({ page }) => {
    const config = requireRealEnvE2EConfig();

    await openDemo(page);
    await runInitAndLogin(page, config);
    await waitForLoginSuccess(page, config);

    await openTab(page, 'conversation');
    const sessionListCard = page.getByTestId('session-list-panel');
    await expect(sessionListCard.getByText('新会话列表 ConversationItem')).toBeVisible();
    await expect(
      sessionListCard.getByText(
        '说明：本面板展示 035 新链路的 ConversationItem 读取结果；旧会话列表仍保留在“会话列表”面板。'
      )
    ).toBeVisible();
    await expect(
      sessionListCard.getByText(/capability:\s*(unknown|available|syncing)/)
    ).toBeVisible();
    await expect(
      page.getByText(
        '这是旧会话列表能力面板；035 新 ConversationItem 面板会与本面板并行展示，便于对照联调。'
      )
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'refreshSessionList' })).toBeVisible();

    await page.getByRole('button', { name: 'refreshSessionList' }).click();
    await expectLogContains(page, 'onSyncDataStart(conversation)');
    await expectLogContains(page, 'onSyncDataFinished(conversation)');
    await expectLogContains(page, 'refreshSessionList');
  });

  test('未配置 syncWsUrl 时应走 fallback 并显示 unconfigured capability', async ({ page }) => {
    const config = requireRealEnvE2EConfig();

    await openDemo(page);
    await openTab(page, 'init');
    const useDnsConfigCheckbox = page.getByTestId('init-use-http-dns-checkbox');
    if (await useDnsConfigCheckbox.isChecked()) {
      await useDnsConfigCheckbox.uncheck();
    }
    await page.getByTestId('init-appkey-input').fill(config.appKey);
    await page.getByTestId('init-rest-url-input').fill('https://a1-hsb.easemob.com');
    await page.getByTestId('init-ws-url-input').fill('wss://im-api-new-hsb.easemob.com/websocket');
    await page.getByTestId('init-sync-ws-url-input').fill('');
    await page.getByTestId('init-submit-button').click();
    await runLogin(page, config);
    await waitForLoginSuccess(page, config);

    await openTab(page, 'conversation');
    await page.getByRole('button', { name: 'refreshSessionList' }).click();
    await expectLogContains(page, 'onSyncDataFinished(conversation)');
    await openTab(page, 'conversation');
    await expect(page.getByTestId('session-list-panel')).toContainText('capability: unconfigured');
  });
});
