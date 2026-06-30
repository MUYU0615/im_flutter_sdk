import { describe, it, expect, vi } from 'vitest';
import { EventHub } from '@/core/events/event-hub';
import { ConnectionEventReason, ConnectionStatus, type ConnectionEventPayload } from '@/types';
import { logger } from '@/utils/logger';

describe('EventHub', () => {
  const connectedPayload: ConnectionEventPayload = {
    state: ConnectionStatus.CONNECTED,
    reason: ConnectionEventReason.LOGIN,
    attempt: 0,
    maxAttempts: 0,
    isLoginPhase: true,
    isOnline: true,
    timestamp: 0,
  };

  it('同一 id 应该覆盖旧的 handler 组', () => {
    const eventHub = new EventHub();
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();

    eventHub.addEventHandler('ui', {
      onConnected: () => firstHandler(),
    });

    eventHub.addEventHandler('ui', {
      onConnected: () => secondHandler(),
    });

    eventHub.dispatch('onConnected', connectedPayload);

    expect(firstHandler).not.toHaveBeenCalled();
    expect(secondHandler).toHaveBeenCalledTimes(1);
  });

  it('移除不存在的 id 不应该报错', () => {
    const eventHub = new EventHub();
    expect(() => eventHub.removeEventHandler('missing')).not.toThrow();
  });

  it('某个 handler 抛错不影响其他 handler', () => {
    const eventHub = new EventHub();
    const okHandler = vi.fn();
    const errorHandler = vi.fn(() => {
      throw new Error('boom');
    });

    const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});

    eventHub.addEventHandler('bad', {
      onConnected: () => errorHandler(),
    });

    eventHub.addEventHandler('good', {
      onConnected: () => okHandler(),
    });

    expect(() => eventHub.dispatch('onConnected', connectedPayload)).not.toThrow();
    expect(okHandler).toHaveBeenCalledTimes(1);
    expect(loggerSpy).toHaveBeenCalled();

    loggerSpy.mockRestore();
  });

  it('内部异步 handler 完成后才派发外部 handler', async () => {
    const eventHub = new EventHub();
    const order: string[] = [];
    let resolveInternal: () => void = () => {};

    eventHub.addEventHandler('__internal:test', {
      onConnected: async () => {
        order.push('internal:start');
        await new Promise<void>(resolve => {
          resolveInternal = resolve;
        });
        order.push('internal:end');
      },
    });

    eventHub.addEventHandler('ui', {
      onConnected: () => {
        order.push('external');
      },
    });

    eventHub.dispatch('onConnected', connectedPayload);
    expect(order).toEqual(['internal:start']);

    resolveInternal();
    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });

    expect(order).toEqual(['internal:start', 'internal:end', 'external']);
  });
});
