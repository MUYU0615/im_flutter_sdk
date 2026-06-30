import { ChatEventName, StreamMessageStatus, type StreamMessage } from '../../types';
import { logger } from '../../utils/logger';
import { EventHub } from '../events/event-hub';
import { StreamMessageCache } from './stream-message-cache';

const COMPLETED_CACHE_LIMIT = 2048;

/**
 * 流式消息处理器：负责乱序缓存、顺序回调、兜底完成与错误终止。
 */
export class StreamMessageHandler {
  private readonly eventHub: EventHub;
  private readonly cache: StreamMessageCache;
  private readonly completedIds: Set<string> = new Set();

  constructor(eventHub: EventHub, cache?: StreamMessageCache) {
    this.eventHub = eventHub;
    this.cache = cache ?? new StreamMessageCache();
  }

  handle(message: StreamMessage): void {
    const msgId = this.resolveMessageId(message);
    if (!msgId) {
      logger.warn('stream message id missing, skip dispatch');
      return;
    }

    if (this.completedIds.has(msgId)) {
      logger.debug('stream message already completed, ignore', { msgId });
      return;
    }

    if (message.stream.status === StreamMessageStatus.FULL) {
      this.handleFullChunk(msgId, message);
      return;
    }

    const session = this.cache.get(msgId);
    if (session?.completed) {
      logger.debug('stream session completed, ignore chunk', { msgId, seq: message.stream.seq });
      return;
    }

    const { duplicate } = this.cache.addChunk(msgId, message);
    if (duplicate) {
      logger.debug('stream duplicate chunk ignored', { msgId, seq: message.stream.seq });
      return;
    }

    if (message.stream.errorType > 0) {
      this.dispatchServerError(msgId, message);
      return;
    }

    this.dispatchSequentialChunks(msgId);
  }

  destroy(): void {
    this.cache.clearAll();
    this.completedIds.clear();
  }

  private dispatchSequentialChunks(msgId: string): void {
    const sequentialChunks = this.cache.getSequentialChunks(msgId);
    if (sequentialChunks.length === 0) {
      logger.debug('stream chunks pending for missing seq', { msgId });
      return;
    }

    for (const chunk of sequentialChunks) {
      const session = this.cache.get(msgId);
      if (!session) {
        return;
      }
      const previousFullText = session.fullText;
      const deltaText = chunk.stream.deltaText;
      const fullText = `${previousFullText}${deltaText}`;
      const status = chunk.stream.errorType > 0
        ? StreamMessageStatus.ERROR
        : chunk.stream.status;
      const dispatched = this.buildDispatchMessage(chunk, {
        status,
        fullText,
        deltaText,
      });

      this.eventHub.dispatch(ChatEventName.STREAM_MESSAGE, dispatched);
      this.cache.markDispatched(msgId, chunk, fullText);

      if (status === StreamMessageStatus.COMPLETED || status === StreamMessageStatus.ERROR) {
        const reason = status === StreamMessageStatus.ERROR ? 'timeout_error' : 'normal';
        this.cache.markCompleted(msgId, reason, fullText);
        this.cache.clear(msgId);
        this.markCompleted(msgId);
        return;
      }
    }
  }

  private handleFullChunk(msgId: string, message: StreamMessage): void {
    const session = this.cache.get(msgId);
    const previousFullText = session?.fullText ?? '';
    const fullText = this.resolveFullText(message, previousFullText);
    const deltaText = this.resolveDeltaText(previousFullText, fullText, message.stream.deltaText);
    const isSingleChunk = !session || (session.lastDispatchedSeq === -1 && session.chunksBySeq.size === 0);
    const status = message.stream.errorType > 0
      ? StreamMessageStatus.ERROR
      : isSingleChunk
        ? StreamMessageStatus.FULL
        : StreamMessageStatus.COMPLETED;

    const dispatched = this.buildDispatchMessage(message, {
      status,
      fullText,
      deltaText,
    });

    this.eventHub.dispatch(ChatEventName.STREAM_MESSAGE, dispatched);
    const reason = status === StreamMessageStatus.ERROR ? 'timeout_error' : 'fallback_full';
    this.cache.markCompleted(msgId, reason, fullText);
    this.cache.clear(msgId);
    this.markCompleted(msgId);
  }

  private dispatchServerError(msgId: string, message: StreamMessage): void {
    const session = this.cache.get(msgId);
    const previousFullText = session?.fullText ?? '';
    const fullText = this.resolveFullText(message, previousFullText);
    const deltaText = this.resolveDeltaText(previousFullText, fullText, message.stream.deltaText);
    const dispatched = this.buildDispatchMessage(message, {
      status: StreamMessageStatus.ERROR,
      fullText,
      deltaText,
    });

    this.eventHub.dispatch(ChatEventName.STREAM_MESSAGE, dispatched);
    this.cache.markCompleted(msgId, 'timeout_error', fullText);
    this.cache.clear(msgId);
    this.markCompleted(msgId);
  }

  private buildDispatchMessage(
    message: StreamMessage,
    options: {
      status: StreamMessageStatus;
      fullText: string;
      deltaText: string;
    }
  ): StreamMessage {
    return {
      ...message,
      body: {
        ...message.body,
        content: options.fullText,
      },
      stream: {
        ...message.stream,
        status: options.status,
        fullText: options.fullText,
        deltaText: options.deltaText,
      },
    };
  }

  private resolveMessageId(message: StreamMessage): string {
    if (message.msgServerId && message.msgServerId.length > 0) {
      return message.msgServerId;
    }
    return message.msgLocalId;
  }

  private resolveFullText(message: StreamMessage, previousFullText: string): string {
    const fullFromChunk = message.stream.fullText;
    if (fullFromChunk && fullFromChunk.length >= previousFullText.length) {
      return fullFromChunk;
    }
    const textFromBody = message.body.content;
    if (textFromBody && textFromBody.length >= previousFullText.length) {
      return textFromBody;
    }
    return `${previousFullText}${message.stream.deltaText}`;
  }

  private resolveDeltaText(previousFullText: string, fullText: string, fallbackDelta: string): string {
    if (fullText.startsWith(previousFullText)) {
      return fullText.slice(previousFullText.length);
    }
    return fallbackDelta;
  }

  private markCompleted(msgId: string): void {
    this.completedIds.add(msgId);
    if (this.completedIds.size <= COMPLETED_CACHE_LIMIT) {
      return;
    }
    const first = this.completedIds.values().next().value;
    if (first) {
      this.completedIds.delete(first);
    }
  }
}
