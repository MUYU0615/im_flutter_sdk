import { ChatClient } from '../../../src/chat-client';
import { GroupManager } from '../../../src/managers/group';

export const createCoreGroupClient = (): ChatClient => {
  return ChatClient.init({ appKey: 'org#app' }).use(GroupManager);
};
