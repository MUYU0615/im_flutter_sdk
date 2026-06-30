import type { ChatClient } from '@/chat-client';
import type { ConnectionEventHandlerMap } from '@/types/event-system';

type ExpectTrue<Value extends true> = Value;
type ExpectFalse<Value extends false> = Value;
type IsAssignable<Source, Target> = [Source] extends [Target] ? true : false;
type HasKey<Target, Key extends PropertyKey> = Key extends keyof Target ? true : false;

type AddEventHandlerParam = Parameters<ChatClient['addEventHandler']>[1];

type _AddEventHandlerMatchesMap = ExpectTrue<IsAssignable<AddEventHandlerParam, ConnectionEventHandlerMap>>;
type _AllowOnConnecting = ExpectTrue<HasKey<AddEventHandlerParam, 'onConnecting'>>;
type _AllowOnOfflineMessageSyncStart = ExpectTrue<
  HasKey<AddEventHandlerParam, 'onOfflineMessageSyncStart'>
>;
type _AllowOnOfflineMessageSyncFinish = ExpectTrue<
  HasKey<AddEventHandlerParam, 'onOfflineMessageSyncFinish'>
>;
type _DisallowOnMessage = ExpectFalse<HasKey<AddEventHandlerParam, 'onMessage'>>;
