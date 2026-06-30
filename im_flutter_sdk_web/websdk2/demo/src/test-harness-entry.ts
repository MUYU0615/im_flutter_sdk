/**
 * Test Harness 入口
 * 将 SDK 所有 Manager 暴露到 window.__SDK__，供 Playwright page.evaluate 调用。
 */
import { ChatClient } from 'im-sdk-web';
import { ChatManager } from 'im-sdk-web';
import { ContactManager } from 'im-sdk-web';
import { GroupManager } from 'im-sdk-web';
import { ChatThreadManager } from 'im-sdk-web';
import { ChatRoomManager } from 'im-sdk-web';
import { PresenceManager } from 'im-sdk-web';
import { PushManager } from 'im-sdk-web';
import { UserInfoManager } from 'im-sdk-web';

declare global {
  interface Window {
    __SDK__: {
      ChatClient: typeof ChatClient;
      ChatManager: typeof ChatManager;
      ContactManager: typeof ContactManager;
      GroupManager: typeof GroupManager;
      ChatThreadManager: typeof ChatThreadManager;
      ChatRoomManager: typeof ChatRoomManager;
      PresenceManager: typeof PresenceManager;
      PushManager: typeof PushManager;
      UserInfoManager: typeof UserInfoManager;
    };
    __EVENTS__: Record<string, unknown[]>;
    __CLIENT__: ReturnType<typeof ChatClient.init> | null;
  }
}

window.__SDK__ = {
  ChatClient,
  ChatManager,
  ContactManager,
  GroupManager,
  ChatThreadManager,
  ChatRoomManager,
  PresenceManager,
  PushManager,
  UserInfoManager,
};

window.__EVENTS__ = {};
window.__CLIENT__ = null;

document.getElementById('status')!.textContent = 'loaded';
