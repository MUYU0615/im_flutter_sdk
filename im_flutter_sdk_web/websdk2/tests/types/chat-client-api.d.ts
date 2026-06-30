import type { ChatClient } from '@/chat-client';

type ExpectTrue<Value extends true> = Value;
type IsAssignable<Source, Target> = [Source] extends [Target] ? true : false;
type HasKey<Target, Key extends PropertyKey> = Key extends keyof Target ? true : false;

type _AllowGetClientResource = ExpectTrue<HasKey<ChatClient, 'getClientResource'>>;
type _GetClientResourceReturnsNullableString = ExpectTrue<
  IsAssignable<ReturnType<ChatClient['getClientResource']>, string | null>
>;
