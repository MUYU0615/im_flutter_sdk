/**
 * E2E 测试 - 聊天室管理
 * 迁移自 robot: wayang/TestCase/聊天室/聊天室操作.robot（Webim 标记用例）
 */
import { test, expect, type SDKUser } from '../fixtures/sdk-api';
import { resolveRealEnvConfig } from '../../test-utils/layered/real-env-runner';

const config = resolveRealEnvConfig();
const hasChatroom = Boolean(config?.chatroomId);
const describeChatroom = hasChatroom ? test.describe : test.describe.skip;

type CapturedOperationResult =
  | {
      ok: true;
      value: unknown;
    }
  | {
      ok: false;
      name: string;
      code: number;
      message: string;
      details: unknown;
    };

type ChatRoomEventUser = {
  userId: string;
};

type ChatRoomDetailPayload = {
  chatRoomId: string;
  name: string;
  description?: string;
  owner?: ChatRoomEventUser;
  memberCount?: number;
  maxMembers?: number;
  permissionType?: string;
  currentUserStatus?: {
    inAllowlist?: boolean;
    muted?: boolean;
    muteExpireAt?: number;
    permissionType?: string;
  };
};

type ChatRoomMemberEntryPayload = {
  user: ChatRoomEventUser;
  role?: string;
  joinedAt?: number;
};

type ChatRoomMemberActionResultPayload = {
  chatRoomId: string;
  user: ChatRoomEventUser;
  action: string;
  reason?: string;
};

type ChatRoomAttributeMutationResultPayload = {
  chatRoomId: string;
  appliedKeys: string[];
  failedKeys: Record<string, { code: number; message: string }>;
};

type ChatRoomMessagePayload<TBody extends Record<string, unknown>> = {
  readonly msgServerId: string;
  readonly msgLocalId?: string;
  readonly from: string;
  readonly to: string;
  readonly conversationId: string;
  readonly conversationType: string;
  readonly type: string;
  readonly status?: string;
  readonly body: TBody;
  readonly timestamp?: number;
  readonly localTime?: number;
};

const waitForOptionalChatRoomEvent = async <T>(
  user: Pick<SDKUser, 'waitForEventMatching'>,
  eventName: string,
  predicate: (payload: T) => boolean,
  timeoutMs = 10000
): Promise<T | null> => {
  try {
    return await user.waitForEventMatching<T>(eventName, predicate, timeoutMs);
  } catch {
    return null;
  }
};

const getChatRoomId = (): string => {
  return resolveRealEnvConfig()!.chatroomId!;
};

const ensureMemberViaAdmin = async (owner: SDKUser, member: SDKUser): Promise<void> => {
  await owner.page.evaluate(
    async ({ chatRoomId, userId }) => {
      const mgr = (window.__CLIENT__ as any).chatRoomManager;
      try {
        await mgr.addAdmin({ chatRoomId, userId });
      } catch {}
      try {
        await mgr.removeAdmin({ chatRoomId, userId });
      } catch {}
    },
    { chatRoomId: getChatRoomId(), userId: member.userId }
  );
};

const cleanupMemberState = async (owner: SDKUser, member: SDKUser): Promise<void> => {
  await owner.page.evaluate(
    async ({ chatRoomId, userId }) => {
      const mgr = (window.__CLIENT__ as any).chatRoomManager;
      try {
        await mgr.unmuteAllMembers({ chatRoomId });
      } catch {}
      try {
        await mgr.unmuteMembers({ chatRoomId, userIds: [userId] });
      } catch {}
      try {
        await mgr.removeUsersFromAllowlist({ chatRoomId, userIds: [userId] });
      } catch {}
      try {
        await mgr.unblockMembers({ chatRoomId, userIds: [userId] });
      } catch {}
      try {
        await mgr.removeAdmin({ chatRoomId, userId });
      } catch {}
      try {
        await mgr.removeMembers({ chatRoomId, userIds: [userId] });
      } catch {}
    },
    { chatRoomId: getChatRoomId(), userId: member.userId }
  );
};

const cleanupAttributes = async (owner: SDKUser, keys: ReadonlyArray<string>): Promise<void> => {
  if (keys.length === 0) {
    return;
  }
  await owner.page.evaluate(
    async ({ chatRoomId, keys }) => {
      try {
        await (window.__CLIENT__ as any).chatRoomManager.removeAttributes({
          chatRoomId,
          keys,
          isForced: true,
        });
      } catch {}
    },
    { chatRoomId: getChatRoomId(), keys }
  );
};

const expectSingleMemberAction = (
  result: { succeeded: ChatRoomMemberActionResultPayload[]; failed: ChatRoomMemberActionResultPayload[] },
  expected: {
    chatRoomId: string;
    userId: string;
    action: string;
  }
): void => {
  expect(result.failed).toEqual([]);
  expect(result.succeeded).toHaveLength(1);
  expect(result.succeeded[0]).toMatchObject({
    chatRoomId: expected.chatRoomId,
    user: { userId: expected.userId },
    action: expected.action,
  });
};

const expectChatRoomMessageDynamicFields = (
  message: Pick<
    ChatRoomMessagePayload<Record<string, unknown>>,
    'msgServerId' | 'msgLocalId' | 'timestamp' | 'localTime'
  >
): void => {
  expect(message.msgServerId.length).toBeGreaterThan(0);
  if (message.msgLocalId !== undefined) {
    expect(typeof message.msgLocalId).toBe('string');
  }
  if (message.timestamp !== undefined) {
    expect(Number.isFinite(message.timestamp)).toBe(true);
    expect(message.timestamp).toBeGreaterThan(0);
  }
  if (message.localTime !== undefined) {
    expect(Number.isFinite(message.localTime)).toBe(true);
    expect(message.localTime).toBeGreaterThan(0);
  }
};

