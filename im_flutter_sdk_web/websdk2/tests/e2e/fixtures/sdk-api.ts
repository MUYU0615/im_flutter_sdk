/**
 * Playwright E2E fixture：SDK API 封装
 *
 * 每个 SDKUser 对应一个独立的浏览器页面，拥有独立的 SDK 实例。
 * 通过 page.evaluate 调用 SDK API，事件缓存在页面 window.__EVENTS__ 中。
 */
import { test as base, type Page } from '@playwright/test';
import {
  resolveRealEnvConfig,
  getMissingRealEnvKeys,
  type RealEnvConfig,
} from '../../test-utils/layered/real-env-runner';

export interface SDKUser {
  readonly page: Page;
  readonly userId: string;
  /** 初始化 SDK 并登录 */
  login(): Promise<void>;
  /** 登出 */
  logout(): Promise<void>;
  /** 等待指定事件到达 */
  waitForEvent(eventName: string, timeoutMs?: number): Promise<unknown>;
  /** 等待满足条件的事件到达 */
  waitForEventMatching<T = unknown>(
    eventName: string,
    predicate: (payload: T) => boolean,
    timeoutMs?: number
  ): Promise<T>;
  /** 在指定时间内确认没有事件到达 */
  waitForNoEvent(eventName: string, waitMs?: number): Promise<void>;
  /** 读取当前已缓冲的事件 */
  getBufferedEvents<T = unknown>(eventName: string): Promise<ReadonlyArray<T>>;
  /** 清空事件缓存 */
  clearEvents(): Promise<void>;
}

const HARNESS_PATH = '/test-harness.html';

