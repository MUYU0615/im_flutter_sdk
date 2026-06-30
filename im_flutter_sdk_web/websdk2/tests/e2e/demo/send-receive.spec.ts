import { test } from '@playwright/test';
import {
  buildMessageText,
  openDemo,
  requireRealEnvE2EConfig,
  runInitAndLogin,
  sendTextMessage,
  waitForLoginSuccess,
  waitForSendSuccess,
} from '../fixtures/sdk-flow';

test.describe('E2E 真实 demo 消息发送', () => {
  test('文本消息发送完成后应在日志与消息列表中可见', async ({ page }) => {
    const config = requireRealEnvE2EConfig();
    const messageText = buildMessageText();
    await openDemo(page);
    await runInitAndLogin(page, config);
    await waitForLoginSuccess(page, config);
    await sendTextMessage(page, config, messageText);
    await waitForSendSuccess(page, messageText);
  });
});
