import { expect, test, type Page } from '@playwright/test';
import {
  buildGroupNamecard,
  buildMessageText,
  openDemo,
  openTab,
  requireRealEnvE2EConfig,
  runInitAndLogin,
  sendGroupTextMessage,
  updateOwnGroupNamecard,
  waitForLoginSuccessAs,
  waitForSendSuccess,
} from '../fixtures/sdk-flow';

const expectLogContains = async (page: Page, text: string): Promise<void> => {
  await openTab(page, 'log');
  await expect(page.getByTestId('log-list')).toContainText(text);
};

const expectSessionListContains = async (page: Page, groupId: string): Promise<void> => {
  await openTab(page, 'conversation');
  await expect(page.getByTestId('session-list-panel-list')).toContainText(groupId);
};

const expectConversationListSenderHydrated = async (
  page: Page,
  groupId: string
): Promise<void> => {
  await openTab(page, 'profileSync');
  const summaryCard = page
    .locator('.card')
    .filter({ hasText: '会话列表 sender 调试' })
    .locator('.profile-sync-item')
    .filter({ hasText: `${groupId} / groupChat` })
    .first();
  await expect(summaryCard).toBeVisible();
  await expect
    .poll(
      async (): Promise<string> => {
        return (await summaryCard.textContent()) ?? '';
      },
      {
        timeout: 30_000,
      }
    )
    .toMatch(/lastMessage\.sender\.(nickname|avatarUrl)=(?!-)/);
};

test.describe('E2E 真实 demo 群资料补位与会话刷新收敛', () => {
  test('群名片更新后应驱动 031 补位并在 035 refresh 后保留群会话', async ({
    browser,
  }) => {
    const config = requireRealEnvE2EConfig();
    const actorUserId = config.secondUserId;
    const actorToken = config.secondToken;
    const observerUserId = config.userId;
    const groupId = config.groupId;

    test.skip(
      !actorUserId || !actorToken || !groupId,
      '真实环境 E2E 缺少 EASEMOB_SECOND_USERID / EASEMOB_SECOND_TOKEN / EASEMOB_GROUP_ID'
    );

    const actorMessageText = buildMessageText();
    const groupNamecard = buildGroupNamecard();
    const actorContext = await browser.newContext();
    const observerContext = await browser.newContext();
    const actorPage = await actorContext.newPage();
    const observerPage = await observerContext.newPage();

    try {
      await openDemo(actorPage);
      await openDemo(observerPage);

      await runInitAndLogin(actorPage, config, {
        userId: actorUserId ?? undefined,
        token: actorToken ?? undefined,
        enableUserInfoSync: true,
      });
      await runInitAndLogin(observerPage, config, {
        enableUserInfoSync: true,
      });

      await waitForLoginSuccessAs(actorPage, actorUserId ?? '');
      await waitForLoginSuccessAs(observerPage, observerUserId);

      await updateOwnGroupNamecard(actorPage, groupId ?? '', actorUserId ?? '', groupNamecard);
      await sendGroupTextMessage(actorPage, groupId ?? '', actorMessageText);
      await waitForSendSuccess(actorPage, actorMessageText);

      await expectLogContains(observerPage, '收到消息:');
      await expectLogContains(observerPage, '会话列表更新: message');
      await expectLogContains(observerPage, 'onUserGroupNamecardUpdated');

      await openTab(observerPage, 'profileSync');
      const groupEventCard = observerPage.getByText(`groupId=${groupId} userId=${actorUserId}`);
      await expect(groupEventCard).toBeVisible();
      await expect(
        observerPage.locator('.profile-sync-item-json').filter({ hasText: `namecard=${groupNamecard}` })
      ).toBeVisible();

      await observerPage.locator('#profile-sync-group-id').fill(groupId ?? '');
      await observerPage.locator('#profile-sync-cache-keyword').fill(actorUserId ?? '');
      await expect(
        observerPage.locator('.profile-sync-item-meta').filter({ hasText: `namecard=${groupNamecard}` }).first()
      ).toBeVisible();
      await expect(observerPage.getByText(/namecardUpdateTime=(?!-)/).first()).toBeVisible();
      await expectConversationListSenderHydrated(observerPage, groupId ?? '');

      await expectSessionListContains(observerPage, groupId ?? '');
      await expect(observerPage.getByTestId('legacy-conversation-list')).toContainText(groupId ?? '');

      await openTab(observerPage, 'conversation');
      await observerPage.getByRole('button', { name: 'refreshSessionList' }).click();
      await expectLogContains(observerPage, 'onSyncDataStart(conversation)');
      await expectLogContains(observerPage, 'onSyncDataFinished(conversation)');
      await expectSessionListContains(observerPage, groupId ?? '');
    } finally {
      await actorContext.close();
      await observerContext.close();
    }
  });
});
