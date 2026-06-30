import type { ChatClient } from '@/chat-client';
import type { ManagerBase } from '@/types/manager';

type ExpectTrue<Value extends true> = Value;
type ExpectFalse<Value extends false> = Value;
type HasKey<Target, Key extends PropertyKey> = Key extends keyof Target ? true : false;

declare class TestChatManager implements ManagerBase<ChatClient> {
  static readonly key: 'chatManager';
  bind(client: ChatClient, context?: unknown): void;
}

declare class TestContactManager implements ManagerBase<ChatClient> {
  static readonly key: 'contactManager';
  bind(client: ChatClient, context?: unknown): void;
}

type Managers = readonly [typeof TestChatManager, typeof TestContactManager];
type ClientFromInit = ReturnType<typeof ChatClient.init<Managers>>;

type _InitHasChatManager = ExpectTrue<HasKey<ClientFromInit, 'chatManager'>>;
type _InitHasContactManager = ExpectTrue<HasKey<ClientFromInit, 'contactManager'>>;
type _BaseClientNoManager = ExpectFalse<HasKey<ChatClient, 'chatManager'>>;
