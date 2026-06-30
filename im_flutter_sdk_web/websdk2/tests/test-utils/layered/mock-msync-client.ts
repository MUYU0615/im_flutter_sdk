import { MsyncCodec, type SyncDecodeResult, type ProvisionResult } from '@/protocol/msync/codec';
import type { Message } from '@/types';

export interface MsyncEnvelope {
  readonly command: number;
  readonly payload: Uint8Array;
}

export const createMockClientCodec = (): MsyncCodec => {
  return new MsyncCodec({
    appKey: 'test#app',
    userId: 'mock-client',
    token: 'mock-token',
    useFixedDeviceId: true,
    deviceId: 'mock-device',
  });
};

export const decodeEnvelope = (codec: MsyncCodec, raw: Uint8Array): MsyncEnvelope => {
  return codec.decodeMsync(raw);
};

export const decodeProvisionPayload = (codec: MsyncCodec, payload: Uint8Array): ProvisionResult => {
  return codec.decodeProvision(payload);
};

export const decodeSyncPayload = (codec: MsyncCodec, payload: Uint8Array): SyncDecodeResult => {
  return codec.decodeSync(payload);
};

const buildTextMessage = (msgLocalId: string): Message => {
  return {
    msgServerId: '',
    msgLocalId,
    from: 'mock-client',
    to: 'peer-user',
    sender: {
      userId: 'mock-client',
    },
    conversationId: 'peer-user',
    conversationType: 'singleChat',
    type: 'text',
    status: 'sending',
    ext: {},
    timestamp: Date.now(),
    body: {
      content: `mock message ${msgLocalId}`,
    },
  };
};

export const buildSyncPacket = (codec: MsyncCodec, msgLocalId: string): Uint8Array => {
  const message = buildTextMessage(msgLocalId);
  const protocolId = codec.toProtocolId(msgLocalId);
  return codec.encodeChatMessage(message, protocolId);
};