async function createSDKUser(
  page: Page,
  config: RealEnvConfig,
  userId: string,
  token: string
): Promise<SDKUser> {
  await page.goto(HARNESS_PATH);
  await page.waitForFunction(() => document.getElementById('status')?.textContent === 'loaded');

  // 初始化 SDK + 注册所有 Manager + 绑定事件收集
  await page.evaluate(
    ({ appKey }) => {
      const {
        ChatClient,
        ChatManager,
        ContactManager,
        GroupManager,
        ChatThreadManager,
        PresenceManager,
        ChatRoomManager,
        UserInfoManager,
        PushManager,
      } = window.__SDK__;
      const client = ChatClient.init({ appKey, useFixedDeviceId: true })
        .use(ChatManager)
        .use(ContactManager)
        .use(GroupManager)
        .use(ChatThreadManager)
        .use(PresenceManager)
        .use(ChatRoomManager)
        .use(UserInfoManager)
        .use(PushManager);
      window.__CLIENT__ = client as unknown as ReturnType<typeof ChatClient.init>;

      // 事件收集
      const events = window.__EVENTS__;
      client.addEventHandler('e2e-collector', {
        onMessage: (...args: unknown[]) => {
          (events.onMessage ??= []).push(args.length === 1 ? args[0] : args);
        },
        onMessageRead: (...args: unknown[]) => {
          (events.onMessageRead ??= []).push(args.length === 1 ? args[0] : args);
        },
        onMessageUpdated: (...args: unknown[]) => {
          (events.onMessageUpdated ??= []).push(args.length === 1 ? args[0] : args);
        },
        onContactInvited: (...args: unknown[]) => {
          (events.onContactInvited ??= []).push(args.length === 1 ? args[0] : args);
        },
        onContactAgreed: (...args: unknown[]) => {
          (events.onContactAgreed ??= []).push(args.length === 1 ? args[0] : args);
        },
        onContactRefuse: (...args: unknown[]) => {
          (events.onContactRefuse ??= []).push(args.length === 1 ? args[0] : args);
        },
        onContactDeleted: (...args: unknown[]) => {
          (events.onContactDeleted ??= []).push(args.length === 1 ? args[0] : args);
        },
        onContactAdded: (...args: unknown[]) => {
          (events.onContactAdded ??= []).push(args.length === 1 ? args[0] : args);
        },
        onMessageRecalled: (...args: unknown[]) => {
          const payload = args.length === 1 ? args[0] : args;
          (events.onMessageRecalled ??= []).push(payload);
          (events.onRecallMessage ??= []).push(payload);
        },
        onPresenceStatusChange: (...args: unknown[]) => {
          (events.onPresenceStatusChange ??= []).push(args.length === 1 ? args[0] : args);
        },
        onOwnInfoUpdated: (...args: unknown[]) => {
          (events.onOwnInfoUpdated ??= []).push(args.length === 1 ? args[0] : args);
        },
        onUserInfoUpdated: (...args: unknown[]) => {
          (events.onUserInfoUpdated ??= []).push(args.length === 1 ? args[0] : args);
        },
        onReactionChanged: (...args: unknown[]) => {
          (events.onReactionChanged ??= []).push(args.length === 1 ? args[0] : args);
        },
        onConversationListUpdate: (...args: unknown[]) => {
          (events.onConversationListUpdate ??= []).push(args.length === 1 ? args[0] : args);
        },
        onConversationRead: (...args: unknown[]) => {
          (events.onConversationRead ??= []).push(args.length === 1 ? args[0] : args);
        },
        onPinnedMessageChanged: (...args: unknown[]) => {
          (events.onPinnedMessageChanged ??= []).push(args.length === 1 ? args[0] : args);
        },
        onSyncDataStart: (...args: unknown[]) => {
          (events.onSyncDataStart ??= []).push(args.length === 1 ? args[0] : args);
        },
        onSyncDataFinished: (...args: unknown[]) => {
          (events.onSyncDataFinished ??= []).push(args.length === 1 ? args[0] : args);
        },
        onMultiDeviceContact: (...args: unknown[]) => {
          (events.onMultiDeviceContact ??= []).push(args.length === 1 ? args[0] : args);
        },
        onMultiDeviceGroup: (...args: unknown[]) => {
          (events.onMultiDeviceGroup ??= []).push(args.length === 1 ? args[0] : args);
        },
        onMultiDeviceThread: (...args: unknown[]) => {
          (events.onMultiDeviceThread ??= []).push(args.length === 1 ? args[0] : args);
        },
        onMultiDeviceConversation: (...args: unknown[]) => {
          (events.onMultiDeviceConversation ??= []).push(args.length === 1 ? args[0] : args);
        },
        onMultiDeviceMessageRemoved: (...args: unknown[]) => {
          (events.onMultiDeviceMessageRemoved ??= []).push(args.length === 1 ? args[0] : args);
        },
        onOfflineMessageSyncStart: (...args: unknown[]) => {
          (events.onOfflineMessageSyncStart ??= []).push(args.length === 1 ? args[0] : args);
        },
        onOfflineMessageSyncFinish: (...args: unknown[]) => {
          (events.onOfflineMessageSyncFinish ??= []).push(args.length === 1 ? args[0] : args);
        },
        onInvitationReceived: (...args: unknown[]) => {
          (events.onInvitationReceived ??= []).push(args.length === 1 ? args[0] : args);
        },
        onRequestToJoinReceived: (...args: unknown[]) => {
          (events.onRequestToJoinReceived ??= []).push(args.length === 1 ? args[0] : args);
        },
        onRequestToJoinAccepted: (...args: unknown[]) => {
          (events.onRequestToJoinAccepted ??= []).push(args.length === 1 ? args[0] : args);
        },
        onRequestToJoinDeclined: (...args: unknown[]) => {
          (events.onRequestToJoinDeclined ??= []).push(args.length === 1 ? args[0] : args);
        },
        onInvitationAccepted: (...args: unknown[]) => {
          (events.onInvitationAccepted ??= []).push(args.length === 1 ? args[0] : args);
        },
        onInvitationDeclined: (...args: unknown[]) => {
          (events.onInvitationDeclined ??= []).push(args.length === 1 ? args[0] : args);
        },
        onUserRemoved: (...args: unknown[]) => {
          (events.onUserRemoved ??= []).push(args.length === 1 ? args[0] : args);
        },
        onGroupDestroyed: (...args: unknown[]) => {
          (events.onGroupDestroyed ??= []).push(args.length === 1 ? args[0] : args);
        },
        onAllMemberMuteStateChanged: (...args: unknown[]) => {
          (events.onAllMemberMuteStateChanged ??= []).push(args.length === 1 ? args[0] : args);
        },
        onOwnerChanged: (...args: unknown[]) => {
          (events.onOwnerChanged ??= []).push(args.length === 1 ? args[0] : args);
        },
        onMembersJoined: (...args: unknown[]) => {
          (events.onMembersJoined ??= []).push(args.length === 1 ? args[0] : args);
        },
        onMembersExited: (...args: unknown[]) => {
          (events.onMembersExited ??= []).push(args.length === 1 ? args[0] : args);
        },
        onAnnouncementChanged: (...args: unknown[]) => {
          (events.onAnnouncementChanged ??= []).push(args.length === 1 ? args[0] : args);
        },
        onSharedFileAdded: (...args: unknown[]) => {
          (events.onSharedFileAdded ??= []).push(args.length === 1 ? args[0] : args);
        },
        onSharedFileDeleted: (...args: unknown[]) => {
          (events.onSharedFileDeleted ??= []).push(args.length === 1 ? args[0] : args);
        },
        onGroupInfoChanged: (...args: unknown[]) => {
          (events.onGroupInfoChanged ??= []).push(args.length === 1 ? args[0] : args);
        },
        onGroupDisabledChanged: (...args: unknown[]) => {
          (events.onGroupDisabledChanged ??= []).push(args.length === 1 ? args[0] : args);
        },
        onGroupMemberAttributeChanged: (...args: unknown[]) => {
          (events.onGroupMemberAttributeChanged ??= []).push(args.length === 1 ? args[0] : args);
        },
        onAdminAdded: (...args: unknown[]) => {
          (events.onAdminAdded ??= []).push(args.length === 1 ? args[0] : args);
        },
        onAdminRemoved: (...args: unknown[]) => {
          (events.onAdminRemoved ??= []).push(args.length === 1 ? args[0] : args);
        },
        onAllowListAdded: (...args: unknown[]) => {
          (events.onAllowListAdded ??= []).push(args.length === 1 ? args[0] : args);
        },
        onAllowListRemoved: (...args: unknown[]) => {
          (events.onAllowListRemoved ??= []).push(args.length === 1 ? args[0] : args);
        },
        onMuteListAdded: (...args: unknown[]) => {
          (events.onMuteListAdded ??= []).push(args.length === 1 ? args[0] : args);
        },
        onMuteListRemoved: (...args: unknown[]) => {
          (events.onMuteListRemoved ??= []).push(args.length === 1 ? args[0] : args);
        },
      });

      // PresenceManager 有独立的事件系统，需要额外注册
      try {
        (client as any).presenceManager.addEventHandler('e2e-presence-collector', {
          onPresenceStatusChange: (...args: unknown[]) => {
            (events.onPresenceStatusChange ??= []).push(args.length === 1 ? args[0] : args);
          },
        });
      } catch {
        /* presenceManager 可能未绑定 */
      }

      // ChatRoomManager 使用独立的内部事件名转发，需通过 manager 事件系统采集。
      try {
        const collectChatRoomEvent =
          (name: string) =>
          (...args: unknown[]): void => {
            const payload = args.length === 1 ? args[0] : args;
            (events[name] ??= []).push(payload);
          };
        (client as any).chatRoomManager.addEventHandler('e2e-chatroom-collector', {
          onChatRoomDestroyed: collectChatRoomEvent('onChatRoomDestroyed'),
          onMembersJoined: collectChatRoomEvent('onMembersJoined'),
          onMembersExited: collectChatRoomEvent('onMembersExited'),
          onRemovedFromChatRoom: collectChatRoomEvent('onRemovedFromChatRoom'),
          onMuteListAdded: collectChatRoomEvent('onMuteListAdded'),
          onMuteListRemoved: collectChatRoomEvent('onMuteListRemoved'),
          onAllowListAdded: collectChatRoomEvent('onAllowListAdded'),
          onAllowListRemoved: collectChatRoomEvent('onAllowListRemoved'),
          onAllMemberMuteStateChanged: collectChatRoomEvent('onAllMemberMuteStateChanged'),
          onAdminAdded: collectChatRoomEvent('onAdminAdded'),
          onAdminRemoved: collectChatRoomEvent('onAdminRemoved'),
          onOwnerChanged: collectChatRoomEvent('onOwnerChanged'),
          onAnnouncementChanged: collectChatRoomEvent('onAnnouncementChanged'),
          onChatRoomInfoChanged: collectChatRoomEvent('onChatRoomInfoChanged'),
          onAttributesUpdate: collectChatRoomEvent('onAttributesUpdate'),
          onAttributesRemoved: collectChatRoomEvent('onAttributesRemoved'),
        });
      } catch {
        /* chatRoomManager 可能未绑定 */
      }

      try {
        const collectChatThreadEvent =
          (name: string) =>
          (...args: unknown[]): void => {
            const payload = args.length === 1 ? args[0] : args;
            (events[name] ??= []).push(payload);
          };
        (client as any).chatThreadManager.addEventHandler('e2e-chat-thread-collector', {
          onChatThreadCreated: collectChatThreadEvent('onChatThreadCreated'),
          onChatThreadDestroyed: collectChatThreadEvent('onChatThreadDestroyed'),
          onChatThreadUpdated: collectChatThreadEvent('onChatThreadUpdated'),
          onChatThreadUserRemoved: collectChatThreadEvent('onChatThreadUserRemoved'),
        });
      } catch {
        /* chatThreadManager 可能未绑定 */
      }
    },
    { appKey: config.appKey }
  );

  const sdkUser: SDKUser = {
    page,
    userId,

    async login() {
      await page.evaluate(
        async ({ userId: uid, token: tk }) => {
          await window.__CLIENT__!.login({ userId: uid, token: tk });
        },
        { userId, token }
      );
    },

    async logout() {
      await page.evaluate(async () => {
        if (window.__CLIENT__?.getConnectionState() === 'connected') {
          await window.__CLIENT__.logout();
        }
      });
    },

    async waitForEvent(eventName: string, timeoutMs = 10000) {
      return page.evaluate(
        ({ name, timeout }) => {
          return new Promise<unknown>((resolve, reject) => {
            const check = (): boolean => {
              const list = window.__EVENTS__[name];
              if (list && list.length > 0) {
                resolve(list.shift());
                return true;
              }
              return false;
            };
            if (check()) return;
            const interval = setInterval(() => {
              if (check()) clearInterval(interval);
            }, 100);
            setTimeout(() => {
              clearInterval(interval);
              const buffered = Object.keys(window.__EVENTS__).filter(
                k => (window.__EVENTS__[k]?.length ?? 0) > 0
              );
              reject(
                new Error(
                  `waitForEvent timeout: "${name}" after ${timeout}ms. Buffered: [${buffered.join(', ')}]`
                )
              );
            }, timeout);
          });
        },
        { name: eventName, timeout: timeoutMs }
      );
    },

    async waitForEventMatching<T = unknown>(
      eventName: string,
      predicate: (payload: T) => boolean,
      timeoutMs = 10000
    ) {
      const startedAt = Date.now();
      while (Date.now() - startedAt < timeoutMs) {
        const buffered = (await page.evaluate(name => {
          return [...(window.__EVENTS__[name] ?? [])];
        }, eventName)) as T[];
        const matchedIndex = buffered.findIndex(predicate);
        if (matchedIndex >= 0) {
          return page.evaluate(
            ({ name, index }) => {
              const events = window.__EVENTS__[name] ?? [];
              return events.splice(index, 1)[0];
            },
            { name: eventName, index: matchedIndex }
          ) as Promise<T>;
        }
        await page.waitForTimeout(100);
      }
      const bufferedNames = await page.evaluate(() => {
        return Object.keys(window.__EVENTS__).filter(k => (window.__EVENTS__[k]?.length ?? 0) > 0);
      });
      throw new Error(
        `waitForEventMatching timeout: "${eventName}" after ${timeoutMs}ms. Buffered: [${bufferedNames.join(', ')}]`
      );
    },

    async waitForNoEvent(eventName: string, waitMs = 3000) {
      await page.evaluate(
        ({ name, wait }) => {
          return new Promise<void>((resolve, reject) => {
            const hasEvent = (): boolean => (window.__EVENTS__[name]?.length ?? 0) > 0;
            if (hasEvent()) {
              reject(new Error(`waitForNoEvent failed immediately: "${name}" already buffered`));
              return;
            }
            const interval = setInterval(() => {
              if (hasEvent()) {
                clearInterval(interval);
                clearTimeout(timer);
                reject(new Error(`waitForNoEvent failed: "${name}" received within ${wait}ms`));
              }
            }, 100);
            const timer = setTimeout(() => {
              clearInterval(interval);
              resolve();
            }, wait);
          });
        },
        { name: eventName, wait: waitMs }
      );
    },

    async getBufferedEvents<T = unknown>(eventName: string) {
      return page.evaluate(name => {
        return [...(window.__EVENTS__[name] ?? [])];
      }, eventName) as Promise<ReadonlyArray<T>>;
    },

    async clearEvents() {
      await page.evaluate(() => {
        for (const key of Object.keys(window.__EVENTS__)) {
          window.__EVENTS__[key] = [];
        }
      });
    },
  };

  return sdkUser;
}

