import { describe, expect, it } from 'vitest';

import { RUNTIME_PLATFORMS, createWebRuntimeAdapter } from '../../../src/platform';

class MockEventBridge {
  private listeners: Map<string, Set<() => void>> = new Map();

  addEventListener(type: string, listener: () => void): void {
    const handlers = this.listeners.get(type) ?? new Set();
    handlers.add(listener);
    this.listeners.set(type, handlers);
  }

  removeEventListener(type: string, listener: () => void): void {
    const handlers = this.listeners.get(type);
    handlers?.delete(listener);
  }

  emit(type: string): void {
    const handlers = this.listeners.get(type);
    handlers?.forEach(handler => {
      handler();
    });
  }
}

class MockDocumentBridge extends MockEventBridge {
  visibilityState: 'visible' | 'hidden' = 'visible';
}

describe('platform/connection-state-unify', () => {
  it('统一网络在线/离线事件语义', () => {
    const windowBridge = new MockEventBridge();
    const adapter = createWebRuntimeAdapter({
      platform: RUNTIME_PLATFORMS.WEB,
      windowRef: windowBridge,
      navigatorRef: {
        onLine: true,
      },
    });

    const states: boolean[] = [];
    const unsubscribe = adapter.onNetworkChange(online => {
      states.push(online);
    });

    windowBridge.emit('offline');
    windowBridge.emit('online');
    unsubscribe();
    windowBridge.emit('offline');

    expect(states).toEqual([true, false, true]);
  });

  it('统一前后台切换事件语义', () => {
    const documentBridge = new MockDocumentBridge();
    const adapter = createWebRuntimeAdapter({
      platform: RUNTIME_PLATFORMS.WEB,
      documentRef: documentBridge,
    });

    const states: boolean[] = [];
    const unsubscribe = adapter.onAppVisibilityChange(foreground => {
      states.push(foreground);
    });

    documentBridge.visibilityState = 'hidden';
    documentBridge.emit('visibilitychange');
    documentBridge.visibilityState = 'visible';
    documentBridge.emit('visibilitychange');
    unsubscribe();
    documentBridge.visibilityState = 'hidden';
    documentBridge.emit('visibilitychange');

    expect(states).toEqual([true, false, true]);
  });
});
