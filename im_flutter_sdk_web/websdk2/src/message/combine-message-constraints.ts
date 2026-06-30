import type { Message } from '../types';
import { ERROR_CODES } from '../utils/error-codes';
import { ValidationError } from '../utils/errors';

export const MAX_COMBINE_MESSAGE_COUNT = 300;
export const MAX_COMBINE_LEVEL = 10;

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const throwValidationError = (message: string, path: string, code: number): never => {
  throw new ValidationError(message, {
    code,
    details: {
      fields: [
        {
          path,
          message,
          rule: 'invalid_format',
        },
      ],
    },
  });
};

const readCombineLevel = (item: Message): number => {
  if (item.type !== 'combine') {
    return 0;
  }
  if (typeof item.combineLevel === 'number') {
    return item.combineLevel;
  }
  if (isPlainObject(item.body) && typeof item.body['combineLevel'] === 'number') {
    return item.body['combineLevel'];
  }
  return 0;
};

const validateCombineItem = (item: Message, index: number): void => {
  if (!item.sender.userId) {
    throwValidationError(
      `messageList[${index}] sender.userId is required`,
      `messageList[${index}].sender.userId`,
      ERROR_CODES.COMBINE_INVALID_INPUT
    );
  }

  if (
    !item.conversationId ||
    !['singleChat', 'groupChat', 'chatRoom'].includes(item.conversationType)
  ) {
    throwValidationError(
      `messageList[${index}] conversation is invalid`,
      `messageList[${index}].conversationId`,
      ERROR_CODES.COMBINE_INVALID_INPUT
    );
  }

  if (!Number.isInteger(item.timestamp) || item.timestamp <= 0) {
    throwValidationError(
      `messageList[${index}] timestamp must be positive integer`,
      `messageList[${index}].timestamp`,
      ERROR_CODES.COMBINE_INVALID_INPUT
    );
  }

  if (!isPlainObject(item.body)) {
    throwValidationError(
      `messageList[${index}] body must be object`,
      `messageList[${index}].body`,
      ERROR_CODES.COMBINE_INVALID_INPUT
    );
  }

  if (item.type === 'combine') {
    const itemLevel = readCombineLevel(item);
    if (!Number.isInteger(itemLevel) || itemLevel < 0) {
      throwValidationError(
        `messageList[${index}] combineLevel is invalid`,
        `messageList[${index}].combineLevel`,
        ERROR_CODES.COMBINE_INVALID_INPUT
      );
    }
    if (itemLevel > MAX_COMBINE_LEVEL) {
      throwValidationError(
        `messageList[${index}] combineLevel exceeds limit`,
        `messageList[${index}].combineLevel`,
        ERROR_CODES.COMBINE_LEVEL_EXCEEDED
      );
    }
  }
};

export const ensureCombineItemLimit = (
  count: number,
  max: number = MAX_COMBINE_MESSAGE_COUNT
): void => {
  if (!Number.isInteger(count) || count <= 0) {
    throwValidationError(
      'messageList must not be empty',
      'messageList',
      ERROR_CODES.COMBINE_INVALID_INPUT
    );
  }

  if (!Number.isInteger(max) || max <= 0 || max > MAX_COMBINE_MESSAGE_COUNT) {
    throwValidationError('max items is invalid', 'maxItems', ERROR_CODES.COMBINE_INVALID_INPUT);
  }

  if (count > max) {
    throwValidationError(
      `messageList max length is ${max}`,
      'messageList',
      ERROR_CODES.COMBINE_ITEM_LIMIT_EXCEEDED
    );
  }
};

export const validateCombineMessageList = (
  messageList: ReadonlyArray<Message>
): void => {
  ensureCombineItemLimit(messageList.length);
  for (let index = 0; index < messageList.length; index += 1) {
    const item = messageList[index];
    if (!item) {
      throwValidationError(
        `messageList[${index}] is required`,
        `messageList[${index}]`,
        ERROR_CODES.COMBINE_INVALID_INPUT
      );
    }
    validateCombineItem(item!, index);
  }
};

export const calculateCombineLevel = (messageList: ReadonlyArray<Message>): number => {
  let maxInputLevel = 0;
  for (const item of messageList) {
    if (item.type !== 'combine') {
      continue;
    }
    const level = readCombineLevel(item);
    if (level > maxInputLevel) {
      maxInputLevel = level;
    }
  }
  return maxInputLevel + 1;
};

export const ensureCombineLevel = (combineLevel: number): void => {
  if (!Number.isInteger(combineLevel) || combineLevel <= 0) {
    throwValidationError(
      'combineLevel must be positive integer',
      'combineLevel',
      ERROR_CODES.COMBINE_INVALID_INPUT
    );
  }

  if (combineLevel > MAX_COMBINE_LEVEL) {
    throwValidationError(
      `combineLevel must be <= ${MAX_COMBINE_LEVEL}`,
      'combineLevel',
      ERROR_CODES.COMBINE_LEVEL_EXCEEDED
    );
  }
};
