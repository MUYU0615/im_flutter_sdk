import { describe, it, expect, beforeEach } from 'vitest';
import { CoreSDK } from '@/core';
import { EventHub } from '@/core/events/event-hub';
import { attachmentFileStore } from '@/upload/attachment-file-store';

describe('CoreSDK destroy', () => {
  beforeEach(() => {
    attachmentFileStore.clear();
  });

  it('should clear attachment cache on destroy', () => {
    const eventHub = new EventHub();
    const sdk = new CoreSDK({
      serverUrl: 'ws://example.com',
      userId: 'user-1',
      token: 'token-1',
      appKey: 'org#app',
      autoReconnectNumMax: 0,
    }, eventHub);

    const file = new File(['demo'], 'demo.txt', { type: 'text/plain' });
    attachmentFileStore.set('local-1', file);

    sdk.destroy();

    expect(attachmentFileStore.get('local-1')).toBeUndefined();
  });
});