describeChatroom('chatroom - 聊天室管理', () => {
  test.beforeEach(async ({ userA, userB }) => {
    await cleanupMemberState(userA, userB);
    await userA.clearEvents();
    await userB.clearEvents();
  });

  test.afterEach(async ({ userA, userB }) => {
    await cleanupMemberState(userA, userB);
  });

  test('getChatRoomInfo 应返回聊天室详情标准结构', async ({ userA }) => {
    const cfg = resolveRealEnvConfig()!;
    const info = (await userA.page.evaluate(async (chatRoomId: string) => {
      return (window.__CLIENT__ as any).chatRoomManager.getChatRoomInfo({ chatRoomId });
    }, cfg.chatroomId!)) as ChatRoomDetailPayload;

    expect(info.chatRoomId).toBe(cfg.chatroomId);
    expect(typeof info.name).toBe('string');
    expect(info.name.length).toBeGreaterThan(0);
    expect(info.owner?.userId).toBe(userA.userId);
    if (typeof info.memberCount !== 'undefined') {
      expect(info.memberCount).toBeGreaterThanOrEqual(1);
    }
    if (typeof info.maxMembers !== 'undefined') {
      expect(info.maxMembers).toBeGreaterThan(0);
    }
    expect(info.currentUserStatus?.permissionType ?? info.permissionType).toBe('owner');
  });

  test('getChatRoomList 应返回分页结构与聊天室摘要', async ({ userA }) => {
    const cfg = resolveRealEnvConfig()!;
    const result = (await userA.page.evaluate(async () => {
      return (window.__CLIENT__ as any).chatRoomManager.getChatRoomList({ pageSize: 10 });
    })) as {
      items: Array<{
        chatRoomId: string;
        name: string;
        description?: string;
        owner?: ChatRoomEventUser;
      }>;
      pageNum?: number;
      pageSize?: number;
      total?: number;
      hasMore?: boolean;
    };

    expect(Array.isArray(result.items)).toBe(true);
    if (typeof result.pageNum !== 'undefined') {
      expect(result.pageNum).toBeGreaterThanOrEqual(0);
    }
    if (typeof result.pageSize !== 'undefined') {
      expect(result.pageSize).toBeGreaterThan(0);
    }
    if (typeof result.total !== 'undefined') {
      expect(result.total).toBeGreaterThanOrEqual(0);
    }
    if (typeof result.hasMore !== 'undefined') {
      expect(typeof result.hasMore).toBe('boolean');
    }

    const current = result.items.find(item => item.chatRoomId === cfg.chatroomId);
    expect(current).toBeDefined();
    expect(current?.chatRoomId).toBe(cfg.chatroomId);
    expect(typeof current?.name).toBe('string');
    expect((current?.name ?? '').length).toBeGreaterThan(0);
  });

  test('getChatRoom handle 应绑定 chatRoomId 并代理详情、成员、公告与属性 API', async ({
    userA,
  }) => {
    const chatRoomId = getChatRoomId();
    const result = (await userA.page.evaluate(async (chatRoomId: string) => {
      const chatRoom = (window.__CLIENT__ as any).chatRoomManager.getChatRoom(chatRoomId);
      const detail = await chatRoom.getInfo();
      const members = await chatRoom.getMembers({ pageSize: 20 });
      const announcement = await chatRoom.getAnnouncement();
      const attributes = await chatRoom.getAttributes();
      return {
        chatRoomId: chatRoom.chatRoomId,
        methodTypes: {
          refresh: typeof chatRoom.refresh,
          updateInfo: typeof chatRoom.updateInfo,
          getMembers: typeof chatRoom.getMembers,
          getAnnouncement: typeof chatRoom.getAnnouncement,
          getAttributes: typeof chatRoom.getAttributes,
        },
        detail,
        members,
        announcement,
        attributes,
      };
    }, chatRoomId)) as {
      chatRoomId: string;
      methodTypes: Record<string, string>;
      detail: ChatRoomDetailPayload;
      members: { items: ChatRoomMemberEntryPayload[] };
      announcement: { chatRoomId: string; announcement: string };
      attributes: { chatRoomId: string; attributes: Record<string, string> };
    };

    expect(result.chatRoomId).toBe(chatRoomId);
    expect(result.methodTypes).toEqual({
      refresh: 'function',
      updateInfo: 'function',
      getMembers: 'function',
      getAnnouncement: 'function',
      getAttributes: 'function',
    });
    expect(result.detail).toMatchObject({
      chatRoomId,
      owner: { userId: userA.userId },
    });
    expect(result.members.items.map(item => item.user.userId)).toEqual([userA.userId]);
    expect(typeof result.announcement.announcement).toBe('string');
    expect(result.attributes.chatRoomId).toBe(chatRoomId);
    expect(typeof result.attributes.attributes).toBe('object');

    const error = (await userA.page.evaluate(() => {
      try {
        (window.__CLIENT__ as any).chatRoomManager.getChatRoom('   ');
        return null;
      } catch (e: any) {
        return {
          name: e.name,
          code: e.code,
          message: e.message,
          details: e.details,
        };
      }
    })) as CapturedOperationResult | null;

    expect(error).toMatchObject({
      name: 'ValidationError',
      code: 110,
      message: 'chatRoomId is required',
      details: {
        fields: [
          {
            path: 'chatRoomId',
            message: 'chatRoomId is required',
            rule: 'required',
          },
        ],
      },
    });
  });

  test('getChatRoomInfo / getMemberList 应返回详情与成员列表稳定字段', async ({
    userA,
  }) => {
    const chatRoomId = getChatRoomId();
    const result = (await userA.page.evaluate(async (chatRoomId: string) => {
      const mgr = (window.__CLIENT__ as any).chatRoomManager;
      const capture = async () => {
        try {
          await mgr.getChatRoomInfo({ chatRoomId: '' });
          return null;
        } catch (e: any) {
          return {
            name: e.name,
            code: e.code,
            message: e.message,
            details: e.details,
          };
        }
      };
      return {
        info: await mgr.getChatRoomInfo({ chatRoomId }),
        members: await mgr.getMemberList({ chatRoomId, pageSize: 20 }),
        error: await capture(),
      };
    }, chatRoomId)) as {
      info: ChatRoomDetailPayload;
      members: { items: ChatRoomMemberEntryPayload[]; cursor?: string; hasMore?: boolean };
      error: {
        name: string;
        code: number;
        message: string;
        details: unknown;
      } | null;
    };

    expect(result.info).toMatchObject({
      chatRoomId,
      owner: { userId: userA.userId },
    });
    expect(result.members.items.map(item => item.user.userId)).toEqual([userA.userId]);
    const ownerEntry = result.members.items.find(item => item.user.userId === userA.userId);
    expect(ownerEntry?.role).toBe('owner');
    if (ownerEntry?.joinedAt !== undefined) {
      expect(ownerEntry.joinedAt).toBeGreaterThan(0);
    }
    expect(typeof (result.members.cursor ?? '')).toBe('string');
    if (result.members.hasMore !== undefined) {
      expect(typeof result.members.hasMore).toBe('boolean');
    }
    expect(result.error).toMatchObject({
      name: 'ValidationError',
      code: 110,
      message: 'params.chatRoomId is required',
      details: {
        fields: [
          {
            path: 'params.chatRoomId',
            message: 'params.chatRoomId is required',
            rule: 'required',
          },
        ],
      },
    });
  });

  test('joinChatRoom/leaveChatRoom 应通过 WebSocket 加入退出并派发成员事件', async ({
    userA,
    userB,
  }) => {
    const chatRoomId = getChatRoomId();
    const ext = `join-ext-${Date.now()}`;
    await userA.clearEvents();
    await userB.clearEvents();

    await userB.page.evaluate(
      async ({ chatRoomId, ext }) => {
        await (window.__CLIENT__ as any).chatRoomManager.joinChatRoom({
          chatRoomId,
          ext,
          leaveOtherRooms: false,
        });
      },
      { chatRoomId, ext }
    );

    const joinEvent = await waitForOptionalChatRoomEvent<{
      chatRoomId: string;
      members: ChatRoomEventUser[];
      ext?: string;
    }>(userA, 'onMembersJoined', payload => payload.chatRoomId === chatRoomId);
    if (joinEvent) {
      expect(joinEvent).toMatchObject({
        chatRoomId,
        ext,
      });
      expect(joinEvent.members.map(item => item.userId)).toContain(userB.userId);
    }

    const membersAfterJoin = (await userA.page.evaluate(async (chatRoomId: string) => {
      return (window.__CLIENT__ as any).chatRoomManager.getMemberList({
        chatRoomId,
        pageSize: 20,
      });
    }, chatRoomId)) as { items: ChatRoomMemberEntryPayload[] };
    expect(membersAfterJoin.items.map(item => item.user.userId)).toContain(userB.userId);

    await userA.clearEvents();
    await userB.clearEvents();
    await userB.page.evaluate(async (chatRoomId: string) => {
      await (window.__CLIENT__ as any).chatRoomManager.leaveChatRoom({ chatRoomId });
    }, chatRoomId);

    const leaveEvent = await waitForOptionalChatRoomEvent<{
      chatRoomId: string;
      members: ChatRoomEventUser[];
    }>(userA, 'onMembersExited', payload => payload.chatRoomId === chatRoomId);
    if (leaveEvent) {
      expect(leaveEvent.chatRoomId).toBe(chatRoomId);
      expect(leaveEvent.members.map(item => item.userId)).toContain(userB.userId);
    }

    const membersAfterLeave = (await userA.page.evaluate(async (chatRoomId: string) => {
      return (window.__CLIENT__ as any).chatRoomManager.getMemberList({
        chatRoomId,
        pageSize: 20,
      });
    }, chatRoomId)) as { items: ChatRoomMemberEntryPayload[] };
    expect(membersAfterLeave.items.map(item => item.user.userId)).not.toContain(userB.userId);
  });

  test('joinChatRoom 参数应精确校验 ext 与 leaveOtherRooms', async ({ userB }) => {
    const chatRoomId = getChatRoomId();
    const result = (await userB.page.evaluate(async (chatRoomId: string) => {
      const mgr = (window.__CLIENT__ as any).chatRoomManager;
      const captureInvalidExt = async () => {
        try {
          await mgr.joinChatRoom({ chatRoomId, ext: 1 });
          return null;
        } catch (e: any) {
          return {
            name: e.name,
            code: e.code,
            message: e.message,
            details: e.details,
          };
        }
      };
      const captureInvalidLeaveOtherRooms = async () => {
        try {
          await mgr.joinChatRoom({ chatRoomId, leaveOtherRooms: 'yes' });
          return null;
        } catch (e: any) {
          return {
            name: e.name,
            code: e.code,
            message: e.message,
            details: e.details,
          };
        }
      };
      return {
        invalidExt: await captureInvalidExt(),
        invalidLeaveOtherRooms: await captureInvalidLeaveOtherRooms(),
      };
    }, chatRoomId)) as {
      invalidExt: CapturedOperationResult | null;
      invalidLeaveOtherRooms: CapturedOperationResult | null;
    };

    expect(result.invalidExt).toMatchObject({
      name: 'ValidationError',
      code: 110,
      message: 'params.ext must be a string',
      details: {
        fields: [
          {
            path: 'params.ext',
            message: 'params.ext must be a string',
            rule: 'invalid_format',
          },
        ],
      },
    });
    expect(result.invalidLeaveOtherRooms).toMatchObject({
      name: 'ValidationError',
      code: 110,
      message: 'params.leaveOtherRooms must be a boolean',
      details: {
        fields: [
          {
            path: 'params.leaveOtherRooms',
            message: 'params.leaveOtherRooms must be a boolean',
            rule: 'invalid_format',
          },
        ],
      },
    });
  });

  test('聊天室 text/cmd/custom 消息应向已加入成员派发 onMessage', async ({
    userA,
    userB,
  }) => {
    const chatRoomId = getChatRoomId();
    await userB.page.evaluate(async (chatRoomId: string) => {
      await (window.__CLIENT__ as any).chatRoomManager.joinChatRoom({ chatRoomId });
    }, chatRoomId);
    await userA.clearEvents();
    await userB.clearEvents();

    const textContent = `chatroom-text-${Date.now()}`;
    const textSent = (await userA.page.evaluate(
      async ({ chatRoomId, content }) => {
        const client = window.__CLIENT__ as any;
        const msg = client.chatManager.createTextMessage({
          conversationId: chatRoomId,
          conversationType: 'chatRoom',
          content,
        });
        return client.chatManager.sendMessage(msg);
      },
      { chatRoomId, content: textContent }
    )) as ChatRoomMessagePayload<{ content: string }>;
    expectChatRoomMessageDynamicFields(textSent);
    expect(textSent).toMatchObject({
      from: userA.userId,
      to: chatRoomId,
      conversationId: chatRoomId,
      conversationType: 'chatRoom',
      type: 'text',
      status: 'sent',
      body: { content: textContent },
    });
    const textReceived = await userB.waitForEventMatching<
      ChatRoomMessagePayload<{ content: string }>
    >('onMessage', payload => payload.msgServerId === textSent.msgServerId);
    expectChatRoomMessageDynamicFields(textReceived);
    expect(textReceived).toMatchObject({
      msgServerId: textSent.msgServerId,
      from: userA.userId,
      to: chatRoomId,
      conversationId: chatRoomId,
      conversationType: 'chatRoom',
      type: 'text',
      body: { content: textContent },
    });

    const cmdAction = `chatroom-cmd-${Date.now()}`;
    const cmdSent = (await userA.page.evaluate(
      async ({ chatRoomId, action }) => {
        const client = window.__CLIENT__ as any;
        const msg = client.chatManager.createCmdMessage({
          conversationId: chatRoomId,
          conversationType: 'chatRoom',
          action,
        });
        return client.chatManager.sendMessage(msg);
      },
      { chatRoomId, action: cmdAction }
    )) as ChatRoomMessagePayload<{ action: string }>;
    expectChatRoomMessageDynamicFields(cmdSent);
    const cmdReceived = await userB.waitForEventMatching<
      ChatRoomMessagePayload<{ action: string }>
    >('onMessage', payload => payload.msgServerId === cmdSent.msgServerId);
    expectChatRoomMessageDynamicFields(cmdReceived);
    expect(cmdReceived).toMatchObject({
      msgServerId: cmdSent.msgServerId,
      from: userA.userId,
      to: chatRoomId,
      conversationId: chatRoomId,
      conversationType: 'chatRoom',
      type: 'cmd',
      body: { action: cmdAction },
    });

    const customEvent = `chatroom-custom-${Date.now()}`;
    const customParams = { scene: 'chatroom', value: `${Date.now()}` };
    const customSent = (await userA.page.evaluate(
      async ({ chatRoomId, event, params }) => {
        const client = window.__CLIENT__ as any;
        const msg = client.chatManager.createCustomMessage({
          conversationId: chatRoomId,
          conversationType: 'chatRoom',
          event,
          params,
        });
        return client.chatManager.sendMessage(msg);
      },
      { chatRoomId, event: customEvent, params: customParams }
    )) as ChatRoomMessagePayload<{ event: string; params: Record<string, string> }>;
    expectChatRoomMessageDynamicFields(customSent);
    const customReceived = await userB.waitForEventMatching<
      ChatRoomMessagePayload<{ event: string; params: Record<string, string> }>
    >('onMessage', payload => payload.msgServerId === customSent.msgServerId);
    expectChatRoomMessageDynamicFields(customReceived);
    expect(customReceived).toMatchObject({
      msgServerId: customSent.msgServerId,
      from: userA.userId,
      to: chatRoomId,
      conversationId: chatRoomId,
      conversationType: 'chatRoom',
      type: 'custom',
      body: {
        event: customEvent,
        params: customParams,
      },
    });
  });

  test('updateChatRoomInfo 应更新详情并向成员派发 chat room info changed 事件', async ({
    userA,
    userB,
  }) => {
    const chatRoomId = getChatRoomId();
    const before = (await userA.page.evaluate(async (chatRoomId: string) => {
      return (window.__CLIENT__ as any).chatRoomManager.getChatRoomInfo({ chatRoomId });
    }, chatRoomId)) as ChatRoomDetailPayload;
    const nextName = `e2e-chatroom-${Date.now()}`;
    const nextDescription = `chatroom-desc-${Date.now()}`;
    const nextMaxMembers = Math.max(before.maxMembers ?? 200, 20);

    await userA.clearEvents();
    await userB.clearEvents();

    const updateResult = (await userA.page.evaluate(
      async ({ chatRoomId, name, description, maxMembers }) => {
        return (window.__CLIENT__ as any).chatRoomManager.updateChatRoomInfo({
          chatRoomId,
          name,
          description,
          maxMembers,
        });
      },
      {
        chatRoomId,
        name: nextName,
        description: nextDescription,
        maxMembers: nextMaxMembers,
      }
    )) as {
      nameUpdated?: boolean;
      descriptionUpdated?: boolean;
      maxMembersUpdated?: boolean;
    };
    expect(updateResult).toEqual({
      nameUpdated: true,
      descriptionUpdated: true,
      maxMembersUpdated: true,
    });

    const detail = (await userA.page.evaluate(async (chatRoomId: string) => {
      return (window.__CLIENT__ as any).chatRoomManager.getChatRoomInfo({ chatRoomId });
    }, chatRoomId)) as ChatRoomDetailPayload;
    expect(detail).toMatchObject({
      chatRoomId,
      name: nextName,
      description: nextDescription,
      owner: { userId: userA.userId },
    });
    expect(detail.maxMembers).toBe(nextMaxMembers);

    const event = await waitForOptionalChatRoomEvent<{
      chatRoomId: string;
      chatRoomInfo: ChatRoomDetailPayload;
    }>(userB, 'onChatRoomInfoChanged', payload => payload.chatRoomId === chatRoomId);
    if (event) {
      expect(event.chatRoomInfo).toMatchObject({
        chatRoomId,
        name: nextName,
        description: nextDescription,
      });
    }
  });

  test('addAdmin/getAdminList/removeAdmin 应更新管理员列表并派发事件', async ({
    userA,
    userB,
  }) => {
    const chatRoomId = getChatRoomId();
    await userA.clearEvents();
    await userB.clearEvents();

    await userA.page.evaluate(
      async ({ chatRoomId, userId }) => {
        await (window.__CLIENT__ as any).chatRoomManager.addAdmin({ chatRoomId, userId });
      },
      { chatRoomId, userId: userB.userId }
    );

    const added = await waitForOptionalChatRoomEvent<{
      chatRoomId: string;
      admin?: ChatRoomEventUser;
    }>(userB, 'onAdminAdded', payload => payload.chatRoomId === chatRoomId);
    if (added) {
      expect(added).toMatchObject({
        chatRoomId,
        admin: { userId: userB.userId },
      });
    }

    const admins = (await userA.page.evaluate(async (chatRoomId: string) => {
      return (window.__CLIENT__ as any).chatRoomManager.getAdminList({ chatRoomId });
    }, chatRoomId)) as ChatRoomEventUser[];
    expect(admins.map(item => item.userId)).toEqual(expect.arrayContaining([userB.userId]));

    await userA.clearEvents();
    await userB.clearEvents();
    await userA.page.evaluate(
      async ({ chatRoomId, userId }) => {
        await (window.__CLIENT__ as any).chatRoomManager.removeAdmin({ chatRoomId, userId });
      },
      { chatRoomId, userId: userB.userId }
    );

    const removed = await waitForOptionalChatRoomEvent<{
      chatRoomId: string;
      admin?: ChatRoomEventUser;
    }>(userB, 'onAdminRemoved', payload => payload.chatRoomId === chatRoomId);
    if (removed) {
      expect(removed).toMatchObject({
        chatRoomId,
        admin: { userId: userB.userId },
      });
    }

    const adminsAfterRemove = (await userA.page.evaluate(async (chatRoomId: string) => {
      return (window.__CLIENT__ as any).chatRoomManager.getAdminList({ chatRoomId });
    }, chatRoomId)) as ChatRoomEventUser[];
    expect(adminsAfterRemove.map(item => item.userId)).not.toContain(userB.userId);
  });

  test('muteMembers/getMuteList/checkIfInMuteList/unmuteMembers 应更新禁言状态并派发事件', async ({
    userA,
    userB,
  }) => {
    const chatRoomId = getChatRoomId();
    const duration = 60000;
    await ensureMemberViaAdmin(userA, userB);
    await userA.clearEvents();
    await userB.clearEvents();

    await userA.page.evaluate(
      async ({ chatRoomId, userId, duration }) => {
        await (window.__CLIENT__ as any).chatRoomManager.muteMembers({
          chatRoomId,
          userIds: [userId],
          duration,
        });
      },
      { chatRoomId, userId: userB.userId, duration }
    );

    const added = await waitForOptionalChatRoomEvent<{
      chatRoomId: string;
      mutes: Array<{ user: ChatRoomEventUser; muteExpire?: number }>;
      muteExpire?: number;
    }>(userB, 'onMuteListAdded', payload => payload.chatRoomId === chatRoomId);
    if (added) {
      expect(added.chatRoomId).toBe(chatRoomId);
      expect(added.mutes.map(item => item.user.userId)).toEqual(
        expect.arrayContaining([userB.userId])
      );
    }

    const muteList = (await userA.page.evaluate(async (chatRoomId: string) => {
      return (window.__CLIENT__ as any).chatRoomManager.getMuteList({
        chatRoomId,
        pageSize: 20,
      });
    }, chatRoomId)) as Array<{ user: ChatRoomEventUser; muteExpire?: number }>;
    expect(muteList.map(item => item.user.userId)).toEqual(expect.arrayContaining([userB.userId]));

    const checkResult = (await userB.page.evaluate(async (chatRoomId: string) => {
      try {
        return {
          ok: true,
          value: await (window.__CLIENT__ as any).chatRoomManager.checkIfInMuteList({ chatRoomId }),
        };
      } catch (e: any) {
        return {
          ok: false,
          name: e.name,
          code: e.code,
          message: e.message,
          details: e.details,
        };
      }
    }, chatRoomId)) as CapturedOperationResult;
    if (checkResult.ok) {
      expect(checkResult.value).toMatchObject({ muted: true });
    } else {
      expect(checkResult).toMatchObject({
        name: 'RestBusinessError',
        code: 303,
      });
      expect(checkResult.message).toMatch(
        /^REST business error: checkIfIn(?:ChatRoom)?MuteList failed/
      );
    }

    await userA.clearEvents();
    await userB.clearEvents();
    await userA.page.evaluate(
      async ({ chatRoomId, userId }) => {
        await (window.__CLIENT__ as any).chatRoomManager.unmuteMembers({
          chatRoomId,
          userIds: [userId],
        });
      },
      { chatRoomId, userId: userB.userId }
    );

    const removed = await waitForOptionalChatRoomEvent<{
      chatRoomId: string;
      mutes: ChatRoomEventUser[];
    }>(userB, 'onMuteListRemoved', payload => payload.chatRoomId === chatRoomId);
    if (removed) {
      expect(removed.chatRoomId).toBe(chatRoomId);
      expect(removed.mutes.map(item => item.userId)).toEqual(expect.arrayContaining([userB.userId]));
    }

    const muteListAfterUnmute = (await userA.page.evaluate(async (chatRoomId: string) => {
      return (window.__CLIENT__ as any).chatRoomManager.getMuteList({
        chatRoomId,
        pageSize: 20,
      });
    }, chatRoomId)) as Array<{ user: ChatRoomEventUser; muteExpire?: number }>;
    expect(muteListAfterUnmute.map(item => item.user.userId)).not.toContain(userB.userId);
  });

  test('muteAllMembers/unmuteAllMembers 应更新全员禁言状态并派发事件', async ({
    userA,
    userB,
  }) => {
    const chatRoomId = getChatRoomId();
    await userA.clearEvents();
    await userB.clearEvents();

    await userA.page.evaluate(async (chatRoomId: string) => {
      await (window.__CLIENT__ as any).chatRoomManager.muteAllMembers({ chatRoomId });
    }, chatRoomId);

    const mutedEvent = await waitForOptionalChatRoomEvent<{
      chatRoomId: string;
      isMuted: boolean;
    }>(userB, 'onAllMemberMuteStateChanged', payload => payload.chatRoomId === chatRoomId);
    if (mutedEvent) {
      expect(mutedEvent).toEqual({
        chatRoomId,
        isMuted: true,
      });
    }

    await userA.clearEvents();
    await userB.clearEvents();
    await userA.page.evaluate(async (chatRoomId: string) => {
      await (window.__CLIENT__ as any).chatRoomManager.unmuteAllMembers({ chatRoomId });
    }, chatRoomId);

    const unmutedEvent = await waitForOptionalChatRoomEvent<{
      chatRoomId: string;
      isMuted: boolean;
    }>(userB, 'onAllMemberMuteStateChanged', payload => payload.chatRoomId === chatRoomId);
    if (unmutedEvent) {
      expect(unmutedEvent).toEqual({
        chatRoomId,
        isMuted: false,
      });
    }

  });

  test('blockMembers/getBlocklist/unblockMembers 应更新黑名单并移除成员', async ({
    userA,
    userB,
  }) => {
    const chatRoomId = getChatRoomId();
    await ensureMemberViaAdmin(userA, userB);
    await userA.clearEvents();
    await userB.clearEvents();

    const blockResult = (await userA.page.evaluate(
      async ({ chatRoomId, userId }) => {
        return (window.__CLIENT__ as any).chatRoomManager.blockMembers({
          chatRoomId,
          userIds: [userId],
        });
      },
      { chatRoomId, userId: userB.userId }
    )) as {
      succeeded: ChatRoomMemberActionResultPayload[];
      failed: ChatRoomMemberActionResultPayload[];
    };
    expectSingleMemberAction(blockResult, {
      chatRoomId,
      userId: userB.userId,
      action: 'add_blocks',
    });

    const removed = await waitForOptionalChatRoomEvent<{
      chatRoomId: string;
      participant?: ChatRoomEventUser;
    }>(userB, 'onRemovedFromChatRoom', payload => payload.chatRoomId === chatRoomId);
    if (removed) {
      expect(removed).toMatchObject({
        chatRoomId,
        participant: { userId: userB.userId },
      });
    }

    const blocklist = (await userA.page.evaluate(async (chatRoomId: string) => {
      return (window.__CLIENT__ as any).chatRoomManager.getBlocklist({
        chatRoomId,
        pageSize: 20,
      });
    }, chatRoomId)) as Array<{ user: ChatRoomEventUser }>;
    expect(blocklist.map(item => item.user.userId)).toEqual(expect.arrayContaining([userB.userId]));

    const unblockResult = (await userA.page.evaluate(
      async ({ chatRoomId, userId }) => {
        return (window.__CLIENT__ as any).chatRoomManager.unblockMembers({
          chatRoomId,
          userIds: [userId],
        });
      },
      { chatRoomId, userId: userB.userId }
    )) as {
      succeeded: ChatRoomMemberActionResultPayload[];
      failed: ChatRoomMemberActionResultPayload[];
    };
    expectSingleMemberAction(unblockResult, {
      chatRoomId,
      userId: userB.userId,
      action: 'remove_blocks',
    });

    const blocklistAfterUnblock = (await userA.page.evaluate(async (chatRoomId: string) => {
      return (window.__CLIENT__ as any).chatRoomManager.getBlocklist({
        chatRoomId,
        pageSize: 20,
      });
    }, chatRoomId)) as Array<{ user: ChatRoomEventUser }>;
    expect(blocklistAfterUnblock.map(item => item.user.userId)).not.toContain(userB.userId);
  });

  test('addUsersToAllowlist/getAllowlist/checkIfInAllowList/removeUsersFromAllowlist 应更新 allowlist 并派发事件', async ({
    userA,
    userB,
  }) => {
    const chatRoomId = getChatRoomId();
    await ensureMemberViaAdmin(userA, userB);
    await userA.clearEvents();
    await userB.clearEvents();

    const addResult = (await userA.page.evaluate(
      async ({ chatRoomId, userId }) => {
        return (window.__CLIENT__ as any).chatRoomManager.addUsersToAllowlist({
          chatRoomId,
          userIds: [userId],
        });
      },
      { chatRoomId, userId: userB.userId }
    )) as {
      succeeded: ChatRoomMemberActionResultPayload[];
      failed: ChatRoomMemberActionResultPayload[];
    };
    expectSingleMemberAction(addResult, {
      chatRoomId,
      userId: userB.userId,
      action: 'add_user_whitelist',
    });

    const added = await waitForOptionalChatRoomEvent<{
      chatRoomId: string;
      allowlist: ChatRoomEventUser[];
    }>(userB, 'onAllowListAdded', payload => payload.chatRoomId === chatRoomId);
    if (added) {
      expect(added.chatRoomId).toBe(chatRoomId);
      expect(added.allowlist.map(item => item.userId)).toEqual(
        expect.arrayContaining([userB.userId])
      );
    }

    const allowlist = (await userA.page.evaluate(async (chatRoomId: string) => {
      return (window.__CLIENT__ as any).chatRoomManager.getAllowlist({ chatRoomId });
    }, chatRoomId)) as Array<{ user: ChatRoomEventUser }>;
    expect(allowlist.map(item => item.user.userId)).toEqual(expect.arrayContaining([userB.userId]));

    const allowState = (await userB.page.evaluate(async (chatRoomId: string) => {
      return (window.__CLIENT__ as any).chatRoomManager.checkIfInAllowList({ chatRoomId });
    }, chatRoomId)) as boolean;
    expect(allowState).toBe(true);

    await userA.clearEvents();
    await userB.clearEvents();
    const removeResult = (await userA.page.evaluate(
      async ({ chatRoomId, userId }) => {
        return (window.__CLIENT__ as any).chatRoomManager.removeUsersFromAllowlist({
          chatRoomId,
          userIds: [userId],
        });
      },
      { chatRoomId, userId: userB.userId }
    )) as {
      succeeded: ChatRoomMemberActionResultPayload[];
      failed: ChatRoomMemberActionResultPayload[];
    };
    expectSingleMemberAction(removeResult, {
      chatRoomId,
      userId: userB.userId,
      action: 'remove_user_whitelist',
    });

    const removed = await waitForOptionalChatRoomEvent<{
      chatRoomId: string;
      allowlist: ChatRoomEventUser[];
    }>(userB, 'onAllowListRemoved', payload => payload.chatRoomId === chatRoomId);
    if (removed) {
      expect(removed.chatRoomId).toBe(chatRoomId);
      expect(removed.allowlist.map(item => item.userId)).toEqual(
        expect.arrayContaining([userB.userId])
      );
    }

    const allowlistAfterRemove = (await userA.page.evaluate(async (chatRoomId: string) => {
      return (window.__CLIENT__ as any).chatRoomManager.getAllowlist({ chatRoomId });
    }, chatRoomId)) as Array<{ user: ChatRoomEventUser }>;
    expect(allowlistAfterRemove.map(item => item.user.userId)).not.toContain(userB.userId);

    const allowStateAfterRemove = (await userB.page.evaluate(async (chatRoomId: string) => {
      return (window.__CLIENT__ as any).chatRoomManager.checkIfInAllowList({ chatRoomId });
    }, chatRoomId)) as boolean;
    expect(allowStateAfterRemove).toBe(false);
  });

  test('getAnnouncement/updateAnnouncement 应返回精确公告并派发事件', async ({
    userA,
    userB,
  }) => {
    const chatRoomId = getChatRoomId();
    const announcement = `chatroom-announcement-${Date.now()}`;
    await userA.clearEvents();
    await userB.clearEvents();

    await userA.page.evaluate(
      async ({ chatRoomId, announcement }) => {
        await (window.__CLIENT__ as any).chatRoomManager.updateAnnouncement({
          chatRoomId,
          announcement,
        });
      },
      { chatRoomId, announcement }
    );

    const queried = (await userA.page.evaluate(async (chatRoomId: string) => {
      return (window.__CLIENT__ as any).chatRoomManager.getAnnouncement({ chatRoomId });
    }, chatRoomId)) as { announcement: string };
    expect(queried).toEqual({
      announcement,
    });

    const event = await waitForOptionalChatRoomEvent<{
      chatRoomId: string;
      announcement: string;
    }>(userB, 'onAnnouncementChanged', payload => payload.chatRoomId === chatRoomId);
    if (event) {
      expect(event).toEqual({
        chatRoomId,
        announcement,
      });
    }
  });

  test('setAttributes/getAttributes/removeAttributes 应返回精确 key 级结果并派发事件', async ({
    userA,
    userB,
  }) => {
    const chatRoomId = getChatRoomId();
    const key = `e2e-attr-${Date.now()}`;
    const value = `value-${Date.now()}`;

    try {
      await userA.clearEvents();
      await userB.clearEvents();
      const setResult = (await userA.page.evaluate(
        async ({ chatRoomId, key, value }) => {
          return (window.__CLIENT__ as any).chatRoomManager.setAttributes({
            chatRoomId,
            attributes: { [key]: value },
            autoDelete: false,
            isForced: false,
          });
        },
        { chatRoomId, key, value }
      )) as ChatRoomAttributeMutationResultPayload;
      expect(setResult).toEqual({
        chatRoomId,
        appliedKeys: [key],
        failedKeys: {},
      });

      const updateEvent = await waitForOptionalChatRoomEvent<{
        chatRoomId: string;
        attributes: Record<string, string>;
        from?: ChatRoomEventUser;
      }>(userB, 'onAttributesUpdate', payload => payload.chatRoomId === chatRoomId);
      if (updateEvent) {
        expect(updateEvent).toMatchObject({
          chatRoomId,
          attributes: { [key]: value },
          from: { userId: userA.userId },
        });
      }

      const attrs = (await userA.page.evaluate(
        async ({ chatRoomId, key }) => {
          return (window.__CLIENT__ as any).chatRoomManager.getAttributes({
            chatRoomId,
            keys: [key],
          });
        },
        { chatRoomId, key }
      )) as {
        chatRoomId: string;
        attributes: Record<string, string>;
      };
      expect(attrs).toEqual({
        chatRoomId,
        attributes: { [key]: value },
      });

      await userA.clearEvents();
      await userB.clearEvents();
      const removeResult = (await userA.page.evaluate(
        async ({ chatRoomId, key }) => {
          return (window.__CLIENT__ as any).chatRoomManager.removeAttributes({
            chatRoomId,
            keys: [key],
            isForced: false,
          });
        },
        { chatRoomId, key }
      )) as ChatRoomAttributeMutationResultPayload;
      expect(removeResult).toEqual({
        chatRoomId,
        appliedKeys: [key],
        failedKeys: {},
      });

      const removeEvent = await waitForOptionalChatRoomEvent<{
        chatRoomId: string;
        keyList: string[];
        from?: ChatRoomEventUser;
      }>(userB, 'onAttributesRemoved', payload => payload.chatRoomId === chatRoomId);
      if (removeEvent) {
        expect(removeEvent).toMatchObject({
          chatRoomId,
          keyList: [key],
          from: { userId: userA.userId },
        });
      }

      const attrsAfterRemove = (await userA.page.evaluate(
        async ({ chatRoomId, key }) => {
          return (window.__CLIENT__ as any).chatRoomManager.getAttributes({
            chatRoomId,
            keys: [key],
          });
        },
        { chatRoomId, key }
      )) as {
        chatRoomId: string;
        attributes: Record<string, string>;
      };
      expect(attrsAfterRemove).toEqual({
        chatRoomId,
        attributes: {},
      });
    } finally {
      await cleanupAttributes(userA, [key]);
    }
  });

  test('removeMembers 应移除成员并向被移除人派发 removed 事件', async ({ userA, userB }) => {
    const chatRoomId = getChatRoomId();
    await ensureMemberViaAdmin(userA, userB);
    await userA.clearEvents();
    await userB.clearEvents();

    const removeResult = (await userA.page.evaluate(
      async ({ chatRoomId, userId }) => {
        return (window.__CLIENT__ as any).chatRoomManager.removeMembers({
          chatRoomId,
          userIds: [userId],
        });
      },
      { chatRoomId, userId: userB.userId }
    )) as {
      succeeded: ChatRoomMemberActionResultPayload[];
      failed: ChatRoomMemberActionResultPayload[];
    };
    expectSingleMemberAction(removeResult, {
      chatRoomId,
      userId: userB.userId,
      action: 'remove_member',
    });

    const event = await waitForOptionalChatRoomEvent<{
      chatRoomId: string;
      participant?: ChatRoomEventUser;
    }>(userB, 'onRemovedFromChatRoom', payload => payload.chatRoomId === chatRoomId);
    if (event) {
      expect(event).toMatchObject({
        chatRoomId,
        participant: { userId: userB.userId },
      });
    }

    const members = (await userA.page.evaluate(async (chatRoomId: string) => {
      return (window.__CLIENT__ as any).chatRoomManager.getMemberList({
        chatRoomId,
        pageSize: 20,
      });
    }, chatRoomId)) as { items: ChatRoomMemberEntryPayload[] };
    expect(members.items.map(item => item.user.userId)).not.toContain(userB.userId);
  });

  test('成员调用管理接口应返回权限错误，空 userIds 应返回参数错误', async ({
    userA,
    userB,
  }) => {
    const chatRoomId = getChatRoomId();
    const result = (await userB.page.evaluate(async (chatRoomId: string) => {
      const mgr = (window.__CLIENT__ as any).chatRoomManager;
      const captureEmptyUserIds = async () => {
        try {
          await mgr.muteMembers({ chatRoomId, userIds: [], duration: 60000 });
          return null;
        } catch (e: any) {
          return {
            name: e.name,
            code: e.code,
            message: e.message,
            details: e.details,
          };
        }
      };
      const capturePermission = async () => {
        try {
          await mgr.updateAnnouncement({
            chatRoomId,
            announcement: `member-announcement-${Date.now()}`,
          });
          return null;
        } catch (e: any) {
          return {
            name: e.name,
            code: e.code,
            message: e.message,
            details: e.details,
          };
        }
      };
      return {
        emptyUserIds: await captureEmptyUserIds(),
        permission: await capturePermission(),
      };
    }, chatRoomId)) as {
      emptyUserIds: {
        name: string;
        code: number;
        message: string;
        details: unknown;
      } | null;
      permission: {
        name: string;
        code: number;
        message: string;
        details: unknown;
      } | null;
    };

    expect(result.emptyUserIds).toMatchObject({
      name: 'ValidationError',
      code: 110,
      message: 'params.userIds is required',
      details: {
        fields: [
          {
            path: 'params.userIds',
            message: 'params.userIds is required',
            rule: 'required',
          },
        ],
      },
    });
    expect(result.permission).toBeTruthy();
    expect(result.permission?.code).toBeGreaterThan(0);
    expect(typeof result.permission?.message).toBe('string');

    const announcement = (await userA.page.evaluate(async (chatRoomId: string) => {
      return (window.__CLIENT__ as any).chatRoomManager.getAnnouncement({ chatRoomId });
    }, chatRoomId)) as { announcement: string };
    expect(announcement.announcement).not.toContain('member-announcement-');
  });
});
