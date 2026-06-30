import {
  SYNC_WEBSOCKET_CONNECT_TIMEOUT,
  SYNC_WEBSOCKET_IDLE_TIMEOUT,
  SYNC_WEBSOCKET_COMPLETE_CLOSE_DELAY,
  SYNC_WEBSOCKET_RETRY_BACKOFF_MULTIPLIER,
  SYNC_WEBSOCKET_RETRY_INITIAL_DELAY,
  SYNC_WEBSOCKET_RETRY_MAX_DELAY,
} from '../../config/timeouts';
import { ERROR_CODES } from '../../utils/error-codes';
import { ConnectionError, SDKError } from '../../utils/errors';
import { logger } from '../../utils/logger';

export interface SharedSyncMessageResult<TResult> {
  readonly done: boolean;
  readonly result: TResult;
}

export interface SharedSyncDecodedFrame<TFrame> {
  readonly type: number;
  readonly requestId?: string;
  readonly frame: TFrame;
}

export interface SharedSyncRequestOptions<TFrame, TResult> {
  readonly dataType: 'conversation' | 'contact' | 'group';
  readonly label: string;
  readonly requestId: string;
  readonly encode: () => Uint8Array;
  readonly decode: (payload: Uint8Array) => SharedSyncDecodedFrame<TFrame>;
  readonly onFrame: (
    frame: TFrame,
    socket: WebSocket
  ) => Promise<SharedSyncMessageResult<TResult> | void> | SharedSyncMessageResult<TResult> | void;
}

interface PendingSyncRequest<TFrame = unknown, TResult = unknown>
  extends SharedSyncRequestOptions<TFrame, TResult> {
  readonly resolve: (result: TResult) => void;
  readonly reject: (error: Error) => void;
}

type SocketState = 'idle' | 'connecting' | 'open' | 'closing';

export interface SharedSyncWebSocketSessionOptions {
  readonly getUrls: () => Promise<ReadonlyArray<string>>;
}

const MAX_ATTEMPTS = 3;

const isArrayBufferLike = (payload: unknown): payload is ArrayBuffer => {
  return Object.prototype.toString.call(payload) === '[object ArrayBuffer]';
};

const toBinarySync = (payload: string | ArrayBuffer | ArrayBufferView): Uint8Array => {
  if (typeof payload === 'string') {
    return new TextEncoder().encode(payload);
  }
  if (isArrayBufferLike(payload)) {
    return new Uint8Array(payload);
  }
  return new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength);
};

const isBlobLike = (payload: unknown): payload is Blob => {
  return (
    typeof Blob !== 'undefined' &&
    payload instanceof Blob &&
    typeof payload.arrayBuffer === 'function'
  ) || (
    typeof payload === 'object' &&
    payload !== null &&
    typeof (payload as { arrayBuffer?: unknown }).arrayBuffer === 'function'
  );
};

const normalizePayload = async (payload: unknown): Promise<Uint8Array> => {
  if (typeof payload === 'string' || isArrayBufferLike(payload) || ArrayBuffer.isView(payload)) {
    return toBinarySync(payload);
  }
  if (isBlobLike(payload)) {
    return new Uint8Array(await payload.arrayBuffer());
  }
  throw new SDKError('sync websocket frame payload type is invalid', ERROR_CODES.CONTACT_SYNC_PROTO_DECODE_FAILED, {
    details: {
      stage: 'response_decode',
      payloadType: typeof payload,
    },
  });
};

const calculateRetryDelay = (attempt: number): number => {
  const attemptIndex = Math.max(attempt - 1, 0);
  const delay =
    SYNC_WEBSOCKET_RETRY_INITIAL_DELAY *
    Math.pow(SYNC_WEBSOCKET_RETRY_BACKOFF_MULTIPLIER, attemptIndex);
  return Math.min(delay, SYNC_WEBSOCKET_RETRY_MAX_DELAY);
};

const wait = async (delayMs: number): Promise<void> => {
  await new Promise(resolve => {
    setTimeout(resolve, delayMs);
  });
};

const toError = (error: unknown): Error => {
  return error instanceof Error ? error : new Error(String(error));
};

const sanitizeUrl = (url: string): string => {
  if (!url) {
    return '';
  }
  try {
    const parsed = new URL(url);
    if (parsed.search) {
      parsed.search = '?[MASKED]';
    }
    return parsed.toString();
  } catch {
    return '[invalid-url]';
  }
};

