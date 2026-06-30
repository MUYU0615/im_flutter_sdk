import type { Message } from '../types';
import type { ChatConversationType, MessageType, Sender } from '../types';
import { ERROR_CODES } from '../utils/error-codes';
import { MessageReceiveError, MessageSendError } from '../utils/errors';

/** 合并消息解码后的子消息结构（内部类型） */
interface CombineMessageItem {
  msgServerId?: string;
  msgLocalId?: string;
  type: MessageType;
  sender: Sender;
  conversationId: string;
  conversationType: ChatConversationType;
  timestamp: number;
  body: Record<string, unknown>;
  ext?: Record<string, unknown>;
  combineLevel?: number;
}

const HEADER = new Uint8Array([0x63, 0x6d]); // "cm"

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const appendUint32 = (value: number): Uint8Array => {
  const bytes = new Uint8Array(4);
  bytes[0] = (value >>> 24) & 0xff;
  bytes[1] = (value >>> 16) & 0xff;
  bytes[2] = (value >>> 8) & 0xff;
  bytes[3] = value & 0xff;
  return bytes;
};

const readUint32 = (bytes: Uint8Array, offset: number): number => {
  const b0 = bytes[offset];
  const b1 = bytes[offset + 1];
  const b2 = bytes[offset + 2];
  const b3 = bytes[offset + 3];
  if (
    typeof b0 !== 'number' ||
    typeof b1 !== 'number' ||
    typeof b2 !== 'number' ||
    typeof b3 !== 'number'
  ) {
    throw new MessageReceiveError('Combine payload length header is invalid', {
      code: ERROR_CODES.COMBINE_PARSE_FAILED,
    });
  }
  return (b0 << 24) | (b1 << 16) | (b2 << 8) | b3;
};

const calculateChecksum = (bytes: Uint8Array): number => {
  let checkResult = 0x00;
  for (let i = 2; i < bytes.length; i += 1) {
    if (i % 2 === 1) {
      checkResult ^= bytes[i] ?? 0;
    }
  }
  return checkResult;
};

const parseCombineItem = (jsonString: string, index: number): CombineMessageItem => {
  try {
    const parsed = JSON.parse(jsonString) as unknown;
    if (!isPlainObject(parsed)) {
      throw new MessageReceiveError('Combine payload item is invalid', {
        code: ERROR_CODES.COMBINE_PARSE_FAILED,
        details: {
          index,
        },
      });
    }
    return parsed as unknown as CombineMessageItem;
  } catch (error) {
    if (error instanceof MessageReceiveError) {
      throw error;
    }
    throw new MessageReceiveError('Combine payload item parse failed', {
      code: ERROR_CODES.COMBINE_PARSE_FAILED,
      details: {
        index,
        cause: error instanceof Error ? error.message : String(error),
      },
    });
  }
};

export const encodeCombineMessageList = (
  messageList: ReadonlyArray<Message>
): Uint8Array => {
  try {
    const encodedItems = messageList.map((item, index) => {
      const jsonString = JSON.stringify(item);
      if (!jsonString) {
        throw new MessageSendError('Combine payload item encode failed', {
          code: ERROR_CODES.COMBINE_ENCODE_FAILED,
          details: {
            index,
          },
        });
      }
      return encoder.encode(jsonString);
    });

    const totalLength =
      HEADER.length +
      encodedItems.reduce((sum, bytes) => {
        return sum + 4 + bytes.length;
      }, 0) +
      1;

    const output = new Uint8Array(totalLength);
    let offset = 0;

    output.set(HEADER, offset);
    offset += HEADER.length;

    for (const bytes of encodedItems) {
      const lengthHeader = appendUint32(bytes.length);
      output.set(lengthHeader, offset);
      offset += lengthHeader.length;
      output.set(bytes, offset);
      offset += bytes.length;
    }

    const checksum = calculateChecksum(output.subarray(0, output.length - 1));
    output[output.length - 1] = checksum;
    return output;
  } catch (error) {
    if (error instanceof MessageSendError) {
      throw error;
    }
    throw new MessageSendError('Combine payload encode failed', {
      code: ERROR_CODES.COMBINE_ENCODE_FAILED,
      details: {
        cause: error instanceof Error ? error.message : String(error),
      },
    });
  }
};

export const decodeCombineMessageList = (
  payload: Uint8Array
): ReadonlyArray<CombineMessageItem> => {
  if (payload.length < HEADER.length + 1) {
    throw new MessageReceiveError('Combine payload is too short', {
      code: ERROR_CODES.COMBINE_PARSE_FAILED,
    });
  }

  const magic = payload.subarray(0, HEADER.length);
  if (magic[0] !== HEADER[0] || magic[1] !== HEADER[1]) {
    throw new MessageReceiveError('Combine payload header is invalid', {
      code: ERROR_CODES.COMBINE_PARSE_FAILED,
    });
  }

  const dataBytes = payload.subarray(0, payload.length - 1);
  const expectedChecksum = calculateChecksum(dataBytes);
  const actualChecksum = payload[payload.length - 1] ?? 0;
  if (actualChecksum !== expectedChecksum) {
    throw new MessageReceiveError('Combine payload checksum failed', {
      code: ERROR_CODES.COMBINE_PARSE_FAILED,
      details: {
        expectedChecksum,
        actualChecksum,
      },
    });
  }

  const result: CombineMessageItem[] = [];
  let offset = HEADER.length;
  const dataEndOffset = payload.length - 1;

  while (offset < dataEndOffset) {
    if (offset + 4 > dataEndOffset) {
      throw new MessageReceiveError('Combine payload length header is incomplete', {
        code: ERROR_CODES.COMBINE_PARSE_FAILED,
      });
    }

    const itemLength = readUint32(payload, offset);
    offset += 4;

    if (itemLength <= 0 || offset + itemLength > dataEndOffset) {
      throw new MessageReceiveError('Combine payload item length is invalid', {
        code: ERROR_CODES.COMBINE_PARSE_FAILED,
        details: {
          itemLength,
        },
      });
    }

    const itemBytes = payload.subarray(offset, offset + itemLength);
    offset += itemLength;
    const itemJson = decoder.decode(itemBytes);
    const item = parseCombineItem(itemJson, result.length);
    result.push(item);
  }

  if (offset !== dataEndOffset) {
    throw new MessageReceiveError('Combine payload has unexpected trailing bytes', {
      code: ERROR_CODES.COMBINE_PARSE_FAILED,
      details: {
        offset,
        expected: dataEndOffset,
      },
    });
  }

  return result;
};
