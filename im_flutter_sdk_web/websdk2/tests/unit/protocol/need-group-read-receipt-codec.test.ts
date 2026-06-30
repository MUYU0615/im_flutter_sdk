import { describe, it, expect } from 'vitest';
import { MsyncCodec } from '@/protocol/msync/codec';
import { getMsyncRoot } from '@/protocol/msync/root';
import type { Message } from '@/types';

const createCodec = (): MsyncCodec =>
  new MsyncCodec({ appKey: 'test#app', userId: 'user-1', token: 'token' });

const createMessage = (overrides: Partial<Message> = {}): Message =>
  ({
    msgServerId: '',
    msgLocalId: 'local-1',
    from: 'user-1',
    to: 'group-1',
    sender: { userId: 'user-1' },
    conversationId: 'group-1',
    conversationType: 'groupChat',
    type: 'text',
    status: 'sending',
    ext: {},
    timestamp: Date.now(),
    body: { content: 'hello' },
    ...overrides,
  }) as Message;

describe('needGroupReadReceipt protocol encoding', () => {
  it('should encode msgConfig.allowGroupAck when needGroupReadReceipt is true', () => {
    const codec = createCodec();
    const message = createMessage({ needGroupReadReceipt: true });
    const bytes = codec.encodeChatMessage(message, '123');

    // 解码 MSync 外层获取 payload（CommSyncUL bytes）
    const root = getMsyncRoot();
    const msyncType = root.lookupType('easemob.pb.MSync');
    const msync = msyncType.decode(bytes) as unknown as { payload: Uint8Array };

    // 解码 CommSyncUL 获取 meta
    const commSyncUlType = root.lookupType('easemob.pb.CommSyncUL');
    const commSyncUl = commSyncUlType.decode(msync.payload) as unknown as {
      meta: { payload: Uint8Array };
    };

    // meta.payload 就是 MessageBody bytes
    const messageBodyType = root.lookupType('easemob.pb.MessageBody');
    const messageBody = messageBodyType.decode(commSyncUl.meta.payload) as unknown as {
      msgConfig?: { allowGroupAck?: boolean };
    };

    expect(messageBody.msgConfig?.allowGroupAck).toBe(true);
  });

  it('should not encode msgConfig when needGroupReadReceipt is undefined', () => {
    const codec = createCodec();
    const message = createMessage();
    const bytes = codec.encodeChatMessage(message, '456');

    const root = getMsyncRoot();
    const msyncType = root.lookupType('easemob.pb.MSync');
    const msync = msyncType.decode(bytes) as unknown as { payload: Uint8Array };

    const commSyncUlType = root.lookupType('easemob.pb.CommSyncUL');
    const commSyncUl = commSyncUlType.decode(msync.payload) as unknown as {
      meta: { payload: Uint8Array };
    };

    const messageBodyType = root.lookupType('easemob.pb.MessageBody');
    const messageBody = messageBodyType.decode(commSyncUl.meta.payload) as unknown as {
      msgConfig?: { allowGroupAck?: boolean };
    };

    expect(messageBody.msgConfig).toBeFalsy();
  });

  it('should not encode msgConfig when needGroupReadReceipt is false', () => {
    const codec = createCodec();
    const message = createMessage({ needGroupReadReceipt: false });
    const bytes = codec.encodeChatMessage(message, '789');

    const root = getMsyncRoot();
    const msyncType = root.lookupType('easemob.pb.MSync');
    const msync = msyncType.decode(bytes) as unknown as { payload: Uint8Array };

    const commSyncUlType = root.lookupType('easemob.pb.CommSyncUL');
    const commSyncUl = commSyncUlType.decode(msync.payload) as unknown as {
      meta: { payload: Uint8Array };
    };

    const messageBodyType = root.lookupType('easemob.pb.MessageBody');
    const messageBody = messageBodyType.decode(commSyncUl.meta.payload) as unknown as {
      msgConfig?: { allowGroupAck?: boolean };
    };

    expect(messageBody.msgConfig).toBeFalsy();
  });

  it('should encode meta.env when provided', () => {
    const codec = createCodec();
    const message = createMessage({ webhookEnv: 'gray' });
    const bytes = codec.encodeChatMessage(message, '901');

    const root = getMsyncRoot();
    const msyncType = root.lookupType('easemob.pb.MSync');
    const msync = msyncType.decode(bytes) as unknown as { payload: Uint8Array };

    const commSyncUlType = root.lookupType('easemob.pb.CommSyncUL');
    const commSyncUl = commSyncUlType.decode(msync.payload) as unknown as {
      meta: { env?: string };
    };

    expect(commSyncUl.meta.env).toBe('gray');
  });

  it('should encode empty meta.env when provided as empty string', () => {
    const codec = createCodec();
    const message = createMessage({ webhookEnv: '' });
    const bytes = codec.encodeChatMessage(message, '902');

    const root = getMsyncRoot();
    const msyncType = root.lookupType('easemob.pb.MSync');
    const msync = msyncType.decode(bytes) as unknown as { payload: Uint8Array };

    const commSyncUlType = root.lookupType('easemob.pb.CommSyncUL');
    const commSyncUl = commSyncUlType.decode(msync.payload) as unknown as {
      meta: { env?: string };
    };

    expect(commSyncUl.meta.env).toBe('');
  });
});
