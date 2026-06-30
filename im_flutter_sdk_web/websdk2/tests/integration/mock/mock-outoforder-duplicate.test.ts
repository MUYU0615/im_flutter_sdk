// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MsyncCommand } from '@/protocol/msync/types';
import {
  buildSyncPacket,
  createMockClientCodec,
  decodeEnvelope,
  decodeSyncPayload,
} from '../../test-utils/layered/mock-msync-client';
import {
  startMockServer,
  type MockServerController,
} from '../../test-utils/layered/mock-server-control';

let mockServer: MockServerController;

describe('mock 乱序与重复响应', () => {
  beforeAll(async () => {
    mockServer = await startMockServer(19362);
  });

  afterAll(async () => {
    if (mockServer) {
      await mockServer.stop();
    }
  });

  it('应返回乱序且重复的 ACK', async () => {
    await mockServer.setScenario('MOCK_OUTOFORDER_DUPLICATE');
    const codec = createMockClientCodec();
    const socket = await mockServer.openSocket();

    await mockServer.sendBinary(socket, codec.encodeProvision());
    await mockServer.readBinary(socket);

    const protocolId1 = codec.toProtocolId('out-order-001');
    const protocolId2 = codec.toProtocolId('out-order-002');
    await mockServer.sendBinary(socket, buildSyncPacket(codec, 'out-order-001'));
    await mockServer.sendBinary(socket, buildSyncPacket(codec, 'out-order-002'));

    const ackIds: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      const raw = await mockServer.readBinary(socket);
      const envelope = decodeEnvelope(codec, raw);
      expect(envelope.command).toBe(MsyncCommand.SYNC);
      const syncResult = decodeSyncPayload(codec, envelope.payload);
      expect(syncResult.ack?.ok).toBe(true);
      ackIds.push(syncResult.ack?.protocolId ?? '');
    }

    expect(ackIds).toEqual([protocolId2, protocolId1, protocolId2]);
    expect(new Set(ackIds).size).toBeLessThan(ackIds.length);

    socket.close();
  });
});
