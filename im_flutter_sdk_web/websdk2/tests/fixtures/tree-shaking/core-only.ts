import { ChatClient } from '../../../src/chat-client';

export const createCoreOnlyClient = (): ChatClient => {
  return ChatClient.init({ appKey: 'org#app' });
};
