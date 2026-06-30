/**
 * Web 平台 WebSocket 适配器
 */

import {
  PLATFORM_ERROR_CODE,
  PLATFORM_ERROR_STAGE,
  SOCKET_READY_STATE,
  createPlatformError,
  type SocketAdapter,
  type SocketConnectConfig,
  type SocketLike,
  type SocketMessageData,
  type SocketSendData,
} from '../types';

export interface WebSocketAdapterOptions {
  readonly webSocketCtor?: typeof WebSocket;
}

interface EventTargetSocketLike {
  addEventListener: (type: string, listener: (...args: unknown[]) => void) => void;
  removeEventListener: (type: string, listener: (...args: unknown[]) => void) => void;
}

interface EventEmitterSocketLike {
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  off: (event: string, listener: (...args: unknown[]) => void) => void;
  once?: (event: string, listener: (...args: unknown[]) => void) => void;
}

type CompatibleSocket = WebSocket &
  Partial<EventTargetSocketLike> &
  Partial<EventEmitterSocketLike>;

const hasEventTargetApi = (socket: CompatibleSocket): socket is CompatibleSocket & EventTargetSocketLike => {
  return (
    typeof socket.addEventListener === 'function' &&
    typeof socket.removeEventListener === 'function'
  );
};

const hasEventEmitterApi = (
  socket: CompatibleSocket
): socket is CompatibleSocket & EventEmitterSocketLike => {
  return typeof socket.on === 'function' && typeof socket.off === 'function';
};

const addSocketListener = (
  socket: CompatibleSocket,
  event: string,
  listener: (...args: unknown[]) => void
): (() => void) => {
  if (hasEventTargetApi(socket)) {
    socket.addEventListener(event, listener);
    return (): void => {
      socket.removeEventListener(event, listener);
    };
  }
  if (hasEventEmitterApi(socket)) {
    const emitterSocket: EventEmitterSocketLike = socket;
    emitterSocket.on(event, listener);
    return (): void => {
      emitterSocket.off(event, listener);
    };
  }
  throw createPlatformError('Socket event listener API is unsupported.', {
    code: PLATFORM_ERROR_CODE.SOCKET_FAILED,
    stage: PLATFORM_ERROR_STAGE.SOCKET,
    retryable: false,
    details: {
      event,
    },
  });
};

const addSocketOnceListener = (
  socket: CompatibleSocket,
  event: string,
  listener: (...args: unknown[]) => void
): (() => void) => {
  if (hasEventTargetApi(socket)) {
    const wrapped = (...args: unknown[]): void => {
      socket.removeEventListener(event, wrapped);
      listener(...args);
    };
    socket.addEventListener(event, wrapped);
    return (): void => {
      socket.removeEventListener(event, wrapped);
    };
  }
  if (hasEventEmitterApi(socket)) {
    const emitterSocket: EventEmitterSocketLike = socket;
    if (typeof emitterSocket.once === 'function') {
      emitterSocket.once?.(event, listener);
      return (): void => {
        emitterSocket.off(event, listener);
      };
    }
    let off = (): void => undefined;
    off = addSocketListener(socket, event, (...args: unknown[]) => {
      off();
      listener(...args);
    });
    return off;
  }
  throw createPlatformError('Socket one-time listener API is unsupported.', {
    code: PLATFORM_ERROR_CODE.SOCKET_FAILED,
    stage: PLATFORM_ERROR_STAGE.SOCKET,
    retryable: false,
    details: {
      event,
    },
  });
};

const toSocketMessageData = (rawData: unknown): SocketMessageData | null => {
  if (typeof rawData === 'string' || rawData instanceof ArrayBuffer || rawData instanceof Blob) {
    return rawData;
  }
  if (ArrayBuffer.isView(rawData)) {
    return new Uint8Array(
      rawData.buffer,
      rawData.byteOffset,
      rawData.byteLength
    ).slice().buffer;
  }
  if (rawData && typeof rawData === 'object' && 'data' in (rawData as Record<string, unknown>)) {
    return toSocketMessageData((rawData as Record<string, unknown>).data);
  }
  return null;
};

const toSocketCloseEvent = (args: ReadonlyArray<unknown>): { code?: number; reason?: string } => {
  const [first, second] = args;
  if (first && typeof first === 'object') {
    const event = first as { code?: unknown; reason?: unknown };
    return {
      code: typeof event.code === 'number' ? event.code : undefined,
      reason: typeof event.reason === 'string' ? event.reason : undefined,
    };
  }
  return {
    code: typeof first === 'number' ? first : undefined,
    reason:
      typeof second === 'string'
        ? second
        : ArrayBuffer.isView(second)
          ? new TextDecoder().decode(
              new Uint8Array(second.buffer, second.byteOffset, second.byteLength)
            )
          : undefined,
  };
};

