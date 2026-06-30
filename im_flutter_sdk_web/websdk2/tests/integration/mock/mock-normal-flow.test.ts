// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MsyncCommand } from '@/protocol/msync/types';
import {
  buildSyncPacket,
  createMockClientCodec,
  decodeEnvelope,
  decodeProvisionPayload,
  decodeSyncPayload,
} from '../../test-utils/layered/mock-msync-client';
import {
  startMockServer,
  type MockServerController,
} from '../../test-utils/layered/mock-server-control';

let mockServer: MockServerController;

describe('mock 正常协议链路', () => {
  beforeAll(async () => {
    mockServer = await startMockServer(19364);
  });

  afterAll(async () => {
    if (mockServer) {
      await mockServer.stop();
    }
  });

  it('应完成 provision、ACK 与下行消息收发', async () => {
    await mockServer.setScenario('NORMAL_FLOW');
    const codec = createMockClientCodec();
    const socket = await mockServer.openSocket();

    await mockServer.sendBinary(socket, codec.encodeProvision());
    const provisionRaw = await mockServer.readBinary(socket, 15000);
    const provisionEnvelope = decodeEnvelope(codec, provisionRaw);
    expect(provisionEnvelope.command).toBe(MsyncCommand.PROVISION);
    const provision = decodeProvisionPayload(codec, provisionEnvelope.payload);
    expect(provision.ok).toBe(true);
    expect(provision.resource).toBe('mock-resource');

    const localId = 'normal-flow-001';
    const protocolId = codec.toProtocolId(localId);
    await mockServer.sendBinary(socket, buildSyncPacket(codec, localId));

    const ackRaw = await mockServer.readBinary(socket, 15000);
    const ackEnvelope = decodeEnvelope(codec, ackRaw);
    expect(ackEnvelope.command).toBe(MsyncCommand.SYNC);
    const ackResult = decodeSyncPayload(codec, ackEnvelope.payload);
    expect(ackResult.ack?.ok).toBe(true);
    expect(ackResult.ack?.protocolId).toBe(protocolId);

    const messageRaw = await mockServer.readBinary(socket, 15000);
    const messageEnvelope = decodeEnvelope(codec, messageRaw);
    const messageResult = decodeSyncPayload(codec, messageEnvelope.payload);
    expect(messageResult.messages.length).toBeGreaterThan(0);
    expect(messageResult.messages[0]?.sender.userId).toBe('mock-peer');

    socket.close();
  }, 20000);
});
