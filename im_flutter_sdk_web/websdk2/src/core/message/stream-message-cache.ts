import { StreamMessageStatus, type StreamMessage } from '../../types';

/** 默认 session TTL：5 分钟 */
const DEFAULT_SESSION_TTL_MS = 5 * 60 * 1000;
/** 默认最大并发 session 数 */
const DEFAULT_MAX_SESSIONS = 100;

export interface StreamSession {
  msgId: string;
  startSeq: number | null;
  lastDispatchedSeq: number;
  fullText: string;
  completed: boolean;
  completedReason?: 'normal' | 'fallback_full' | 'timeout_error';
  chunksBySeq: Map<number, StreamMessage>;
  lastActivityTs: number;
}

export interface StreamMessageCacheOptions {
  readonly ttlMs?: number;
  readonly maxSessions?: number;
}

/**
 * 流式消息缓存：按 msgId 聚合分片，负责顺序扫描和状态推进。
 * 内置 TTL 和上限清理，防止未完成 session 内存泄漏。
 */
export class StreamMessageCache {
  private sessions: Map<string, StreamSession> = new Map();
  private readonly ttlMs: number;
  private readonly maxSessions: number;

  constructor(options?: StreamMessageCacheOptions) {
    this.ttlMs = options?.ttlMs ?? DEFAULT_SESSION_TTL_MS;
    this.maxSessions = options?.maxSessions ?? DEFAULT_MAX_SESSIONS;
  }

  getOrCreate(msgId: string): StreamSession {
    this.evictStale();
    const existed = this.sessions.get(msgId);
    if (existed) {
      existed.lastActivityTs = Date.now();
      return existed;
    }
    if (this.sessions.size >= this.maxSessions) {
      this.evictOldest();
    }
    const created: StreamSession = {
      msgId,
      startSeq: null,
      lastDispatchedSeq: -1,
      fullText: '',
      completed: false,
      chunksBySeq: new Map(),
      lastActivityTs: Date.now(),
    };
    this.sessions.set(msgId, created);
    return created;
  }

  get(msgId: string): StreamSession | undefined {
    return this.sessions.get(msgId);
  }

  addChunk(msgId: string, message: StreamMessage): { duplicate: boolean; session: StreamSession } {
    const session = this.getOrCreate(msgId);
    const seq = message.stream.seq;
    if (session.chunksBySeq.has(seq)) {
      return { duplicate: true, session };
    }
    session.chunksBySeq.set(seq, message);
    session.lastActivityTs = Date.now();
    if (message.stream.status === StreamMessageStatus.START && session.startSeq === null) {
      session.startSeq = seq;
    }
    return { duplicate: false, session };
  }

  getSequentialChunks(msgId: string): ReadonlyArray<StreamMessage> {
    const session = this.sessions.get(msgId);
    if (!session || session.completed || session.startSeq === null) {
      return [];
    }
    let expected = session.lastDispatchedSeq < session.startSeq
      ? session.startSeq
      : session.lastDispatchedSeq + 1;
    const result: StreamMessage[] = [];
    while (session.chunksBySeq.has(expected)) {
      const current = session.chunksBySeq.get(expected);
      if (!current) {
        break;
      }
      result.push(current);
      expected += 1;
    }
    return result;
  }

  markDispatched(msgId: string, message: StreamMessage, fullText: string): void {
    const session = this.sessions.get(msgId);
    if (!session) {
      return;
    }
    const seq = message.stream.seq;
    session.lastDispatchedSeq = Math.max(session.lastDispatchedSeq, seq);
    session.fullText = fullText;
    session.chunksBySeq.delete(seq);
  }

  markCompleted(
    msgId: string,
    reason: 'normal' | 'fallback_full' | 'timeout_error',
    fullText: string
  ): void {
    const session = this.getOrCreate(msgId);
    session.completed = true;
    session.completedReason = reason;
    session.fullText = fullText;
  }

  clear(msgId: string): void {
    this.sessions.delete(msgId);
  }

  clearAll(): void {
    this.sessions.clear();
  }

  private evictStale(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.lastActivityTs > this.ttlMs) {
        this.sessions.delete(id);
      }
    }
  }

  private evictOldest(): void {
    let oldestId: string | null = null;
    let oldestTs = Infinity;
    for (const [id, session] of this.sessions) {
      if (session.lastActivityTs < oldestTs) {
        oldestTs = session.lastActivityTs;
        oldestId = id;
      }
    }
    if (oldestId) {
      this.sessions.delete(oldestId);
    }
  }
}
