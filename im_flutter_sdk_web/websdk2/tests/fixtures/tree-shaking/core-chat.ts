import { ChatClient } from '../../../src/chat-client';
import { ChatManager } from '../../../src/managers/chat';

export const createCoreChatClient = (): ChatClient => {
  return ChatClient.init({ appKey: 'org#app' }).use(ChatManager);
};
