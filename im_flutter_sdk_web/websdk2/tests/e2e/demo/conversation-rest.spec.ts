import { expect, test, type Page } from '@playwright/test';
import {
  buildMessageText,
  openDemo,
  openTab,
  requireRealEnvE2EConfig,
  runInitAndLogin,
  sendTextMessage,
  waitForLoginSuccess,
  waitForSendSuccess,
} from '../fixtures/sdk-flow';

const REAL_ENV_OPERATION_TIMEOUT = 30_000;

const extractSentMessageId = async (page: Page): Promise<string> => {
  await openTab(page, 'log');
  const logText = await page.getByTestId('log-list').innerText();
  const match = logText.match(/本次发送成功:\s*([^\s]+)/);
  if (!match?.[1]) {
    throw new Error(`未在日志中找到发送成功的 messageId。当前日志: ${logText}`);
  }
  return match[1];
};

const expectLogContains = async (page: Page, text: string): Promise<void> => {
  await openTab(page, 'log');
  await expect(page.getByTestId('log-list')).toContainText(text, {
    timeout: REAL_ENV_OPERATION_TIMEOUT,
  });
};

const clickConversationButton = async (page: Page, name: string): Promise<void> => {
  await openTab(page, 'conversation');
  const button = page.getByRole('button', { name, exact: true });
  await expect(button).toBeEnabled({ timeout: REAL_ENV_OPERATION_TIMEOUT });
  await button.click();
};

test.describe('E2E 真实 demo 会话 REST 与消息置顶', () => {
  test('发送消息后应可在页面中执行会话列表与消息置顶相关操作', async ({ page }) => {
    const config = requireRealEnvE2EConfig();
    const targetId = config.targetId ?? config.userId;
    const messageText = buildMessageText();

    await openDemo(page);
    await runInitAndLogin(page, config);
    await waitForLoginSuccess(page, config);
    await sendTextMessage(page, config, messageText);
    await waitForSendSuccess(page, messageText);

    const messageId = await extractSentMessageId(page);

    await openTab(page, 'chat-manager');
    await page.getByLabel('目标 ID').fill(targetId);
    await page.getByLabel('消息 ID').fill(messageId);
    await page.getByLabel('会话类型').selectOption('singleChat');

    await page.getByRole('button', { name: 'pinMessage', exact: true }).click();
    await expectLogContains(page, 'pinMessage ✅');
    await expectLogContains(page, `"messageId":"${messageId}"`);

    await openTab(page, 'chat-manager');
    await page.getByRole('button', { name: 'getPinnedMessageList', exact: true }).click();
    await expectLogContains(page, 'getPinnedMessageList ✅');
    await expectLogContains(page, `"messageId":"${messageId}"`);

    await openTab(page, 'conversation');
    await page.locator('#conversation-id').fill(targetId);
    await page.locator('#conversation-type').selectOption('singleChat');

    await page.getByRole('button', { name: 'getConversationList', exact: true }).click();
    await expectLogContains(page, 'getConversationList成功');
    await openTab(page, 'conversation');
    await expect(page.getByTestId('legacy-conversation-list')).toContainText(targetId);

    await clickConversationButton(page, 'setConversationPinned(true)');
    await expectLogContains(page, 'setConversationPinned(true)成功');

    await clickConversationButton(page, 'getPinnedConversationList');
    await expectLogContains(page, 'getPinnedConversationList成功');

    await openTab(page, 'chat-manager');
    await page.getByRole('button', { name: 'unpinMessage', exact: true }).click();
    await expectLogContains(page, 'unpinMessage ✅');

    await clickConversationButton(page, 'setConversationPinned(false)');
    await expectLogContains(page, 'setConversationPinned(false)成功');
  });
});
