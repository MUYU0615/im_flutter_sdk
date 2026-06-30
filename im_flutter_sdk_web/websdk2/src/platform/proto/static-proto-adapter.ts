/**
 * 静态 protobuf 适配器
 */

import Long from 'long';
import {
  Namespace,
  Root,
  Type,
  configure,
  util,
  type INamespace,
  type ReflectionObject,
} from 'protobufjs/light';

import msyncProtoJson from '../../protocol/msync/proto';
import { PLATFORM_ERROR_CODE, PLATFORM_ERROR_STAGE, createPlatformError } from '../types';
import { ProtoCodecRegistry, type ProtoAdapter } from './proto-adapter';

let longConfigured = false;
let cachedRoot: Root | null = null;
let cachedRegistry: ProtoCodecRegistry | null = null;
let cachedAdapter: ProtoAdapter | null = null;

const normalizeTypeName = (typeName: string): string => {
  return typeName.startsWith('.') ? typeName.slice(1) : typeName;
};

const ensureLongConfigured = (): void => {
  if (longConfigured) {
    return;
  }
  util.Long = Long;
  configure();
  longConfigured = true;
};

const createStaticRoot = (): Root => {
  ensureLongConfigured();
  return Root.fromJSON(msyncProtoJson as INamespace);
};

const isNamespace = (value: ReflectionObject): value is Namespace => {
  return value instanceof Namespace;
};

const isMessageType = (value: ReflectionObject): value is Type => {
  return value instanceof Type;
};

const registerNamespaceTypes = (namespace: Namespace, registry: ProtoCodecRegistry): void => {
  const nested = namespace.nestedArray;
  for (const item of nested) {
    if (isMessageType(item)) {
      const typeName = normalizeTypeName(item.fullName);
      registry.registerType(typeName, item);
      continue;
    }
    if (isNamespace(item)) {
      registerNamespaceTypes(item, registry);
    }
  }
};

const getStaticRegistry = (): ProtoCodecRegistry => {
  if (cachedRegistry) {
    return cachedRegistry;
  }
  const registry = new ProtoCodecRegistry();
  const root = getStaticProtoRoot();
  registerNamespaceTypes(root, registry);
  cachedRegistry = registry;
  return registry;
};

const mapProtoError = (
  typeName: string,
  error: unknown,
  operation: 'encode' | 'decode'
): Error => {
  const message = error instanceof Error ? error.message : String(error);
  return createPlatformError(`Static proto ${operation} failed.`, {
    code: PLATFORM_ERROR_CODE.PROTO_FAILED,
    stage: PLATFORM_ERROR_STAGE.PROTO,
    retryable: false,
    details: {
      typeName,
      operation,
      cause: message,
    },
  });
};

export const getStaticProtoRoot = (): Root => {
  if (cachedRoot) {
    return cachedRoot;
  }
  cachedRoot = createStaticRoot();
  return cachedRoot;
};

export const createStaticProtoAdapter = (): ProtoAdapter => {
  if (cachedAdapter) {
    return cachedAdapter;
  }

  const registry = getStaticRegistry();
  cachedAdapter = {
    encode<TInput>(typeName: string, payload: TInput): Uint8Array {
      try {
        const codec = registry.getOrThrow(normalizeTypeName(typeName));
        return codec.encode(payload);
      } catch (error) {
        throw mapProtoError(typeName, error, 'encode');
      }
    },
    decode<TOutput>(typeName: string, payload: Uint8Array): TOutput {
      try {
        const codec = registry.getOrThrow(normalizeTypeName(typeName));
        return codec.decode(payload) as TOutput;
      } catch (error) {
        throw mapProtoError(typeName, error, 'decode');
      }
    },
  };
  return cachedAdapter;
};
