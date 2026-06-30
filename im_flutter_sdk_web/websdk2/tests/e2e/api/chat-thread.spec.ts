import { test, expect } from '../fixtures/sdk-api';
import { resolveRealEnvConfig } from '../../test-utils/layered/real-env-runner';

const config = resolveRealEnvConfig();
const threadE2EEnabled =
  Boolean(config?.secondUserId && config?.secondToken) &&
  process.env.EASEMOB_CHAT_THREAD_E2E === '1';
const describeThread = threadE2EEnabled ? test.describe : test.describe.skip;

type ThreadDetailPayload = {
  readonly chatThreadId: string;
  readonly parentId: string;
  readonly name: string;
  readonly messageCount?: number;
};

type ThreadListPayload = {
  readonly items: ReadonlyArray<ThreadDetailPayload>;
  readonly cursor: string;
};

type ThreadEventPayload = {
  readonly chatThreadId: string;
  readonly parentId: string;
  readonly chatThreadName?: string;
  readonly memberId?: string;
};

const createGroup = async (
  userPage: { evaluate: <T>(fn: (arg: T) => Promise<unknown>, arg: T) => Promise<unknown> },
  params: { readonly memberId: string; readonly name: string }
): Promise<string> => {
  const result = (await userPage.evaluate(
    async ({ memberId, name }) => {
      return (window.__CLIENT__ as any).groupManager.createGroup({
        name,
        description: 'for chat-thread e2e',
        memberIds: [memberId],
        public: true,
        joinApprovalRequired: false,
        inviteNeedConfirm: false,
        allowInvites: true,
        maxMembers: 200,
      });
    },
    params
  )) as { groupId: string };
  return result.groupId;
};

const destroyGroup = async (
  userPage: { evaluate: <T>(fn: (arg: T) => Promise<void>, arg: T) => Promise<void> },
  groupId: string | null
): Promise<void> => {
  if (!groupId) {
    return;
  }
  await userPage.evaluate(async id => {
    try {
      await (window.__CLIENT__ as any).groupManager.destroyGroup({ groupId: id });
    } catch {}
  }, groupId);
};

describeThread('chat-thread - 子区公开 API', () => {
  let groupId: string | null = null;
  let threadId: string | null = null;

  test.beforeEach(async ({ userA, userB }) => {
    groupId = await createGroup(userA.page, {
      memberId: userB.userId,
      name: `e2e-thread-group-${Date.now()}`,
    });
    await userA.page.waitForTimeout(3000);
    await userA.clearEvents();
    await userB.clearEvents();
  });

  test.afterEach(async ({ userA }) => {
    if (threadId) {
      await userA.page.evaluate(async id => {
        try {
          await (window.__CLIENT__ as any).chatThreadManager.destroyChatThread({
            chatThreadId: id,
          });
        } catch {}
      }, threadId);
      threadId = null;
    }
    await destroyGroup(userA.page, groupId);
    groupId = null;
  });

  test('create/list/detail/update/destroy 与 4 事件采集主路径', async ({ userA, userB }) => {
    const created = (await userA.page.evaluate(async groupIdValue => {
      const client = window.__CLIENT__ as any;
      const message = client.chatManager.createTextMessage({
        conversationId: groupIdValue,
        conversationType: 'groupChat',
        content: `thread-parent-${Date.now()}`,
      });
      const sent = await client.chatManager.sendMessage(message);
      return client.chatThreadManager.createChatThread({
        parentId: groupIdValue,
        name: 'topic-1',
        messageId: sent.msgServerId,
      });
    }, groupId!)) as { chatThreadId: string };
    threadId = created.chatThreadId;

    expect(threadId).toBeTruthy();

    const createdEvent = await userB.waitForEventMatching<ThreadEventPayload>(
      'onChatThreadCreated',
      payload => payload.chatThreadId === threadId && payload.parentId === groupId,
      15000
    );
    expect(createdEvent.chatThreadName).toBe('topic-1');

    const list = (await userA.page.evaluate(async groupIdValue => {
      return (window.__CLIENT__ as any).chatThreadManager.getChatThreadList({
        parentId: groupIdValue,
        pageSize: 20,
      });
    }, groupId!)) as ThreadListPayload;
    expect(list.items.some(item => item.chatThreadId === threadId)).toBe(true);

    const detail = (await userA.page.evaluate(async chatThreadId => {
      return (window.__CLIENT__ as any).chatThreadManager.getChatThreadInfo({ chatThreadId });
    }, threadId)) as ThreadDetailPayload;
    expect(detail).toMatchObject({
      chatThreadId: threadId,
      parentId: groupId,
      name: 'topic-1',
    });

    const handleInfo = (await userA.page.evaluate(async chatThreadId => {
      const thread = (window.__CLIENT__ as any).chatThreadManager.getChatThread(chatThreadId);
      return {
        id: thread.chatThreadId,
        info: await thread.getInfo(),
      };
    }, threadId)) as { id: string; info: ThreadDetailPayload };
    expect(handleInfo.id).toBe(threadId);
    expect(handleInfo.info.chatThreadId).toBe(threadId);

    await userA.page.evaluate(async chatThreadId => {
      await (window.__CLIENT__ as any).chatThreadManager.updateChatThreadName({
        chatThreadId,
        name: 'topic-2',
      });
    }, threadId);
    const updatedEvent = await userB.waitForEventMatching<ThreadEventPayload>(
      'onChatThreadUpdated',
      payload => payload.chatThreadId === threadId && payload.parentId === groupId,
      15000
    );
    expect(updatedEvent.chatThreadName).toBe('topic-2');

    const members = (await userA.page.evaluate(async chatThreadId => {
      return (window.__CLIENT__ as any).chatThreadManager.getChatThreadMemberList({
        chatThreadId,
        pageSize: 20,
      });
    }, threadId)) as { items: ReadonlyArray<{ memberId: string }> };
    expect(members.items.some(item => item.memberId === userA.userId)).toBe(true);

    await userA.page.evaluate(async ({ chatThreadId, memberId }) => {
      await (window.__CLIENT__ as any).chatThreadManager.removeChatThreadMember({
        chatThreadId,
        memberId,
      });
    }, { chatThreadId: threadId, memberId: userB.userId });
    const removedEvent = await userB.waitForEventMatching<ThreadEventPayload>(
      'onChatThreadUserRemoved',
      payload => payload.chatThreadId === threadId && payload.memberId === userB.userId,
      15000
    );
    expect(removedEvent.parentId).toBe(groupId);

    await userA.page.evaluate(async chatThreadId => {
      await (window.__CLIENT__ as any).chatThreadManager.destroyChatThread({ chatThreadId });
    }, threadId);
    const destroyedEvent = await userB.waitForEventMatching<ThreadEventPayload>(
      'onChatThreadDestroyed',
      payload => payload.chatThreadId === threadId && payload.parentId === groupId,
      15000
    );
    expect(destroyedEvent.chatThreadId).toBe(threadId);
    threadId = null;
  });
});
