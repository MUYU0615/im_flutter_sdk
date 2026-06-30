import { beforeEach, describe, expect, it } from 'vitest';

import { ChatClient } from '@/chat-client';
import { ChatManager } from '@/managers/chat-manager';

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

describe('ChatClient use ChatManager', () => {
  beforeEach((): void => {
    resetSingleton();
  });

  it('should attach chatManager via use', (): void => {
    const client = ChatClient.init({ appKey: 'app-key' });
    const withManager = client.use(ChatManager);

    expect(withManager).toBe(client);
    expect(withManager.chatManager).toBeInstanceOf(ChatManager);
  });
});
