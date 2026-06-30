import { ERROR_CODES } from '../../utils/error-codes';
import { ConnectionError, SDKError } from '../../utils/errors';

const CONNECT_TIMEOUT_MS = 5000;
const IDLE_TIMEOUT_MS = 10000;

export interface SyncTransportMessageResult<TResult> {
  readonly done: boolean;
  readonly result: TResult;
}

export interface SyncTransportRunOptions<TResult> {
  readonly label: string;
  readonly url: string;
  readonly onOpen: (socket: WebSocket) => void;
  readonly onMessage: (
    payload: unknown,
    socket: WebSocket
  ) => Promise<SyncTransportMessageResult<TResult> | void> | SyncTransportMessageResult<TResult> | void;
}

export class SyncTransportClient<TResult> {
  private socket: WebSocket | null = null;
  private rejectCurrent: ((error: Error) => void) | null = null;

  public async run(options: SyncTransportRunOptions<TResult>): Promise<TResult> {
    return await new Promise((resolve, reject) => {
      let settled = false;
      let opened = false;
      let connectTimer: ReturnType<typeof setTimeout> | null = null;
      let idleTimer: ReturnType<typeof setTimeout> | null = null;

      const cleanup = (): void => {
        if (connectTimer) {
          clearTimeout(connectTimer);
          connectTimer = null;
        }
        if (idleTimer) {
          clearTimeout(idleTimer);
          idleTimer = null;
        }
        this.rejectCurrent = null;
        this.socket = null;
      };

      const settleReject = (error: Error): void => {
        if (settled) {
          return;
        }
        settled = true;
        const currentSocket = this.socket;
        cleanup();
        reject(error);
        if (currentSocket && currentSocket.readyState < WebSocket.CLOSING) {
          currentSocket.close(4000, 'contact-sync-transport-failed');
        }
      };

      const settleResolve = (result: TResult): void => {
        if (settled) {
          return;
        }
        settled = true;
        const currentSocket = this.socket;
        cleanup();
        resolve(result);
        if (currentSocket && currentSocket.readyState < WebSocket.CLOSING) {
          currentSocket.close(1000, 'contact-sync-transport-complete');
        }
      };

      const resetIdleTimer = (): void => {
        if (idleTimer) {
          clearTimeout(idleTimer);
        }
        idleTimer = setTimeout(() => {
          settleReject(
            new ConnectionError(`${options.label} socket idle timeout`, {
              code: ERROR_CODES.CONTACT_SYNC_SOCKET_FAILED,
              details: {
                stage: 'sync_page',
                url: options.url,
              },
            })
          );
        }, IDLE_TIMEOUT_MS);
      };

      try {
        this.socket = new WebSocket(options.url);
        this.socket.binaryType = 'arraybuffer';
      } catch (error) {
        settleReject(
          new ConnectionError(`${options.label} socket create failed`, {
            code: ERROR_CODES.CONTACT_SYNC_SOCKET_FAILED,
            details: {
              stage: 'socket_connect',
              url: options.url,
              cause: error instanceof Error ? error.message : String(error),
            },
          })
        );
        return;
      }

      this.rejectCurrent = settleReject;
      connectTimer = setTimeout(() => {
        settleReject(
          new ConnectionError(`${options.label} socket connect timeout`, {
            code: ERROR_CODES.CONTACT_SYNC_SOCKET_FAILED,
            details: {
              stage: 'socket_connect',
              url: options.url,
            },
          })
        );
      }, CONNECT_TIMEOUT_MS);

      this.socket.addEventListener('open', () => {
        opened = true;
        try {
          if (connectTimer) {
            clearTimeout(connectTimer);
            connectTimer = null;
          }
          resetIdleTimer();
          options.onOpen(this.socket as WebSocket);
        } catch (error) {
          settleReject(
            new ConnectionError(`${options.label} request send failed`, {
              code: ERROR_CODES.CONTACT_SYNC_SOCKET_FAILED,
              details: {
                stage: 'socket_connect',
                url: options.url,
                cause: error instanceof Error ? error.message : String(error),
              },
            })
          );
        }
      });

      this.socket.addEventListener('message', event => {
        void (async (): Promise<void> => {
          try {
            resetIdleTimer();
            const result = await options.onMessage(event.data, this.socket as WebSocket);
            if (result?.done) {
              settleResolve(result.result);
            }
          } catch (error) {
            settleReject(
              error instanceof Error ? error : new Error(error instanceof Error ? error.message : String(error))
            );
          }
        })();
      });

      this.socket.addEventListener('error', () => {
        settleReject(
          new ConnectionError(`${options.label} socket error`, {
            code: ERROR_CODES.CONTACT_SYNC_SOCKET_FAILED,
            details: {
              stage: 'socket_connect',
              url: options.url,
            },
          })
        );
      });

      this.socket.addEventListener('close', event => {
        if (settled) {
          cleanup();
          return;
        }
        settleReject(
          new ConnectionError(`${options.label} socket closed`, {
            code: ERROR_CODES.CONTACT_SYNC_SOCKET_FAILED,
            details: {
              stage: opened ? 'sync_page' : 'socket_connect',
              url: options.url,
              closeCode: event.code,
              closeReason: event.reason,
            },
          })
        );
      });
    });
  }

  public cancel(): void {
    const currentSocket = this.socket;
    const currentReject = this.rejectCurrent;
    this.rejectCurrent = null;
    this.socket = null;
    currentReject?.(
      new SDKError('Contact sync cancelled', ERROR_CODES.CONTACT_SYNC_CANCELLED, {
        details: {
          stage: 'cancelled',
        },
      })
    );
    if (currentSocket && currentSocket.readyState < WebSocket.CLOSING) {
      currentSocket.close(4001, 'contact-sync-cancelled');
    }
  }
}
