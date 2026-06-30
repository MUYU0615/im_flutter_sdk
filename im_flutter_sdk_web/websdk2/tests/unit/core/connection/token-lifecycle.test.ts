import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EventHub } from '@/core/events/event-hub';
import {
  ConnectionEventName,
  ConnectionEventReason,
  ConnectionStatus,
  type ConnectionEventPayload,
} from '@/types';
import { buildConnectionManager, spyConnectOnce } from './connection-test-utils';

describe('ConnectionManager token lifecycle', () => {
  let eventHub: EventHub;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-14T00:00:00.000Z'));
    eventHub = new EventHub();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('emits onTokenWillExpire once when remaining lifecycle enters final 20%', async () => {
    const manager = buildConnectionManager(eventHub);
    spyConnectOnce(manager).mockResolvedValueOnce(undefined);
    await manager.connect();

    const events: string[] = [];
    eventHub.addEventHandler('test', {
      [ConnectionEventName.TOKEN_WILL_EXPIRE]: (): void => {
        events.push('will-expire');
      },
    });

    manager.renewToken('token-2', Date.now() + 1000);
    await vi.advanceTimersByTimeAsync(799);
    expect(events).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(200);
    expect(events.filter((event) => event === 'will-expire')).toHaveLength(1);
  });

  it('emits onTokenExpired before token-expired disconnected state and pauses old reconnect', async () => {
    const manager = buildConnectionManager(eventHub);
    spyConnectOnce(manager).mockResolvedValueOnce(undefined);
    await manager.connect();

    const order: string[] = [];
    eventHub.addEventHandler('test', {
      [ConnectionEventName.TOKEN_EXPIRED]: (): void => {
        order.push('expired');
      },
      [ConnectionEventName.DISCONNECTED]: (payload: ConnectionEventPayload): void => {
        order.push(`disconnected:${payload.reason}`);
      },
    });

    manager.renewToken('token-2', Date.now() + 1000);
    await vi.advanceTimersByTimeAsync(1000);

    expect(order).toEqual(['expired', `disconnected:${ConnectionEventReason.TOKEN_EXPIRED}`]);
    expect(manager.getConnectionStatus()).toBe(ConnectionStatus.DISCONNECTED);
  });
});
