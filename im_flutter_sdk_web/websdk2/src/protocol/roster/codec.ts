/**
 * Roster 编解码器
 */

import Long from 'long';

import { getRosterRoot } from './root';
import { RosterMessageType, RosterResponseType, RosterServerStatus } from './types';
import type {
  RosterBaseMessage,
  RosterDecodedMessage,
  RosterErrorDetail,
  RosterGatewayHeader,
  RosterItem,
  RosterPongResponse,
  RosterRequest,
  RosterResponse,
} from './types';

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') {
    return value;
  }
  if (Long.isLong(value)) {
    return value.toNumber();
  }
  return 0;
};

const normalizeHeader = (value: unknown): RosterGatewayHeader | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  return {
    resource: typeof record.resource === 'string' ? record.resource : '',
    timestamp: toNumber(record.timestamp),
    requestId: typeof record.requestId === 'string' ? record.requestId : '',
    protocolVersion: toNumber(record.protocolVersion),
  };
};

const normalizeItem = (value: unknown): RosterItem => {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    contact: typeof record.contact === 'string' ? record.contact : '',
    remark: typeof record.remark === 'string' ? record.remark : '',
    metadata: typeof record.metadata === 'string' ? record.metadata : '',
    createdAt: toNumber(record.createdAt),
    updatedAt: toNumber(record.updatedAt),
    metadataUpdatedAt: toNumber(record.metadataUpdatedAt),
  };
};

export class RosterCodec {
  public encodeRequest(payload: RosterRequest): Uint8Array {
    const root = getRosterRoot();
    const type = root.lookupType('easemob.imfusion.gateway.v1.GetRosterRequest');
    return type.encode(type.create(payload)).finish();
  }

  public encodePong(status: number = RosterServerStatus.OK): Uint8Array {
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
  }

  public decode(payload: Uint8Array): RosterDecodedMessage {
    const root = getRosterRoot();
    const baseType = root.lookupType('easemob.imfusion.gateway.v1.BaseMessage');
    const base = baseType.decode(payload) as unknown as RosterBaseMessage;

    switch (base.type) {
      case RosterMessageType.PING: {
        return { type: RosterMessageType.PING };
      }
      case RosterMessageType.PONG: {
        const pongType = root.lookupType('easemob.imfusion.gateway.v1.PongResponse');
        const decoded = pongType.decode(payload) as unknown as Record<string, unknown>;
        const pong: RosterPongResponse = {
          type: RosterMessageType.PONG,
          status: toNumber(decoded.status),
        };
        return pong;
      }
      case RosterMessageType.RESPONSE: {
        const responseType = root.lookupType('easemob.imfusion.gateway.v1.GetRosterResponse');
        const decoded = responseType.decode(payload) as unknown as Record<string, unknown>;
        const response: RosterResponse = {
          type: RosterMessageType.RESPONSE,
          header: normalizeHeader(decoded.header),
          data: Array.isArray(decoded.data) ? decoded.data.map(item => normalizeItem(item)) : [],
          cursor: toNumber(decoded.cursor),
          version: typeof decoded.version === 'string' ? decoded.version : '',
          responseType: toNumber(decoded.responseType) || RosterResponseType.UNSPECIFIED,
        };
        return response;
      }
      case RosterMessageType.ERROR: {
        const errorType = root.lookupType('easemob.imfusion.gateway.v1.ErrorDetail');
        const decoded = errorType.decode(payload) as unknown as Record<string, unknown>;
        const errorDetail: RosterErrorDetail = {
          type: RosterMessageType.ERROR,
          header: normalizeHeader(decoded.header),
          code: typeof decoded.code === 'string' ? decoded.code : '',
          message: typeof decoded.message === 'string' ? decoded.message : 'Unknown roster error',
        };
        return errorDetail;
      }
      default: {
        return {
          type: typeof base.type === 'number' ? base.type : RosterMessageType.UNSPECIFIED,
        };
      }
    }
  }
}