export class SharedSyncWebSocketSession {
  private readonly getUrls: () => Promise<ReadonlyArray<string>>;
  private readonly pending = new Map<string, PendingSyncRequest>();
  private socket: WebSocket | null = null;
  private state: SocketState = 'idle';
  private connectPromise: Promise<void> | null = null;
  private activeUrl = '';
  private urlIndex = 0;
  private attempt = 0;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private completeCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private cancelled = false;

  public constructor(options: SharedSyncWebSocketSessionOptions) {
    this.getUrls = options.getUrls;
  }

  public async request<TFrame, TResult>(
    options: SharedSyncRequestOptions<TFrame, TResult>
  ): Promise<TResult> {
    if (this.cancelled) {
      throw new SDKError('sync websocket session is cancelled', ERROR_CODES.CONTACT_SYNC_CANCELLED, {
        details: {
          stage: 'cancelled',
          requestId: options.requestId,
        },
      });
    }
    if (this.pending.has(options.requestId)) {
      throw new SDKError('sync websocket requestId is duplicated', ERROR_CODES.VALIDATION_INVALID_FORMAT, {
        details: {
          stage: 'request_send',
          requestId: options.requestId,
        },
      });
    }
    this.clearCompleteCloseTimer();

    const result = new Promise<TResult>((resolve, reject) => {
      this.pending.set(options.requestId, {
        ...options,
        resolve: resolve as (value: unknown) => void,
        reject,
      } as PendingSyncRequest);
    });
    void result.catch(() => undefined);

    try {
      await this.ensureConnected();
      this.sendPendingRequest(this.pending.get(options.requestId));
    } catch (error) {
      this.rejectPending(options.requestId, toError(error));
    }

    return await result;
  }

  public cancel(reason: string = 'sync-websocket-cancelled'): void {
    this.cancelled = true;
    const error = new SDKError('sync websocket cancelled', ERROR_CODES.CONTACT_SYNC_CANCELLED, {
      details: {
        stage: 'cancelled',
        reason,
      },
    });
    this.rejectAll(error);
    this.closeSocket(4001, reason);
    this.clearTimers();
    this.connectPromise = null;
    this.state = 'idle';
  }

  public close(reason: string = 'sync-websocket-closed'): void {
    this.closeSocket(1000, reason);
    this.clearTimers();
    this.connectPromise = null;
    this.state = 'idle';
  }