const createSocketLike = (socket: CompatibleSocket): SocketLike => {
  const openListeners = new Set<() => void>();
  const messageListeners = new Set<(data: SocketMessageData) => void>();
  const errorListeners = new Set<(error: unknown) => void>();
  const closeListeners = new Set<(event: { code?: number; reason?: string }) => void>();

  addSocketListener(socket, 'open', () => {
    openListeners.forEach(listener => {
      listener();
    });
  });

  addSocketListener(socket, 'message', (...args: unknown[]) => {
    const data = toSocketMessageData(args[0]);
    if (data) {
      messageListeners.forEach(listener => {
        listener(data);
      });
    }
  });

  addSocketListener(socket, 'error', (...args: unknown[]) => {
    const event = args[0];
    errorListeners.forEach(listener => {
      listener(event);
    });
  });

  addSocketListener(socket, 'close', (...args: unknown[]) => {
    const event = toSocketCloseEvent(args);
    closeListeners.forEach(listener => {
      listener(event);
    });
  });

  return {
    get readyState(): number {
      return socket.readyState;
    },
    send(data: SocketSendData): Promise<void> {
      if (socket.readyState !== SOCKET_READY_STATE.OPEN) {
        throw createPlatformError('Socket is not open.', {
          code: PLATFORM_ERROR_CODE.SOCKET_FAILED,
          stage: PLATFORM_ERROR_STAGE.SOCKET,
          retryable: true,
          details: {
            readyState: socket.readyState,
          },
        });
      }
      socket.send(data);
      return Promise.resolve();
    },
    close(code?: number, reason?: string): void {
      socket.close(code, reason);
    },
    onOpen(handler: () => void): () => void {
      openListeners.add(handler);
      return (): void => {
        openListeners.delete(handler);
      };
    },
    onMessage(handler: (data: SocketMessageData) => void): () => void {
      messageListeners.add(handler);
      return (): void => {
        messageListeners.delete(handler);
      };
    },
    onError(handler: (error: unknown) => void): () => void {
      errorListeners.add(handler);
      return (): void => {
        errorListeners.delete(handler);
      };
    },
    onClose(handler: (event: { code?: number; reason?: string }) => void): () => void {
      closeListeners.add(handler);
      return (): void => {
        closeListeners.delete(handler);
      };
    },
  };
};

export const createWebSocketAdapter = (
  options?: WebSocketAdapterOptions
): SocketAdapter | undefined => {
  const WebSocketCtor = options?.webSocketCtor;
  if (typeof WebSocketCtor === 'undefined') {
    return undefined;
  }

  return {
    connect(config: SocketConnectConfig): Promise<SocketLike> {
      return new Promise<SocketLike>((resolve, reject) => {
        let socket: CompatibleSocket;

        try {
          socket = new WebSocketCtor(config.url, config.protocols) as CompatibleSocket;
        } catch (error) {
          reject(
            createPlatformError('Socket creation failed.', {
              code: PLATFORM_ERROR_CODE.SOCKET_FAILED,
              stage: PLATFORM_ERROR_STAGE.SOCKET,
              retryable: true,
              details: {
                cause: error instanceof Error ? error.message : String(error),
              },
            })
          );
          return;
        }

        let disposeOpen = (): void => undefined;
        let disposeError = (): void => undefined;

        const handleOpen = (): void => {
          disposeOpen();
          disposeError();
          resolve(createSocketLike(socket));
        };

        const handleErrorBeforeOpen = (event: unknown): void => {
          disposeOpen();
          disposeError();
          const eventType =
            event && typeof event === 'object' && 'type' in (event as Record<string, unknown>)
              ? String((event as Record<string, unknown>).type)
              : undefined;
          reject(
            createPlatformError('Socket connection failed before open.', {
              code: PLATFORM_ERROR_CODE.SOCKET_FAILED,
              stage: PLATFORM_ERROR_STAGE.SOCKET,
              retryable: true,
              details: {
                eventType,
              },
            })
          );
        };

        disposeOpen = addSocketOnceListener(socket, 'open', handleOpen);
        disposeError = addSocketOnceListener(socket, 'error', handleErrorBeforeOpen);
      });
    },
  };
};
