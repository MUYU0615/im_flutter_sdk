import type { Type } from 'protobufjs/light';

import { getMsyncRoot } from '../msync/root';
import type { MessageBody } from '../../types';

const messageBodyType = (): Type => {
  return getMsyncRoot().lookupType('easemob.pb.MessageBody');
};

const toRecord = (value: unknown): Record<string, unknown> => {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
};

const decodeMessageBodyPayload = (payload: Uint8Array): Record<string, unknown> => {
  const decoded = messageBodyType().toObject(messageBodyType().decode(payload), {
    longs: Number,
    bytes: Uint8Array,
  }) as Record<string, unknown>;
  const contents = Array.isArray(decoded.contents) ? decoded.contents : [];
  const firstContent = toRecord(contents[0]);
  const contentType = typeof firstContent.type === 'number' ? firstContent.type : 0;

  if (contentType === 0) {
    return {
      type: 'text',
      content: typeof firstContent.text === 'string' ? firstContent.text : '',
    } satisfies MessageBody & Record<string, unknown>;
  }

  if (contentType === 1) {
    return {
      type: 'image',
      filename: typeof firstContent.displayName === 'string' ? firstContent.displayName : 'image',
      remotePath: typeof firstContent.remotePath === 'string' ? firstContent.remotePath : '',
    };
  }

  if (contentType === 2) {
    return {
      type: 'video',
      filename: typeof firstContent.displayName === 'string' ? firstContent.displayName : 'video',
      remotePath: typeof firstContent.remotePath === 'string' ? firstContent.remotePath : '',
    };
  }

  if (contentType === 3) {
    return {
      type: 'location',
      latitude: typeof firstContent.latitude === 'number' ? firstContent.latitude : 0,
      longitude: typeof firstContent.longitude === 'number' ? firstContent.longitude : 0,
      address: typeof firstContent.address === 'string' ? firstContent.address : undefined,
    };
  }

  if (contentType === 4) {
    return {
      type: 'voice',
      filename: typeof firstContent.displayName === 'string' ? firstContent.displayName : 'voice',
      remotePath: typeof firstContent.remotePath === 'string' ? firstContent.remotePath : '',
      duration: typeof firstContent.duration === 'number' ? firstContent.duration : 0,
    };
  }

  if (contentType === 5) {
    return {
      type: 'file',
      filename: typeof firstContent.displayName === 'string' ? firstContent.displayName : 'file',
      remotePath: typeof firstContent.remotePath === 'string' ? firstContent.remotePath : '',
    };
  }

  if (contentType === 6) {
    return {
      type: 'cmd',
      action: typeof firstContent.action === 'string' ? firstContent.action : '',
    };
  }

  if (contentType === 7) {
    return {
      type: 'custom',
      event: typeof firstContent.customEvent === 'string' ? firstContent.customEvent : '',
    };
  }

  if (contentType === 8) {
    return {
      type: 'combine',
      title: typeof firstContent.title === 'string' ? firstContent.title : '',
      summary: typeof firstContent.summary === 'string' ? firstContent.summary : '',
    };
  }

  return {};
};

export const decodeSessionListPayloadBody = (payload?: Uint8Array): Record<string, unknown> => {
  if (!payload || payload.byteLength === 0) {
    return {};
  }
  try {
    return decodeMessageBodyPayload(payload);
  } catch {
    return {};
  }
};