  private async ensureConnected(): Promise<void> {
    if (this.state === 'open' && this.socket?.readyState === WebSocket.OPEN) {
      return;
    }
    if (this.connectPromise) {
      return await this.connectPromise;
    }
    this.connectPromise = this.connectWithRetry();
    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  private async connectWithRetry(): Promise<void> {
    let lastError: Error | null = null;
    while (!this.cancelled && this.pending.size > 0 && this.attempt < MAX_ATTEMPTS) {
      this.attempt += 1;
      if (this.attempt > 1) {
        logger.warn('sync websocket retry started', this.buildLogContext({ reason: lastError?.message }));
      }
      try {
        await this.openSocket();
        return;
      } catch (error) {
        lastError = toError(error);
        if (this.cancelled || this.pending.size === 0) {
          throw lastError;
        }
        if (this.attempt >= MAX_ATTEMPTS) {
          logger.warn('sync websocket retry exhausted', this.buildLogContext({ reason: lastError.message }));
          throw lastError;
        }
        const delayMs = calculateRetryDelay(this.attempt);
        logger.warn('sync websocket retry scheduled', this.buildLogContext({
          delayMs,
          reason: lastError.message,
        }));
        await wait(delayMs);
      }
    }
    throw new ConnectionError('sync websocket retry exhausted', {
      code: ERROR_CODES.CONTACT_SYNC_SOCKET_FAILED,
      details: {
        stage: 'socket_connect',
        reason: lastError?.message ?? 'unknown',
      },
    });
  }

  private async openSocket(): Promise<void> {
    const urls = await this.getUrls();
    if (urls.length === 0) {
      throw new ConnectionError('sync websocket urls are unavailable', {
        code: ERROR_CODES.CONTACT_SYNC_SOCKET_FAILED,
        details: {
          stage: 'socket_connect',
        },
      });
    }

    const url = urls[this.urlIndex % urls.length];
    this.urlIndex += 1;
    if (!url) {
      throw new ConnectionError('sync websocket url is invalid', {
        code: ERROR_CODES.CONTACT_SYNC_SOCKET_FAILED,
        details: {
          stage: 'socket_connect',
        },
      });
    }
    this.activeUrl = url;
    this.state = 'connecting';
    logger.warn('sync websocket connect started', this.buildLogContext());

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let socket: WebSocket;
      const settleResolve = (): void => {
        if (settled) {
          return;
        }
        settled = true;
        this.clearConnectTimer();
        this.state = 'open';
        this.resetIdleTimer();
        logger.warn('sync websocket connected', this.buildLogContext());
        resolve();
      };
      const settleReject = (error: Error): void => {
        if (settled) {
          return;
        }
        settled = true;
        this.clearConnectTimer();
        this.state = 'idle';
        this.closeSocket(4000, 'sync-websocket-connect-failed');
        reject(error);
      };

      try {
        socket = new WebSocket(url);
        socket.binaryType = 'arraybuffer';
        this.socket = socket;
      } catch (error) {
        settleReject(this.buildConnectionError('sync websocket socket create failed', 'socket_connect', {
          cause: error instanceof Error ? error.message : String(error),
        }));
        return;
      }

      this.connectTimer = setTimeout(() => {
        settleReject(this.buildConnectionError('sync websocket socket connect timeout', 'socket_connect'));
      }, SYNC_WEBSOCKET_CONNECT_TIMEOUT);

      socket.addEventListener('open', () => {
        if (this.socket !== socket) {
          return;
        }
        settleResolve();
      });
      socket.addEventListener('message', event => {
        if (this.socket !== socket) {
          return;
        }
        void this.handleMessage(event.data);
      });
      socket.addEventListener('error', () => {
        if (this.socket !== socket) {
          return;
        }
        const error = this.buildConnectionError(
          this.state === 'connecting' ? 'sync websocket socket error' : 'sync websocket runtime error',
          this.state === 'connecting' ? 'socket_connect' : 'sync_page'
        );
        if (this.state === 'connecting') {
          settleReject(error);
          return;
        }
        this.handleSocketFailure(error);
      });
      socket.addEventListener('close', event => {
        if (this.socket !== socket) {
          return;
        }
        if (this.state === 'closing' || this.pending.size === 0) {
          this.clearTimers();
          this.socket = null;
          this.state = 'idle';
          return;
        }
        const error = this.buildConnectionError('sync websocket socket closed', this.state === 'connecting' ? 'socket_connect' : 'sync_page', {
          closeCode: event.code,
          closeReason: event.reason,
        });
        if (this.state === 'connecting') {
          settleReject(error);
          return;
        }
        this.handleSocketFailure(error);
      });
    });
  }

  private async handleMessage(payload: unknown): Promise<void> {
    try {
      this.resetIdleTimer();
      const bytes = await normalizePayload(payload);
      const routed = await this.routeFrame(bytes);
      if (!routed) {
        return;
      }
    } catch (error) {
      const frameError = toError(error);
      this.rejectAll(frameError);
      this.closeSocket(4000, 'sync-websocket-frame-failed');
      this.clearTimers();
      this.state = 'idle';
    }
  }

  private async routeFrame(bytes: Uint8Array): Promise<boolean> {
    const decodeErrors: string[] = [];
    let pingCandidate:
      | {
          readonly pending: PendingSyncRequest;
          readonly frame: unknown;
        }
      | null = null;
    for (const pending of this.pending.values()) {
      try {
        const decoded = pending.decode(bytes);
        if (decoded.requestId && decoded.requestId === pending.requestId) {
          try {
            const result = await pending.onFrame(decoded.frame, this.socket as WebSocket);
            if (result?.done) {
              this.pending.delete(pending.requestId);
              pending.resolve(result.result);
              this.closeIfComplete();
            }
          } catch (error) {
            this.pending.delete(pending.requestId);
            pending.reject(toError(error));
            this.closeIfComplete();
          }
          return true;
        }
        if (!decoded.requestId && decoded.type === 1 && !pingCandidate) {
          pingCandidate = {
            pending,
            frame: decoded.frame,
          };
        }
      } catch (error) {
        decodeErrors.push(error instanceof Error ? error.message : String(error));
      }
    }
    if (pingCandidate) {
      await pingCandidate.pending.onFrame(pingCandidate.frame, this.socket as WebSocket);
      return true;
    }
    logger.warn('sync websocket frame ignored', this.buildLogContext({
      reason: decodeErrors[0] ?? 'requestId not matched',
    }));
    return false;
  }

  private handleSocketFailure(error: Error): void {
    this.closeSocket(4000, 'sync-websocket-failed');
    this.clearTimers();
    this.state = 'idle';
    if (this.cancelled || this.pending.size === 0) {
      return;
    }
    if (this.attempt >= MAX_ATTEMPTS) {
      logger.warn('sync websocket retry exhausted', this.buildLogContext({ reason: error.message }));
      this.rejectAll(error);
      return;
    }
    this.connectPromise = this.connectWithRetry()
      .then(() => {
        this.resendPendingRequests();
      })
      .catch(retryError => {
        this.rejectAll(toError(retryError));
      })
      .finally(() => {
        this.connectPromise = null;
      });
  }

  private resendPendingRequests(): void {
    for (const pending of this.pending.values()) {
      this.sendPendingRequest(pending);
    }
  }

  private sendPendingRequest(pending: PendingSyncRequest | undefined): void {
    if (!pending) {
      return;
    }
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    try {
      this.socket.send(pending.encode());
      logger.warn('sync websocket request sent', this.buildLogContext({
        requestId: pending.requestId,
        dataTypes: [pending.dataType],
      }));
      this.resetIdleTimer();
    } catch (error) {
      this.rejectPending(pending.requestId, this.buildConnectionError('sync websocket request send failed', 'request_send', {
        cause: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  private rejectPending(requestId: string, error: Error): void {
    const pending = this.pending.get(requestId);
    if (!pending) {
      return;
    }
    this.pending.delete(requestId);
    pending.reject(error);
    this.closeIfComplete();
  }

  private rejectAll(error: Error): void {
    const pendingRequests = [...this.pending.values()];
    this.pending.clear();
    pendingRequests.forEach(pending => {
      pending.reject(error);
    });
  }

  private closeIfComplete(): void {
    if (this.pending.size > 0) {
      return;
    }
    this.clearCompleteCloseTimer();
    this.completeCloseTimer = setTimeout(() => {
      this.completeCloseTimer = null;
      if (this.pending.size > 0) {
        return;
      }
      logger.warn('sync websocket closed after complete', this.buildLogContext());
      this.close('sync-websocket-complete');
    }, SYNC_WEBSOCKET_COMPLETE_CLOSE_DELAY);
  }

  private resetIdleTimer(): void {
    this.clearIdleTimer();
    if (this.pending.size === 0) {
      return;
    }
    this.idleTimer = setTimeout(() => {
      this.handleSocketFailure(this.buildConnectionError('sync websocket socket idle timeout', 'sync_page'));
    }, SYNC_WEBSOCKET_IDLE_TIMEOUT);
  }

  private clearTimers(): void {
    this.clearConnectTimer();
    this.clearIdleTimer();
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.clearCompleteCloseTimer();
  }

  private clearConnectTimer(): void {
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private clearCompleteCloseTimer(): void {
    if (this.completeCloseTimer) {
      clearTimeout(this.completeCloseTimer);
      this.completeCloseTimer = null;
    }
  }

  private closeSocket(code: number, reason: string): void {
    const current = this.socket;
    this.socket = null;
    if (!current || current.readyState >= WebSocket.CLOSING) {
      return;
    }
    this.state = 'closing';
    current.close(code, reason);
  }

  private buildConnectionError(
    message: string,
    stage: string,
    details: Record<string, unknown> = {}
  ): ConnectionError {
    return new ConnectionError(message, {
      code: ERROR_CODES.CONTACT_SYNC_SOCKET_FAILED,
      details: {
        stage,
        url: this.activeUrl,
        ...details,
      },
    });
  }

  private buildLogContext(extra: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      attempt: this.attempt,
      maxAttempts: MAX_ATTEMPTS,
      url: sanitizeUrl(this.activeUrl),
      pendingCount: this.pending.size,
      dataTypes: [...new Set([...this.pending.values()].map(pending => pending.dataType))],
      ...extra,
    };
  }
}
