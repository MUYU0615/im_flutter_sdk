/**
 * ProtoAdapter 抽象与编解码注册器
 */

import { Type } from 'protobufjs/light';

import {
  PLATFORM_ERROR_CODE,
  PLATFORM_ERROR_STAGE,
  createPlatformError,
  type ProtoAdapter as PlatformProtoAdapter,
} from '../types';

export type ProtoAdapter = PlatformProtoAdapter;

export interface ProtoTypeCodec {
  encode(payload: unknown): Uint8Array;
  decode(payload: Uint8Array): unknown;
}

const assertTypeName = (typeName: string): void => {
  if (!typeName || typeName.trim().length === 0) {
    throw createPlatformError('Proto type name is required.', {
      code: PLATFORM_ERROR_CODE.PROTO_FAILED,
      stage: PLATFORM_ERROR_STAGE.PROTO,
      retryable: false,
      details: {
        typeName,
      },
    });
  }
};

const ensureObjectPayload = (payload: unknown, typeName: string): Record<string, unknown> => {
  if (typeof payload === 'object' && payload !== null) {
    return payload as Record<string, unknown>;
  }
  throw createPlatformError('Proto payload must be an object.', {
    code: PLATFORM_ERROR_CODE.PROTO_FAILED,
    stage: PLATFORM_ERROR_STAGE.PROTO,
    retryable: false,
    details: {
      typeName,
      payloadType: typeof payload,
    },
  });
};

export class ProtoCodecRegistry {
  private readonly codecMap: Map<string, ProtoTypeCodec> = new Map();

  register(typeName: string, codec: ProtoTypeCodec): void {
    assertTypeName(typeName);
    this.codecMap.set(typeName, codec);
  }

  registerType(typeName: string, protoType: Type): void {
    this.register(typeName, {
      encode: (payload: unknown): Uint8Array => {
        const objectPayload = ensureObjectPayload(payload, typeName);
        const created = protoType.fromObject(objectPayload);
        return protoType.encode(created).finish();
      },
      decode: (payload: Uint8Array): unknown => {
        const decoded = protoType.decode(payload);
        return protoType.toObject(decoded, {
          longs: String,
          enums: Number,
          defaults: false,
        });
      },
    });
  }

  get(typeName: string): ProtoTypeCodec | undefined {
    assertTypeName(typeName);
    return this.codecMap.get(typeName);
  }

  getOrThrow(typeName: string): ProtoTypeCodec {
    const codec = this.get(typeName);
    if (codec) {
      return codec;
    }
    throw createPlatformError('Proto codec not found.', {
      code: PLATFORM_ERROR_CODE.PROTO_FAILED,
      stage: PLATFORM_ERROR_STAGE.PROTO,
      retryable: false,
      details: {
        typeName,
      },
    });
  }
}
