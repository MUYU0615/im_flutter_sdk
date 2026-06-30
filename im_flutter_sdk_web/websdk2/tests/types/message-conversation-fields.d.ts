import type { ChatConversationType, Message, MessageConversationLocator } from '@/types';

type ExpectTrue<Value extends true> = Value;
type ExpectFalse<Value extends false> = Value;
type IsAssignable<Source, Target> = [Source] extends [Target] ? true : false;
type HasKey<Target, Key extends PropertyKey> = Key extends keyof Target ? true : false;

type _MessageHasConversationId = ExpectTrue<HasKey<Message, 'conversationId'>>;
type _MessageHasConversationType = ExpectTrue<HasKey<Message, 'conversationType'>>;
type _MessageNoChannel = ExpectFalse<HasKey<Message, 'channel'>>;
type _ConversationTypeValues = ExpectTrue<
  IsAssignable<ChatConversationType, 'singleChat' | 'groupChat' | 'chatRoom'>
>;
type _MessageIsConversationLocator = ExpectTrue<IsAssignable<Message, MessageConversationLocator>>;

// @ts-expect-error ChannelReference is intentionally not exported from public types.
import type { ChannelReference } from '@/types';

// @ts-expect-error ChannelType is intentionally not exported from public types.
import type { ChannelType } from '@/types';
