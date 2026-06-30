import { describe, expect, it } from 'vitest';

import { RosterCodec } from '@/protocol/roster/codec';
import { getRosterRoot } from '@/protocol/roster/root';
import { RosterMessageType, RosterResponseType, RosterServerStatus } from '@/protocol/roster/types';

describe('RosterCodec', () => {
  it('应编码 roster request', () => {
    const codec = new RosterCodec();
    const bytes = codec.encodeRequest({
      type: RosterMessageType.REQUEST,
      header: {
        resource: 'webim',
        timestamp: 1,
        requestId: 'r1',
        protocolVersion: 1,
      },
      org: 'org',
      app: 'app',
      username: 'u1',
      version: 'v1',
      cursor: 0,
    });

    expect(ArrayBuffer.isView(bytes)).toBe(true);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('应解码 ping / pong / roster response', () => {
    const codec = new RosterCodec();
    const root = getRosterRoot();

    const pingType = root.lookupType('easemob.imfusion.gateway.v1.PingRequest');
    const pingBytes = pingType
      .encode(
        pingType.create({
          type: RosterMessageType.PING,
        })
      )
      .finish();

    expect(codec.decode(pingBytes)).toEqual({
      type: RosterMessageType.PING,
    });

    const pongBytes = codec.encodePong(RosterServerStatus.OK);
    expect(codec.decode(pongBytes)).toEqual({
      type: RosterMessageType.PONG,
      status: RosterServerStatus.OK,
    });

    const responseType = root.lookupType('easemob.imfusion.gateway.v1.GetRosterResponse');
    const responseBytes = responseType
      .encode(
        responseType.create({
          type: RosterMessageType.RESPONSE,
          data: [
            {
              contact: 'u1',
              remark: 'friend',
              metadata: '{"nickname":"nick"}',
              createdAt: 10,
              updatedAt: 20,
              metadataUpdatedAt: 30,
            },
          ],
          cursor: 0,
          version: 'v2',
          responseType: RosterResponseType.FULL,
        })
      )
      .finish();

    expect(codec.decode(responseBytes)).toMatchObject({
      type: RosterMessageType.RESPONSE,
      cursor: 0,
      version: 'v2',
      responseType: RosterResponseType.FULL,
      data: [
        {
          contact: 'u1',
          remark: 'friend',
          metadata: '{"nickname":"nick"}',
          createdAt: 10,
          updatedAt: 20,
          metadataUpdatedAt: 30,
        },
      ],
    });
  });

  it('应将 MESSAGE_TYPE_ERROR 解码为 ErrorDetail', () => {
    const codec = new RosterCodec();
    const root = getRosterRoot();
    const errorType = root.lookupType('easemob.imfusion.gateway.v1.ErrorDetail');
    const errorBytes = errorType
      .encode(
        errorType.create({
          type: RosterMessageType.ERROR,
          code: '1005',
          message: 'server busy',
        })
      )
      .finish();

    expect(codec.decode(errorBytes)).toEqual({
      type: RosterMessageType.ERROR,
      header: undefined,
      code: '1005',
      message: 'server busy',
    });
  });

  it('未知消息类型不应被当作错误帧解码', () => {
    const codec = new RosterCodec();
    const root = getRosterRoot();
    const baseType = root.lookupType('easemob.imfusion.gateway.v1.BaseMessage');
    const unknownType = 99;
    const unknownBytes = baseType
      .encode(
        baseType.create({
          type: unknownType,
        })
      )
      .finish();

    expect(codec.decode(unknownBytes)).toEqual({
      type: unknownType,
    });
  });
});
