import { describe, expect, it } from 'vitest';

import {
  ChatClient,
  UserInfoManager,
  type FetchUserInfoByAttributeParams,
  type FetchUserInfoByUserIdParams,
  type UpdateOwnInfoByAttributeParams,
  type UpdateOwnInfoParams,
  type UserInfoAttribute,
  type UserInfoAttributeValue,
  type UserInfo,
} from '@/index';

type AssertNever<T extends never> = T;

describe('user-info manager types', () => {
  it('新查询与更新 API 的参数和返回类型应通过根导出可用', () => {
    const fetchByUserIdParams: FetchUserInfoByUserIdParams = {
      userIds: ['alice', 'bob'],
    };
    const fetchByAttributeParams: FetchUserInfoByAttributeParams = {
      userIds: ['alice'],
      attributes: ['avatarUrl', 'nickname'],
    };
    const updateOwnInfoParams: UpdateOwnInfoParams = {
      nickname: '',
      gender: false,
    };
    const updateByAttributeParams: UpdateOwnInfoByAttributeParams = {
      attribute: 'avatarUrl',
      value: 'https://example.com/a.png',
    };
    const attribute: UserInfoAttribute = 'avatarUrl';
    const value: UserInfoAttributeValue = 0;
    const profile: UserInfo = {
      userId: 'alice',
      avatarUrl: 'https://example.com/a.png',
      gender: false,
    };

    expect(fetchByUserIdParams.userIds).toEqual(['alice', 'bob']);
    expect(fetchByAttributeParams.attributes).toEqual(['avatarUrl', 'nickname']);
    expect(updateOwnInfoParams.nickname).toBe('');
    expect(updateByAttributeParams.attribute).toBe('avatarUrl');
    expect(attribute).toBe('avatarUrl');
    expect(value).toBe(0);
    expect(profile.userId).toBe('alice');
  });

  it('UserInfoManager 方法签名应返回 Promise<UserInfo | UserInfo[]>', () => {
    type FetchByUserIdReturn = ReturnType<UserInfoManager['getUserInfoByUserId']>;
    type FetchByAttributeReturn = ReturnType<UserInfoManager['getUserInfoByAttribute']>;
    type UpdateOwnInfoReturn = ReturnType<UserInfoManager['updateOwnInfo']>;
    type UpdateByAttributeReturn = ReturnType<UserInfoManager['updateOwnInfoByAttribute']>;

    const fetchByUserIdPromise: FetchByUserIdReturn = Promise.resolve<ReadonlyArray<UserInfo>>([]);
    const fetchByAttributePromise: FetchByAttributeReturn = Promise.resolve<ReadonlyArray<UserInfo>>([]);
    const updateOwnInfoPromise: UpdateOwnInfoReturn = Promise.resolve<UserInfo>({
      userId: 'alice',
    });
    const updateByAttributePromise: UpdateByAttributeReturn = Promise.resolve<UserInfo>({
      userId: 'alice',
    });

    expect(fetchByUserIdPromise).toBeInstanceOf(Promise);
    expect(fetchByAttributePromise).toBeInstanceOf(Promise);
    expect(updateOwnInfoPromise).toBeInstanceOf(Promise);
    expect(updateByAttributePromise).toBeInstanceOf(Promise);
  });

  it('client.use(UserInfoManager) 后应通过 client.userInfoManager 访问新 API', () => {
    const client = ChatClient.init({ appKey: 'org#app' }).use(UserInfoManager);

    expect(typeof client.userInfoManager.getUserInfoByUserId).toBe('function');
    expect(typeof client.userInfoManager.getUserInfoByAttribute).toBe('function');
    expect(typeof client.userInfoManager.updateOwnInfo).toBe('function');
    expect(typeof client.userInfoManager.updateOwnInfoByAttribute).toBe('function');
  });

  it('旧方法名应从公开类型面移除', () => {
    type RemovedFetchMethod = AssertNever<Extract<keyof UserInfoManager, 'fetchUserInfoById'>>;
    type RemovedUpdateMethod = AssertNever<Extract<keyof UserInfoManager, 'updateOwnUserInfo'>>;

    void (null as unknown as RemovedFetchMethod);
    void (null as unknown as RemovedUpdateMethod);
    expect(true).toBe(true);
  });
});
