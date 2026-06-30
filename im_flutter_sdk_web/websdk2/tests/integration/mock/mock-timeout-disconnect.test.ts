// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MsyncCommand } from '@/protocol/msync/types';
import {
  buildSyncPacket,
  createMockClientCodec,
  decodeEnvelope,
  decodeProvisionPayload,
} from '../../test-utils/layered/mock-msync-client';
import {
  startMockServer,
  type MockServerController,
} from '../../test-utils/layered/mock-server-control';

let mockServer: MockServerController;

describe('mock 超时与断连异常', () => {
  beforeAll(async () => {
    mockServer = await startMockServer(19361);
  });

  afterAll(async () => {
    if (mockServer) {
      await mockServer.stop();
    }
  });

  it('超时场景应在发送 SYNC 后断连', async () => {
    await mockServer.setScenario('MOCK_TIMEOUT_DISCONNECT');
    const codec = createMockClientCodec();
    const socket = await mockServer.openSocket();

    await mockServer.sendBinary(socket, codec.encodeProvision());
    const provisionRaw = await mockServer.readBinary(socket);
    const provisionEnvelope = decodeEnvelope(codec, provisionRaw);
    expect(provisionEnvelope.command).toBe(MsyncCommand.PROVISION);
    const provision = decodeProvisionPayload(codec, provisionEnvelope.payload);
    expect(provision.ok).toBe(true);

    await mockServer.sendBinary(socket, buildSyncPacket(codec, 'timeout-001'));
    const startTime = Date.now();
    const closeResult = await mockServer.waitForClose(socket, 5000);
    const elapsed = Date.now() - startTime;

    expect(elapsed).toBeGreaterThanOrEqual(2000);
    expect(closeResult.code).toBe(4002);
    expect(closeResult.reason).toContain('sync_timeout_disconnect');
  });
});