/** 获取 real-env 配置，缺少时 skip */
export function requireConfig(): RealEnvConfig {
  const config = resolveRealEnvConfig();
  if (!config) {
    const missing = getMissingRealEnvKeys();
    base.skip(true, `缺少环境变量: ${missing.join(', ')}`);
    throw new Error('unreachable');
  }
  return config;
}

/** 扩展 Playwright test，提供 userA/userB/thirdUser fixture */
export const test = base.extend<{ userA: SDKUser; userB: SDKUser; thirdUser: SDKUser | null }>({
  userA: async ({ browser }, use) => {
    const config = requireConfig();
    if (!config.token) {
      base.skip(true, '缺少 EASEMOB_TOKEN');
      return;
    }
    const page = await browser.newPage();
    const user = await createSDKUser(page, config, config.userId, config.token);
    await user.login();
    await use(user);
    await user.logout();
    await page.close();
  },
  userB: async ({ browser }, use) => {
    const config = requireConfig();
    if (!config.secondUserId || !config.secondToken) {
      base.skip(true, '缺少第二账号配置');
      return;
    }
    const page = await browser.newPage();
    const user = await createSDKUser(page, config, config.secondUserId, config.secondToken);
    await user.login();
    await use(user);
    await user.logout();
    await page.close();
  },
  thirdUser: async ({ browser }, use) => {
    const config = requireConfig();
    if (!config.thirdUserId || !config.thirdToken) {
      await use(null);
      return;
    }
    const page = await browser.newPage();
    const user = await createSDKUser(page, config, config.thirdUserId, config.thirdToken);
    await user.login();
    await use(user);
    await user.logout();
    await page.close();
  },
});

export { expect } from '@playwright/test';
