import { describe, it, expect, beforeEach } from 'vitest';
import { ChatClient } from '@/chat-client';
import { ValidationError } from '@/utils/errors';
import { MsyncCodec } from '@/protocol/msync/codec';
import { getMsyncRoot } from '@/protocol/msync/root';
import { MsyncCommand } from '@/protocol/msync/types';

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

describe('loginExtensionInfo', () => {
  beforeEach((): void => {
    resetSingleton();
  });

  it('should accept valid loginExtensionInfo', (): void => {
    const client = ChatClient.init({
      appKey: 'app-key',
      loginExtensionInfo: '{"device":"iPhone"}',
    });
    expect(client.getConnectionState()).toBe('disconnected');
  });

  it('should reject loginExtensionInfo exceeding 1024 characters', (): void => {
    expect(() =>
      ChatClient.init({
        appKey: 'app-key',
        loginExtensionInfo: 'x'.repeat(1025),
      })
    ).toThrow(ValidationError);
  });

  it('should allow loginExtensionInfo at exactly 1024 characters', (): void => {
    const client = ChatClient.init({
      appKey: 'app-key',
      loginExtensionInfo: 'x'.repeat(1024),
    });
    expect(client.getConnectionState()).toBe('disconnected');
  });

  it('should encode loginExtensionInfo into provision reason field', (): void => {
    const codec = new MsyncCodec({
      appKey: 'test#app',
      userId: 'user1',
      token: 'token123',
      loginExtensionInfo: '{"kick":"reason"}',
    });

    const bytes = codec.encodeProvision();
    const root = getMsyncRoot();
    const msyncType = root.lookupType('easemob.pb.MSync');
    const decoded = msyncType.decode(bytes) as unknown as { command: number; payload: Uint8Array };

    expect(decoded.command).toBe(MsyncCommand.PROVISION);

    const provisionType = root.lookupType('easemob.pb.Provision');
    const provision = provisionType.decode(decoded.payload) as { reason?: string };
    expect(provision.reason).toBe('{"kick":"reason"}');
  });

  it('should not set reason field when loginExtensionInfo is undefined', (): void => {
    const codec = new MsyncCodec({
      appKey: 'test#app',
      userId: 'user1',
      token: 'token123',
    });

    const bytes = codec.encodeProvision();
    const root = getMsyncRoot();
    const msyncType = root.lookupType('easemob.pb.MSync');
    const decoded = msyncType.decode(bytes) as unknown as { command: number; payload: Uint8Array };

    const provisionType = root.lookupType('easemob.pb.Provision');
    const provision = provisionType.decode(decoded.payload) as { reason?: string };
    expect(provision.reason).toBeFalsy();
  });
});
