import { beforeEach, describe, expect, it } from 'vitest';

import { ChatClient } from '@/chat-client';
import { GroupManager } from '@/managers/group';
import { UserInfoManager } from '@/managers/user-info';
import { ValidationError } from '@/utils/errors';

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

describe('ChatClient tree-shaking optional dependency validation', () => {
  beforeEach((): void => {
    resetSingleton();
  });

  it('enableUserInfoSync=true requires explicit UserInfoManager capability', (): void => {
    expect(() =>
      ChatClient.init({
        appKey: 'org#app',
        enableUserInfoSync: true,
        managers: [GroupManager],
      })
    ).toThrow(ValidationError);
  });

  it('enableUserInfoSync=true requires explicit GroupManager namecard capability', (): void => {
    expect(() =>
      ChatClient.init({
        appKey: 'org#app',
        enableUserInfoSync: true,
        managers: [UserInfoManager],
      })
    ).toThrow(ValidationError);
  });

  it('enableUserInfoSync=true works when required managers are explicit', (): void => {
    const client = ChatClient.init({
      appKey: 'org#app',
      enableUserInfoSync: true,
      managers: [UserInfoManager, GroupManager],
    });

    expect(client.getManagerByCapability('userInfo:read')).toBeDefined();
    expect(client.getManagerByCapability('group:namecard')).toBeDefined();
  });

  it("enableSyncData=['contact'] requires explicit UserInfoManager capability", (): void => {
    expect(() =>
      ChatClient.init({
        appKey: 'org#app',
        enableSyncData: ['contact'],
      })
    ).toThrow(ValidationError);
  });

  it('disabled optional sync does not require optional managers', (): void => {
    const client = ChatClient.init({
      appKey: 'org#app',
      enableUserInfoSync: false,
      enableSyncData: [],
    });

    expect(client.getManagerByCapability('userInfo:read')).toBeUndefined();
    expect(client.getManagerByCapability('group:namecard')).toBeUndefined();
  });

  it('syncConversationListConfig only accepts includeEmpty', (): void => {
    expect(() =>
      ChatClient.init({
        appKey: 'org#app',
        syncConversationListConfig: {
          includeEmpty: true,
          includeMark: false,
        },
      } as Parameters<typeof ChatClient.init>[0])
    ).toThrow(ValidationError);
  });
});
