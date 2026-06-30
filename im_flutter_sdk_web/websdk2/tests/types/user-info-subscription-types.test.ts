import { describe, expect, it } from 'vitest';

import {
  ChatClient,
  UserInfoManager,
  type ContactInfoUpdatedEvent,
  type SubscribeUsersInfoParams,
  type UnsubscribeUsersInfoParams,
  type UserInfo,
} from '@/index';

describe('user-info subscription types', () => {
  it('订阅参数与返回类型应通过根导出可用', () => {
    const subscribeParams: SubscribeUsersInfoParams = {
      userIds: ['alice', 'bob'],
    };
    const unsubscribeParams: UnsubscribeUsersInfoParams = {
      userIds: ['bob'],
    };
    const contactEvent: ContactInfoUpdatedEvent = {
      userInfo: { userId: 'bob' },
    };
    const listPromise: ReturnType<UserInfoManager['getSubscribedUsers']> =
      Promise.resolve<ReadonlyArray<UserInfo>>([]);
    const subscribePromise: ReturnType<UserInfoManager['subscribeUsersInfo']> =
      Promise.resolve();
    const unsubscribePromise: ReturnType<UserInfoManager['unsubscribeUsersInfo']> =
      Promise.resolve();

    expect(subscribeParams.userIds).toEqual(['alice', 'bob']);
    expect(unsubscribeParams.userIds).toEqual(['bob']);
    expect(contactEvent.userInfo.userId).toBe('bob');
    expect(listPromise).toBeInstanceOf(Promise);
    expect(subscribePromise).toBeInstanceOf(Promise);
    expect(unsubscribePromise).toBeInstanceOf(Promise);
  });

  it('client.use(UserInfoManager) 后应可访问订阅 API', () => {
    const client = ChatClient.init({ appKey: 'org#app' }).use(UserInfoManager);

    expect(typeof client.userInfoManager.subscribeUsersInfo).toBe('function');
    expect(typeof client.userInfoManager.unsubscribeUsersInfo).toBe('function');
    expect(typeof client.userInfoManager.getSubscribedUsers).toBe('function');
    expect(typeof client.userInfoManager.addEventHandler).toBe('function');
  });
});
