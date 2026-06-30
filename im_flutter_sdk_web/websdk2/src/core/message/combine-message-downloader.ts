import type { RequestAdapter } from '../../platform';
import { createWebRequestAdapter } from '../../platform/request/web-request-adapter';
import { decodeCombineMessageList } from '../../message/combine-payload-codec';
import {
  ensureCombineItemLimit,
  MAX_COMBINE_MESSAGE_COUNT,
  validateCombineMessageList,
} from '../../message/combine-message-constraints';
import type { CombineMessageBody, DownloadCombineMessageParams, Message } from '../../types';
import { appendAttachUrlParams } from '../../upload/utils';
import { ERROR_CODES } from '../../utils/error-codes';
import { MessageReceiveError, ValidationError } from '../../utils/errors';

const DEFAULT_TIMEOUT_MS = 15_000;

const toUint8Array = (value: unknown): Uint8Array => {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (typeof value === 'string') {
    return new TextEncoder().encode(value);
  }
  throw new MessageReceiveError('Combine payload response type is invalid', {
    code: ERROR_CODES.COMBINE_DOWNLOAD_FAILED,
  });
};

const toErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

const buildRequestAdapter = (requestAdapter?: RequestAdapter): RequestAdapter | undefined => {
  if (requestAdapter) {
    return requestAdapter;
  }
  if (typeof fetch !== 'function') {
    return undefined;
  }
  return createWebRequestAdapter({
    fetchImpl: fetch,
  });
};

const resolveCombineLevel = (message: Message): number | undefined => {
  if (message.type !== 'combine') {
    return undefined;
  }
  if (typeof message.combineLevel === 'number') {
    return message.combineLevel;
  }
  const combineBody = message.body as CombineMessageBody;
  if (typeof combineBody.combineLevel === 'number') {
    return combineBody.combineLevel;
  }
  return 0;
};

export class CombineMessageDownloader {
  private readonly requestAdapter: RequestAdapter | undefined;

  constructor(requestAdapter?: RequestAdapter) {
    this.requestAdapter = buildRequestAdapter(requestAdapter);
  }

  async downloadAndParse(options: DownloadCombineMessageParams): Promise<ReadonlyArray<Message>> {
    const url = options.url.trim();
    if (!url) {
      throw new ValidationError('Combine message url is required', {
        code: ERROR_CODES.COMBINE_INVALID_INPUT,
        details: {
          fields: [
            {
              path: 'url',
              message: 'Combine message url is required',
              rule: 'required',
            },
          ],
        },
      });
    }

    const maxItems =
      typeof options.maxItems === 'number' ? options.maxItems : MAX_COMBINE_MESSAGE_COUNT;
    ensureCombineItemLimit(1, maxItems);

    const requestAdapter = this.requestAdapter;
    if (!requestAdapter) {
      throw new MessageReceiveError('Request adapter is required for combine message download', {
        code: ERROR_CODES.COMBINE_DOWNLOAD_FAILED,
      });
    }

    const targetUrl = appendAttachUrlParams(url, options.secret);

    try {
      const response = await requestAdapter.request<ArrayBuffer | Uint8Array | string>({
        url: targetUrl,
        method: 'GET',
        responseType: 'arraybuffer',
        timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      });

      if (response.status >= 400) {
        throw new MessageReceiveError('Combine payload download failed', {
          code: ERROR_CODES.COMBINE_DOWNLOAD_FAILED,
          details: {
            status: response.status,
            url: targetUrl,
          },
        });
      }

      const payload = toUint8Array(response.data);
      const messageList = decodeCombineMessageList(payload);
      ensureCombineItemLimit(messageList.length, maxItems);
      validateCombineMessageList(messageList as unknown as ReadonlyArray<Message>);

      return messageList.map(item => {
        const message: Message = {
          msgServerId: item.msgServerId ?? '',
          msgLocalId: item.msgLocalId ?? '',
          from: item.sender.userId,
          to: item.conversationId,
          sender: item.sender,
          conversationId: item.conversationId,
          conversationType: item.conversationType,
          type: item.type,
          status: 'sent',
          ext: item.ext ?? {},
          timestamp: item.timestamp,
          body: item.body as unknown as Message['body'],
          direct: 'RECEIVE',
        };

        const combineLevel = resolveCombineLevel(message);
        if (combineLevel !== undefined) {
          message.combineLevel = combineLevel;
        }
        return message;
      });
    } catch (error) {
      if (error instanceof ValidationError || error instanceof MessageReceiveError) {
        throw error;
      }
      throw new MessageReceiveError('Combine payload download or parse failed', {
        code: ERROR_CODES.COMBINE_DOWNLOAD_FAILED,
        details: {
          cause: toErrorMessage(error),
          url: targetUrl,
        },
      });
    }
  }
}
