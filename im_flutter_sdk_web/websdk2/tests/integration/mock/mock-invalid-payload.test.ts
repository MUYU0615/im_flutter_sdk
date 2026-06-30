// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMockClientCodec, decodeEnvelope } from '../../test-utils/layered/mock-msync-client';
import {
  startMockServer,
  type MockServerController,
} from '../../test-utils/layered/mock-server-control';

let mockServer: MockServerController;

describe('mock 非法响应与协议异常', () => {
  beforeAll(async () => {
    mockServer = await startMockServer(19363);
  });

  afterAll(async () => {
    if (mockServer) {
      await mockServer.stop();
    }
  });

  it('非法 protobuf payload 应触发解码失败', async () => {
    await mockServer.setScenario('MOCK_INVALID_PAYLOAD');
    const codec = createMockClientCodec();
    const socket = await mockServer.openSocket();

    await mockServer.sendBinary(socket, codec.encodeProvision());
    const raw = await mockServer.readBinary(socket);

    expect(() => decodeEnvelope(codec, raw)).toThrow();

    socket.close();
  });
});
