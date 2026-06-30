import { describe, expect, it } from 'vitest';

import {
  ContactManager,
  type AddContactParams,
  type BlocklistAddResult,
  type BlocklistMutationParams,
  type ContactEventHandlerMap,
  type Contact,
  type ContactMutationTarget,
  type ContactRosterEventPayload,
  type SetContactRemarkParams,
} from '@/index';

describe('contact manager types', () => {
  it('联系人写接口返回 Promise<void>', () => {
    type AddContactReturn = ReturnType<ContactManager['addContact']>;
    type DeleteContactReturn = ReturnType<ContactManager['deleteContact']>;
    type AcceptContactInviteReturn = ReturnType<ContactManager['acceptContactInvite']>;
    type DeclineContactInviteReturn = ReturnType<ContactManager['declineContactInvite']>;
    type SetContactRemarkReturn = ReturnType<ContactManager['setContactRemark']>;

    const addContactPromise: AddContactReturn = Promise.resolve();
    const deleteContactPromise: DeleteContactReturn = Promise.resolve();
    const acceptContactInvitePromise: AcceptContactInviteReturn = Promise.resolve();
    const declineContactInvitePromise: DeclineContactInviteReturn = Promise.resolve();
    const setContactRemarkPromise: SetContactRemarkReturn = Promise.resolve();

    expect(addContactPromise).toBeInstanceOf(Promise);
    expect(deleteContactPromise).toBeInstanceOf(Promise);
    expect(acceptContactInvitePromise).toBeInstanceOf(Promise);
    expect(declineContactInvitePromise).toBeInstanceOf(Promise);
    expect(setContactRemarkPromise).toBeInstanceOf(Promise);
  });

  it('黑名单接口类型应固定为对象数组与 userIds: string[]', () => {
    type GetBlocklistReturn = ReturnType<ContactManager['getBlocklist']>;
    type AddBlocklistReturn = ReturnType<ContactManager['addUsersToBlocklist']>;
    type RemoveBlocklistReturn = ReturnType<ContactManager['removeUserFromBlocklist']>;

    const getBlocklistPromise: GetBlocklistReturn = Promise.resolve([{ userId: 'zd2' }]);
    const addBlocklistPromise: AddBlocklistReturn = Promise.resolve<BlocklistAddResult>({
      succeeded: [{ userId: 'zd2' }],
      failed: [],
    });
    const removeBlocklistPromise: RemoveBlocklistReturn = Promise.resolve();

    const mutationParams: BlocklistMutationParams = {
      userIds: ['zd2'],
    };

    expect(getBlocklistPromise).toBeInstanceOf(Promise);
    expect(addBlocklistPromise).toBeInstanceOf(Promise);
    expect(removeBlocklistPromise).toBeInstanceOf(Promise);
    expect(mutationParams.userIds).toEqual(['zd2']);
  });

  it('联系人参数类型应通过根导出可用', () => {
    const addParams: AddContactParams = {
      userId: 'bob',
      message: 'hello',
    };
    const target: ContactMutationTarget = {
      userId: 'bob',
    };
    const remarkParams: SetContactRemarkParams = {
      userId: 'bob',
      remark: '',
    };

    expect(addParams.userId).toBe('bob');
    expect(target.userId).toBe('bob');
    expect(remarkParams.remark).toBe('');
  });

  it('联系人读取结果应通过根导出可用', () => {
    const contact: Contact = {
      userId: 'bob',
      userInfo: {
        userId: 'bob',
        nickname: 'Bob',
        mail: 'bob@example.com',
      },
      remark: '',
      addTs: 20,
    };

    expect(contact.userInfo.mail).toBe('bob@example.com');
    expect(contact.addTs).toBe(20);
  });

  it('联系人 roster 事件类型应通过根导出可用', () => {
    const payload: ContactRosterEventPayload = {
      type: 'subscribed',
      from: 'bob',
      to: 'alice',
      status: '',
      rosterVersion: 'rv-1',
      userInfo: {
        userId: 'bob',
        nickname: 'Bob',
      },
    };
    const handlers: ContactEventHandlerMap = {
      onContactAdded: (event) => {
        expect(event.type).toBe('subscribed');
      },
      onContactDeleted: (event) => {
        expect(event.type).toBe('unsubscribed');
      },
    };

    void handlers.onContactAdded?.(payload);
    void handlers.onContactDeleted?.({
      ...payload,
      type: 'unsubscribed',
    });
  });
});
