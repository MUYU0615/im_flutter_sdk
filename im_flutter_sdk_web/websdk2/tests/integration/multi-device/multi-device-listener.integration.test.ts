import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatClient } from '@/chat-client';
import { EventHub } from '@/core/events/event-hub';
import { MessageReceiver } from '@/core/message/message-receiver';
import type { MessageSender } from '@/core/message/message-sender';
import { MsyncCodec } from '@/protocol/msync/codec';

import {
  buildConversationNotifySyncPayload,
  buildGroupMucSyncPayload,
  buildMessageRemovedNotifySyncPayload,
  buildRosterSyncPayload,
  buildThreadMucSyncPayload,
} from '../../unit/multi-device/multi-device-fixtures';

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

const createMessageSenderStub = (): Pick<MessageSender, 'handleAck' | 'handleSendError'> => {
  return {
    handleAck: vi.fn(),
    handleSendError: vi.fn(),
  };
};

describe('multi-device listener integration', () => {
  beforeEach((): void => {
    resetSingleton();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('codec -> MessageReceiver -> ChatClient 应派发五类 MultiDevice 事件', () => {
    const client = ChatClient.init({ appKey: 'org#app' });
    const eventHub = new EventHub();
    (client as unknown as { eventHub: EventHub }).eventHub = eventHub;

    const contactEvents: unknown[] = [];
    const groupEvents: unknown[] = [];
    const threadEvents: unknown[] = [];
    const conversationEvents: unknown[] = [];
    const removedEvents: unknown[] = [];

    client.addEventHandler('multi-device-integration', {
      onMultiDeviceContact: event => {
        contactEvents.push(event);
      },
      onMultiDeviceGroup: event => {
        groupEvents.push(event);
      },
      onMultiDeviceThread: event => {
        threadEvents.push(event);
      },
      onMultiDeviceConversation: event => {
        conversationEvents.push(event);
      },
      onMultiDeviceMessageRemoved: event => {
        removedEvents.push(event);
      },
    });

    const codec = new MsyncCodec({
      appKey: 'org#app',
      userId: 'alice',
      token: 'token',
    });
    const receiver = new MessageReceiver(codec, createMessageSenderStub() as MessageSender, eventHub);

    receiver.handleSyncPayload(
      buildRosterSyncPayload({
        operation: 3,
        from: 'bob',
        to: 'alice',
        fromClientResource: 'ios-1',
      })
    );
    receiver.handleSyncPayload(
      buildGroupMucSyncPayload({
        operation: 7,
        from: 'bob',
        groupId: 'g1',
        groupName: 'Group 1',
        to: ['alice'],
        fromClientResource: 'android-1',
      })
    );
    receiver.handleSyncPayload(
      buildThreadMucSyncPayload({
        operation: 33,
        from: 'bob',
        threadId: 't1',
        parentId: 'g1',
        threadName: 'thread topic',
        fromClientResource: 'ios-2',
      })
    );
    receiver.handleSyncPayload(
      buildConversationNotifySyncPayload({
        operation: 'pin',
        id: 'c1',
        type: 'chat',
        from: 'bob',
        res: 'android-2',
        ts: 1234,
      })
    );
    receiver.handleSyncPayload(
      buildMessageRemovedNotifySyncPayload({
        chatType: 'groupchat',
        to: 'g1',
        resource: 'ios-3',
        msgIdList: ['m1', 'm2'],
        deleteTime: 1235,
        messageRoamingType: 'deleteRoaming',
      })
    );

    expect(contactEvents).toEqual([
      expect.objectContaining({
        category: 'contact',
        operation: 'CONTACT_REMOVE',
        targetUserId: 'alice',
      }),
    ]);
    expect(groupEvents).toEqual([
      expect.objectContaining({
        category: 'group',
        operation: 'GROUP_INVITE',
        groupId: 'g1',
      }),
    ]);
    expect(threadEvents).toEqual([
      expect.objectContaining({
        category: 'thread',
        operation: 'THREAD_CREATE',
        threadId: 't1',
      }),
    ]);
    expect(conversationEvents).toEqual([
      expect.objectContaining({
        category: 'conversation',
        operation: 'CONVERSATION_PINNED',
        conversationId: 'c1',
      }),
    ]);
    expect(removedEvents).toEqual([
      expect.objectContaining({
        category: 'messageRemoved',
        operation: 'MESSAGE_REMOVED',
        conversationId: 'g1',
      }),
    ]);
  });
});
