import { spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';

interface WebSocketLike {
  readonly readyState: number;
  send: (data: Uint8Array, callback: (error?: Error) => void) => void;
  once: (event: 'open' | 'error', handler: (...args: unknown[]) => void) => void;
  on: (event: 'message' | 'error' | 'close', handler: (...args: unknown[]) => void) => void;
  off: (event: 'message' | 'error' | 'close', handler: (...args: unknown[]) => void) => void;
  close: () => void;
  terminate: () => void;
}

interface WebSocketCtor {
  new (url: string): WebSocketLike;
  readonly OPEN: number;
}

interface WsModule {
  readonly WebSocket: WebSocketCtor;
}

interface PendingFrameWaiter {
  readonly resolve: (data: Uint8Array) => void;
  readonly reject: (error: Error) => void;
  readonly timeoutId: ReturnType<typeof setTimeout>;
}

interface SocketFrameState {
  readonly queue: Uint8Array[];
  readonly waiters: PendingFrameWaiter[];
  terminalError: Error | null;
}

const require = createRequire(import.meta.url);
const wsModule = require('ws') as WsModule;
const WebSocket = wsModule.WebSocket;
const socketFrameStates = new WeakMap<WebSocketLike, SocketFrameState>();

const toError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
};

export interface MockSocketCloseResult {
  readonly code: number;
  readonly reason: string;
}

export interface MockServerController {
  readonly baseUrl: string;
  readonly wsUrl: string;
  setScenario: (scenarioId: string) => Promise<void>;
  openSocket: () => Promise<WebSocketLike>;
  sendBinary: (socket: WebSocketLike, data: Uint8Array) => Promise<void>;
  readBinary: (socket: WebSocketLike, timeoutMs?: number) => Promise<Uint8Array>;
  waitForClose: (socket: WebSocketLike, timeoutMs?: number) => Promise<MockSocketCloseResult>;
  stop: () => Promise<void>;
}

const sleep = async (delayMs: number): Promise<void> => {
  await new Promise<void>(resolve => {
    setTimeout(resolve, delayMs);
  });
};

const waitForHealth = async (baseUrl: string, timeoutMs: number = 5000): Promise<void> => {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // ignore
    }
    await sleep(100);
  }
  throw new Error(`mock server health check timeout: ${baseUrl}`);
};

const toUint8Array = (rawData: unknown): Uint8Array => {
  if (rawData instanceof Uint8Array) {
    return rawData;
  }
  if (rawData instanceof ArrayBuffer) {
    return new Uint8Array(rawData);
  }
  if (typeof rawData === 'string') {
    return new TextEncoder().encode(rawData);
  }
  if (Array.isArray(rawData)) {
    const chunks = rawData.filter((item): item is Uint8Array => item instanceof Uint8Array);
    const totalLength = chunks.reduce((sum, item) => sum + item.length, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const item of chunks) {
      merged.set(item, offset);
      offset += item.length;
    }
    return merged;
  }
  return new Uint8Array();
};

const ensureSocketFrameState = (socket: WebSocketLike): SocketFrameState => {
  const existingState = socketFrameStates.get(socket);
  if (existingState) {
    return existingState;
  }

  const state: SocketFrameState = {
    queue: [],
    waiters: [],
    terminalError: null,
  };

  const settleWaiter = (data: Uint8Array): void => {
    const waiter = state.waiters.shift();
    if (!waiter) {
      state.queue.push(data);
      return;
    }
    clearTimeout(waiter.timeoutId);
    waiter.resolve(data);
  };

  const failPendingWaiters = (error: Error): void => {
    state.terminalError = error;
    while (state.waiters.length > 0) {
      const waiter = state.waiters.shift();
      if (!waiter) {
        continue;
      }
      clearTimeout(waiter.timeoutId);
      waiter.reject(error);
    }
  };

  socket.on('message', rawData => {
    settleWaiter(toUint8Array(rawData));
  });
  socket.on('error', error => {
    failPendingWaiters(toError(error));
  });
  socket.on('close', () => {
    failPendingWaiters(new Error('mock ws closed before message received'));
  });

  socketFrameStates.set(socket, state);
  return state;
};

