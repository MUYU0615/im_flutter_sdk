import { expect, test } from '@playwright/test';
import {
  openDemo,
  openTab,
  requireRealEnvE2EConfig,
  runInitAndLogin,
  sendVoiceMessage,
  waitForLoginSuccess,
  waitForVoiceSendSuccess,
} from '../fixtures/sdk-flow';

test.describe('E2E 真实 demo 语音转文字', () => {
  test.skip(true, '依赖本地私有音频样本文件，仓库内未提供稳定测试资源，暂不纳入稳定 E2E');

  test('语音转文字 tab 应真实触发 voiceMessageToText / voiceFileToText 并展示结果', async ({
    page,
  }) => {
    const config = requireRealEnvE2EConfig();
    const voiceSamplePath = '/Users/wangmeng/Downloads/1775724381884.amr';
    const voiceSampleFilename = '1775724381884.amr';
    await openDemo(page);
    await runInitAndLogin(page, config);
    await waitForLoginSuccess(page, config);
    await sendVoiceMessage(page, config, voiceSamplePath, 3);
    await waitForVoiceSendSuccess(page, voiceSampleFilename);

    await openTab(page, 'voice-to-text');
    await expect(page.getByTestId('voice-to-text-panel')).toBeVisible();
    await expect(page.getByTestId('voice-to-text-message-select')).toBeVisible();
    await expect(page.getByTestId('voice-to-text-file-input')).toBeVisible();
    await expect(page.getByTestId('voice-to-text-result')).toBeVisible();
    await expect(page.getByTestId('voice-to-text-error')).toBeVisible();

    const resultArea = page.getByTestId('voice-to-text-result');
    const errorArea = page.getByTestId('voice-to-text-error');

    const messageSelect = page.getByTestId('voice-to-text-message-select');
    const messageOptions = messageSelect.locator('option');
    await expect(messageOptions).toContainText(['1775724381884.amr']);
    const messageOptionValue =
      (await messageOptions
        .filter({ hasText: '1775724381884.amr' })
        .first()
        .getAttribute('value')) ?? '';
    await messageSelect.selectOption(messageOptionValue);
    await page.getByTestId('voice-to-text-message-button').click();
    await expect(resultArea).not.toHaveText('暂无转写结果');
    await expect(resultArea).toContainText(/./);
    await expect(errorArea).toContainText('暂无错误');

    await page.getByTestId('voice-to-text-file-input').setInputFiles(voiceSamplePath);
    await page.getByTestId('voice-to-text-format-input').fill('amr');
    await page.getByTestId('voice-to-text-file-button').click();
    await expect(resultArea).not.toHaveText('暂无转写结果');
    await expect(resultArea).toContainText(/./);
    await expect(errorArea).toContainText('暂无错误');
    await expect(page.getByTestId('voice-to-text-meta')).toContainText('voiceFileToText');
  });
});
