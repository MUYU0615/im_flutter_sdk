import type { ChatClient } from '@/chat-client';
import type {
  EventHandlerMap,
  EventPayloadMap,
  MultiDeviceContactOperation,
  MultiDeviceConversationOperation,
  MultiDeviceEventCategory,
  MultiDeviceGroupOperation,
  MultiDeviceMessageRemovedOperation,
  MultiDeviceThreadOperation,
} from '@/types';

type ExpectTrue<Value extends true> = Value;
type ExpectFalse<Value extends false> = Value;
type IsAssignable<Source, Target> = [Source] extends [Target] ? true : false;
type HasKey<Target, Key extends PropertyKey> = Key extends keyof Target ? true : false;
type IsExact<Actual, Expected> =
  (<T>() => T extends Actual ? 1 : 2) extends <T>() => T extends Expected ? 1 : 2
    ? (<T>() => T extends Expected ? 1 : 2) extends <T>() => T extends Actual ? 1 : 2
      ? true
      : false
    : false;

type AddEventHandlerParam = Parameters<ChatClient['addEventHandler']>[1];

type _AddEventHandlerMatchesMap = ExpectTrue<IsAssignable<AddEventHandlerParam, EventHandlerMap>>;
type _AllowMultiDeviceContact = ExpectTrue<HasKey<AddEventHandlerParam, 'onMultiDeviceContact'>>;
type _AllowMultiDeviceGroup = ExpectTrue<HasKey<AddEventHandlerParam, 'onMultiDeviceGroup'>>;
type _AllowMultiDeviceThread = ExpectTrue<HasKey<AddEventHandlerParam, 'onMultiDeviceThread'>>;
type _AllowMultiDeviceConversation = ExpectTrue<
  HasKey<AddEventHandlerParam, 'onMultiDeviceConversation'>
>;
type _AllowMultiDeviceMessageRemoved = ExpectTrue<
  HasKey<AddEventHandlerParam, 'onMultiDeviceMessageRemoved'>
>;

type _BusinessContactDoesNotRequireDeviceId = ExpectFalse<
  HasKey<EventPayloadMap['onContactAdded'], 'deviceId'>
>;
type _BusinessGroupDoesNotRequireDeviceId = ExpectFalse<
  HasKey<EventPayloadMap['onGroupMemberAttributeChanged'], 'deviceId'>
>;
type _BusinessThreadDoesNotRequireDeviceId = ExpectFalse<
  HasKey<EventPayloadMap['onChatThreadCreated'], 'deviceId'>
>;

type _CategoryUnionIsExact = ExpectTrue<
  IsExact<
    MultiDeviceEventCategory,
    'contact' | 'group' | 'thread' | 'conversation' | 'messageRemoved'
  >
>;
type _ContactOpsAreExact = ExpectTrue<
  IsExact<
    MultiDeviceContactOperation,
    'CONTACT_REMOVE' | 'CONTACT_ACCEPT' | 'CONTACT_DECLINE' | 'CONTACT_BAN' | 'CONTACT_ALLOW' | 'UNKNOWN'
  >
>;
type _GroupOpsAreExact = ExpectTrue<
  IsExact<
    MultiDeviceGroupOperation,
    | 'GROUP_CREATE'
    | 'GROUP_DESTROY'
    | 'GROUP_JOIN'
    | 'GROUP_LEAVE'
    | 'GROUP_APPLY'
    | 'GROUP_APPLY_ACCEPT'
    | 'GROUP_APPLY_DECLINE'
    | 'GROUP_INVITE'
    | 'GROUP_INVITE_ACCEPT'
    | 'GROUP_INVITE_DECLINE'
    | 'GROUP_KICK'
    | 'GROUP_BAN'
    | 'GROUP_ALLOW'
    | 'GROUP_BLOCK'
    | 'GROUP_UNBLOCK'
    | 'GROUP_ASSIGN_OWNER'
    | 'GROUP_ADD_ADMIN'
    | 'GROUP_REMOVE_ADMIN'
    | 'GROUP_ADD_MUTE'
    | 'GROUP_REMOVE_MUTE'
    | 'GROUP_ADD_USER_WHITE_LIST'
    | 'GROUP_REMOVE_USER_WHITE_LIST'
    | 'GROUP_ALL_BAN'
    | 'GROUP_REMOVE_ALL_BAN'
    | 'GROUP_MEMBER_METADATA_CHANGED'
    | 'GROUP_UPDATED'
    | 'UNKNOWN'
  >
>;
type _ThreadOpsAreExact = ExpectTrue<
  IsExact<
    MultiDeviceThreadOperation,
    'THREAD_CREATE' | 'THREAD_JOIN' | 'THREAD_UPDATE' | 'THREAD_LEAVE' | 'THREAD_DESTROY' | 'THREAD_KICK' | 'UNKNOWN'
  >
>;
type _ConversationOpsAreExact = ExpectTrue<
  IsExact<
    MultiDeviceConversationOperation,
    | 'CONVERSATION_DELETED'
    | 'CONVERSATION_PINNED'
    | 'CONVERSATION_UNPINNED'
    | 'CONVERSATION_MARK'
    | 'CONVERSATION_MUTE_INFO_CHANGED'
    | 'UNKNOWN'
  >
>;
type _MessageRemovedOpsAreExact = ExpectTrue<
  IsExact<MultiDeviceMessageRemovedOperation, 'MESSAGE_REMOVED' | 'UNKNOWN'>
>;
