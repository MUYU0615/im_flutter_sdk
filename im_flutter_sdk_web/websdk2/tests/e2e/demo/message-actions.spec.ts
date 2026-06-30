import { test } from '@playwright/test';
import {
  buildMessageText,
  markConversationRead,
  openDemo,
  requireRealEnvE2EConfig,
  runInitAndLogin,
  sendTextMessage,
  waitForLoginSuccess,
  waitForMarkConversationReadSuccess,
  waitForSendSuccess,
} from '../fixtures/sdk-flow';

test.describe('E2E 真实 demo 消息动作', () => {
  test('文本消息发送后应可通过 ChatManager 标记当前会话已读', async ({ page }) => {
    const config = requireRealEnvE2EConfig();
    const messageText = buildMessageText();
    await openDemo(page);
    await runInitAndLogin(page, config);
    await waitForLoginSuccess(page, config);
    await sendTextMessage(page, config, messageText);
    await waitForSendSuccess(page, messageText);
    await markConversationRead(page);
    await waitForMarkConversationReadSuccess(page);
  });
});
