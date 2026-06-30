import { describe, expect, it } from 'vitest';

import { RuntimeEventBridge } from '../../../src/platform/runtime/runtime-event-bridge';
import { ConnectionEventNormalizer } from '../../../src/platform/runtime/connection-event-normalizer';
import { ConnectionEventName, ConnectionEventReason, ConnectionStatus } from '../../../src/types';
import type { RuntimeAdapter, RuntimePlatform } from '../../../src/platform/types';

class MockRuntimeAdapter implements RuntimeAdapter {
  private readonly networkListeners: Set<(online: boolean) => void> = new Set();
  private readonly visibilityListeners: Set<(foreground: boolean) => void> = new Set();

  getPlatform(): RuntimePlatform {
    return 'web';
  }

  onNetworkChange(listener: (online: boolean) => void): () => void {
    this.networkListeners.add(listener);
    return (): void => {
      this.networkListeners.delete(listener);
    };
  }

  onAppVisibilityChange(listener: (foreground: boolean) => void): () => void {
    this.visibilityListeners.add(listener);
    return (): void => {
      this.visibilityListeners.delete(listener);
    };
  }

  emitNetwork(online: boolean): void {
    this.networkListeners.forEach(listener => {
      listener(online);
    });
  }

  emitVisibility(foreground: boolean): void {
    this.visibilityListeners.forEach(listener => {
      listener(foreground);
    });
  }
}

describe('platform/network-recover', () => {
  it('离线到在线恢复时只派发一次恢复回调', () => {
    const runtime = new MockRuntimeAdapter();
    const events: string[] = [];
    const bridge = new RuntimeEventBridge(runtime, {
      onOnline: (): void => {
        events.push('online');
      },
      onOffline: (): void => {
        events.push('offline');
      },
      onForeground: (): void => undefined,
      onBackground: (): void => undefined,
    });

    bridge.start();

    runtime.emitNetwork(true);
    events.length = 0;

    runtime.emitNetwork(false);
    runtime.emitNetwork(false);
    runtime.emitNetwork(true);
    runtime.emitNetwork(true);

    expect(events).toEqual(['offline', 'online']);

    bridge.stop();
    runtime.emitNetwork(false);

    expect(events).toEqual(['offline', 'online']);
  });

  it('连接状态映射与去重策略保持一致', () => {
    const normalizer = new ConnectionEventNormalizer();
    const payload = {
      state: ConnectionStatus.RECONNECTING,
      reason: ConnectionEventReason.OFFLINE_RECOVER,
      attempt: 1,
      maxAttempts: 10,
      isLoginPhase: false,
      isOnline: true,
      timestamp: Date.now(),
    };

    const firstEvent = normalizer.normalize(ConnectionStatus.RECONNECTING, payload);
    const duplicateEvent = normalizer.normalize(ConnectionStatus.RECONNECTING, {
      ...payload,
      timestamp: payload.timestamp + 1,
    });
    const nextAttemptEvent = normalizer.normalize(ConnectionStatus.RECONNECTING, {
      ...payload,
      attempt: 2,
      timestamp: payload.timestamp + 2,
    });

    expect(firstEvent?.eventName).toBe(ConnectionEventName.CONNECTING);
    expect(duplicateEvent).toBeNull();
    expect(nextAttemptEvent?.eventName).toBe(ConnectionEventName.CONNECTING);
  });
});
