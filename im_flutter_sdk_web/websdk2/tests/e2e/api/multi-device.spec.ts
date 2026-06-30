import { test, expect } from '../fixtures/sdk-api';

test.describe('multi-device - ChatClient 多设备监听', () => {
  test.beforeEach(async ({ userA }) => {
    await userA.clearEvents();
  });

  test('五类 MultiDevice 监听器应可注册、触发并移除', async ({ userA }) => {
    await userA.page.evaluate(() => {
      window.__EVENTS__.directMultiDevice = [];
      window.__CLIENT__!.addEventHandler('multi-device-e2e', {
        onMultiDeviceContact: payload => {
          (window.__EVENTS__.directMultiDevice ??= []).push({
            eventName: 'onMultiDeviceContact',
            payload,
          });
        },
        onMultiDeviceGroup: payload => {
          (window.__EVENTS__.directMultiDevice ??= []).push({
            eventName: 'onMultiDeviceGroup',
            payload,
          });
        },
        onMultiDeviceThread: payload => {
          (window.__EVENTS__.directMultiDevice ??= []).push({
            eventName: 'onMultiDeviceThread',
            payload,
          });
        },
        onMultiDeviceConversation: payload => {
          (window.__EVENTS__.directMultiDevice ??= []).push({
            eventName: 'onMultiDeviceConversation',
            payload,
          });
        },
        onMultiDeviceMessageRemoved: payload => {
          (window.__EVENTS__.directMultiDevice ??= []).push({
            eventName: 'onMultiDeviceMessageRemoved',
            payload,
          });
        },
      });

      window.__CLIENT__!.addInternalEvent('onMultiDeviceContact', {
        category: 'contact',
        operation: 'CONTACT_ACCEPT',
        targetUserId: 'alice',
        deviceId: 'ios-1',
      });
      window.__CLIENT__!.addInternalEvent('onMultiDeviceGroup', {
        category: 'group',
        operation: 'GROUP_INVITE',
        groupId: 'g1',
        userIds: ['alice'],
        deviceId: 'android-1',
      });
      window.__CLIENT__!.addInternalEvent('onMultiDeviceThread', {
        category: 'thread',
        operation: 'THREAD_CREATE',
        threadId: 't1',
        parentId: 'g1',
        deviceId: 'ios-2',
      });
      window.__CLIENT__!.addInternalEvent('onMultiDeviceConversation', {
        category: 'conversation',
        operation: 'CONVERSATION_PINNED',
        conversationId: 'c1',
        deviceId: 'android-2',
      });
      window.__CLIENT__!.addInternalEvent('onMultiDeviceMessageRemoved', {
        category: 'messageRemoved',
        operation: 'MESSAGE_REMOVED',
        conversationId: 'g1',
        messageIds: ['m1'],
        deviceId: 'ios-3',
      });
    });

    const events = await userA.getBufferedEvents<{
      readonly eventName: string;
      readonly payload: Record<string, unknown>;
    }>('directMultiDevice');

    expect(events).toHaveLength(5);
    expect(events.map(item => item.eventName)).toEqual([
      'onMultiDeviceContact',
      'onMultiDeviceGroup',
      'onMultiDeviceThread',
      'onMultiDeviceConversation',
      'onMultiDeviceMessageRemoved',
    ]);

    await userA.page.evaluate(() => {
      window.__EVENTS__.directMultiDevice = [];
      window.__CLIENT__!.removeEventHandler('multi-device-e2e');
      window.__CLIENT__!.addInternalEvent('onMultiDeviceContact', {
        category: 'contact',
        operation: 'CONTACT_ACCEPT',
        targetUserId: 'alice',
        deviceId: 'ios-1',
      });
    });

    await userA.waitForNoEvent('directMultiDevice', 1000);
  });
});