const connectWebSocket = async (
  wsUrl: string,
  timeoutMs: number = 4000
): Promise<WebSocketLike> => {
  return await new Promise<WebSocketLike>((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    const timeoutId = setTimeout(() => {
      socket.terminate();
      reject(new Error(`mock ws connect timeout: ${wsUrl}`));
    }, timeoutMs);

    socket.once('open', () => {
      clearTimeout(timeoutId);
      ensureSocketFrameState(socket);
      resolve(socket);
    });

    socket.once('error', error => {
      clearTimeout(timeoutId);
      reject(toError(error));
    });
  });
};

const readBinaryFrame = async (
  socket: WebSocketLike,
  timeoutMs: number = 3000
): Promise<Uint8Array> => {
  const state = ensureSocketFrameState(socket);
  const queuedFrame = state.queue.shift();
  if (queuedFrame) {
    return queuedFrame;
  }
  if (state.terminalError) {
    throw state.terminalError;
  }

  return await new Promise<Uint8Array>((resolve, reject) => {
    const waiter: PendingFrameWaiter = {
      resolve,
      reject,
      timeoutId: setTimeout(() => {
        const waiterIndex = state.waiters.indexOf(waiter);
        if (waiterIndex >= 0) {
          state.waiters.splice(waiterIndex, 1);
        }
        reject(new Error('mock ws read timeout'));
      }, timeoutMs),
    };

    state.waiters.push(waiter);
  });
};

const waitSocketClose = async (
  socket: WebSocketLike,
  timeoutMs: number = 4000
): Promise<MockSocketCloseResult> => {
  return await new Promise<MockSocketCloseResult>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('mock ws close timeout'));
    }, timeoutMs);

    const handleClose = (code: unknown, reason: unknown): void => {
      cleanup();
      resolve({
        code: typeof code === 'number' ? code : 0,
        reason: reason instanceof Uint8Array ? new TextDecoder().decode(reason) : String(reason),
      });
    };

    const handleError = (error: unknown): void => {
      cleanup();
      reject(toError(error));
    };

    const cleanup = (): void => {
      clearTimeout(timeoutId);
      socket.off('close', handleClose);
      socket.off('error', handleError);
    };

    socket.on('close', handleClose);
    socket.on('error', handleError);
  });
};

export const startMockServer = async (port: number = 19360): Promise<MockServerController> => {
  const baseUrl = `http://127.0.0.1:${port}`;
  const wsUrl = `ws://127.0.0.1:${port}/websocket`;

  const stderrLogs: string[] = [];
  const processRef: ChildProcess = spawn('node', ['scripts/test/mock-server.mjs'], {
    env: { ...process.env, MOCK_SERVER_PORT: String(port) },
    stdio: ['ignore', 'ignore', 'pipe'],
  });

  processRef.stderr?.on('data', chunk => {
    stderrLogs.push(String(chunk));
  });

  try {
    await waitForHealth(baseUrl);
  } catch (error) {
    processRef.kill('SIGTERM');
    const stderrText = stderrLogs.join('\n');
    throw new Error(
      `mock server start failed: ${error instanceof Error ? error.message : String(error)}\n${stderrText}`
    );
  }

  return {
    baseUrl,
    wsUrl,
    async setScenario(scenarioId: string): Promise<void> {
      const response = await fetch(`${baseUrl}/scenario`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: scenarioId }),
      });
      if (!response.ok) {
        throw new Error(`set scenario failed: ${response.status}`);
      }
    },
    async openSocket(): Promise<WebSocketLike> {
      return await connectWebSocket(wsUrl);
    },
    async sendBinary(socket: WebSocketLike, data: Uint8Array): Promise<void> {
      if (socket.readyState !== WebSocket.OPEN) {
        throw new Error('mock ws is not open');
      }
      await new Promise<void>((resolve, reject) => {
        socket.send(data, error => {
          if (error) {
            reject(toError(error));
            return;
          }
          resolve();
        });
      });
    },
    async readBinary(socket: WebSocketLike, timeoutMs?: number): Promise<Uint8Array> {
      return await readBinaryFrame(socket, timeoutMs);
    },
    async waitForClose(socket: WebSocketLike, timeoutMs?: number): Promise<MockSocketCloseResult> {
      return await waitSocketClose(socket, timeoutMs);
    },
    async stop(): Promise<void> {
      processRef.kill('SIGTERM');
      await sleep(150);
    },
  };
};
