import type { ChatManager } from '@/managers/chat-manager';
import type { MarkMessageReadParams, Message, MessageReadEventPayload, StreamMessage } from '@/types';
import type { ChatEventHandlerMap } from '@/types/event-system';

type ExpectTrue<Value extends true> = Value;
type ExpectFalse<Value extends false> = Value;
type IsAssignable<Source, Target> = [Source] extends [Target] ? true : false;
type HasKey<Target, Key extends PropertyKey> = Key extends keyof Target ? true : false;

type AddEventHandlerParam = Parameters<ChatManager['addEventHandler']>[1];
type OnMessageHandler = NonNullable<AddEventHandlerParam['onMessage']>;
type OnStreamMessageHandler = NonNullable<AddEventHandlerParam['onStreamMessage']>;
type OnMessageReadHandler = NonNullable<AddEventHandlerParam['onMessageRead']>;
type OnReactionChangedHandler = NonNullable<AddEventHandlerParam['onReactionChanged']>;
type OnPinnedMessageChangedHandler = NonNullable<AddEventHandlerParam['onPinnedMessageChanged']>;

type _AddEventHandlerMatchesMap = ExpectTrue<
  IsAssignable<AddEventHandlerParam, ChatEventHandlerMap>
>;
type _AllowOnMessage = ExpectTrue<HasKey<AddEventHandlerParam, 'onMessage'>>;
type _AllowOnStreamMessage = ExpectTrue<HasKey<AddEventHandlerParam, 'onStreamMessage'>>;
type _AllowOnMessageRead = ExpectTrue<HasKey<AddEventHandlerParam, 'onMessageRead'>>;
type _AllowOnReactionChanged = ExpectTrue<HasKey<AddEventHandlerParam, 'onReactionChanged'>>;
type _AllowOnPinnedMessageChanged = ExpectTrue<
  HasKey<AddEventHandlerParam, 'onPinnedMessageChanged'>
>;
type _AllowMarkMessageRead = ExpectTrue<HasKey<ChatManager, 'markMessageRead'>>;
type _DisallowSendMessageReadAck = ExpectFalse<HasKey<ChatManager, 'sendMessageReadAck'>>;
type _DisallowSendGroupMessageReadAck = ExpectFalse<
  HasKey<ChatManager, 'sendGroupMessageReadAck'>
>;
type _DisallowOnConnected = ExpectFalse<HasKey<AddEventHandlerParam, 'onConnected'>>;
type _DisallowOnCombineMessage = ExpectFalse<
  HasKey<AddEventHandlerParam, 'onCombineMessage'>
>;
type _DisallowOnMessageStatus = ExpectFalse<HasKey<AddEventHandlerParam, 'onMessageStatus'>>;
type _DisallowOnMessagePinChange = ExpectFalse<
  HasKey<AddEventHandlerParam, 'onMessagePinChange'>
>;
type _OnMessagePayloadIsMessage = ExpectTrue<
  IsAssignable<Parameters<OnMessageHandler>[0], Message>
>;
type _OnStreamMessagePayloadIsStreamMessage = ExpectTrue<
  IsAssignable<Parameters<OnStreamMessageHandler>[0], StreamMessage>
>;
type _OnMessagePayloadHasConversationId = ExpectTrue<
  HasKey<Parameters<OnMessageHandler>[0], 'conversationId'>
>;
type _OnMessagePayloadNoChannel = ExpectFalse<HasKey<Parameters<OnMessageHandler>[0], 'channel'>>;
type _OnMessageReadPayloadIsArray = ExpectTrue<
  IsAssignable<Parameters<OnMessageReadHandler>[0], ReadonlyArray<MessageReadEventPayload>>
>;
type _OnMessageReadPayloadHasNoIsGroupAck = ExpectFalse<
  HasKey<Parameters<OnMessageReadHandler>[0][number], 'isGroupAck'>
>;
type _MarkMessageReadParamsHasMessages = ExpectTrue<HasKey<MarkMessageReadParams, 'messages'>>;
type _MarkMessageReadParamsHasNoMessage = ExpectFalse<HasKey<MarkMessageReadParams, 'message'>>;
type _OnReactionChangedPayloadHasReaction = ExpectTrue<
  HasKey<Parameters<OnReactionChangedHandler>[0], 'reaction'>
>;
type _OnPinnedMessageChangedPayloadHasOperation = ExpectTrue<
  HasKey<Parameters<OnPinnedMessageChangedHandler>[0], 'operation'>
>;
