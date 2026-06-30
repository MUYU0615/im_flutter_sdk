/**
 * 连接事件归一化与去重
 */

import {
  ConnectionEventName,
  ConnectionStatus,
  type ConnectionEventName as ConnectionEventNameType,
  type ConnectionEventPayload,
  type ConnectionStatus as ConnectionStatusType,
} from '../../types';

interface NormalizedConnectionEvent {
  readonly eventName: ConnectionEventNameType;
  readonly payload: ConnectionEventPayload;
}

const resolveEventName = (status: ConnectionStatusType): ConnectionEventNameType | null => {
  switch (status) {
    case ConnectionStatus.CONNECTING:
    case ConnectionStatus.RECONNECTING:
      return ConnectionEventName.CONNECTING;
    case ConnectionStatus.CONNECTED:
      return ConnectionEventName.CONNECTED;
    case ConnectionStatus.DISCONNECTED:
      return ConnectionEventName.DISCONNECTED;
    case ConnectionStatus.RECONNECT_FAILED:
      return ConnectionEventName.RECONNECT_FAILED;
    default:
      return null;
  }
};

const buildEventKey = (
  eventName: ConnectionEventNameType,
  payload: ConnectionEventPayload
): string => {
  return [
    eventName,
    payload.state,
    payload.reason,
    String(payload.attempt),
    String(payload.maxAttempts),
    String(payload.isLoginPhase),
    String(payload.isOnline),
    String(payload.errorCode ?? ''),
    payload.errorMessage ?? '',
  ].join('|');
};

export class ConnectionEventNormalizer {
  private lastEventKey: string | null = null;

  normalize(
    status: ConnectionStatusType,
    payload: ConnectionEventPayload
  ): NormalizedConnectionEvent | null {
    const eventName = resolveEventName(status);
    if (!eventName) {
      return null;
    }

    const eventKey = buildEventKey(eventName, payload);
    if (this.lastEventKey === eventKey) {
      return null;
    }

    this.lastEventKey = eventKey;
    return {
      eventName,
      payload,
    };
  }

  reset(): void {
    this.lastEventKey = null;
  }
}
