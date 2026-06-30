import { getRosterRoot } from '@/protocol/roster/root';
import { RosterMessageType, RosterResponseType, RosterServerStatus } from '@/protocol/roster/types';
import type { RosterItem } from '@/protocol/roster/types';

export const toArrayBuffer = (payload: Uint8Array): ArrayBuffer => {
  const buffer = new ArrayBuffer(payload.byteLength);
  new Uint8Array(buffer).set(payload);
  return buffer;
};

export const buildRosterPingFrame = (): Uint8Array => {
  const root = getRosterRoot();
  const type = root.lookupType('easemob.imfusion.gateway.v1.PingRequest');
  return type
    .encode(
      type.create({
        type: RosterMessageType.PING,
      })
    )
    .finish();
};

export const buildRosterResponseFrame = (options: {
  readonly items: ReadonlyArray<RosterItem>;
  readonly version: string;
  readonly responseType?: number;
  readonly cursor?: number;
  readonly requestId?: string;
}): Uint8Array => {
  const root = getRosterRoot();
  const type = root.lookupType('easemob.imfusion.gateway.v1.GetRosterResponse');
  return type
    .encode(
      type.create({
        type: RosterMessageType.RESPONSE,
        header: {
          resource: 'resource',
          timestamp: 1,
          requestId: options.requestId ?? 'r1',
          protocolVersion: 1,
        },
        data: options.items,
        cursor: options.cursor ?? 0,
        version: options.version,
        responseType: options.responseType ?? RosterResponseType.FULL,
      })
    )
    .finish();
};

export const buildRosterPongFrame = (status: number = RosterServerStatus.OK): Uint8Array => {
  const root = getRosterRoot();
  const type = root.lookupType('easemob.imfusion.gateway.v1.PongResponse');
  return type
    .encode(
      type.create({
        type: RosterMessageType.PONG,
        status,
      })
    )
    .finish();
};

export const buildRosterErrorFrame = (options: {
  readonly code: string;
  readonly message: string;
  readonly requestId?: string;
}): Uint8Array => {
  const root = getRosterRoot();
  const type = root.lookupType('easemob.imfusion.gateway.v1.ErrorDetail');
  return type
    .encode(
      type.create({
        type: RosterMessageType.ERROR,
        header: {
          resource: 'resource',
          timestamp: 1,
          requestId: options.requestId ?? 'r1',
          protocolVersion: 1,
        },
        code: options.code,
        message: options.message,
      })
    )
    .finish();
};

export const buildRosterUnknownFrame = (typeValue: number): Uint8Array => {
  const root = getRosterRoot();
  const type = root.lookupType('easemob.imfusion.gateway.v1.BaseMessage');
  return type
    .encode(
      type.create({
        type: typeValue,
      })
    )
    .finish();
};
