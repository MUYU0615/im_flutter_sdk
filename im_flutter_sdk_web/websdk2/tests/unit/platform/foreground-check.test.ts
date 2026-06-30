import { describe, expect, it } from 'vitest';

import { RuntimeEventBridge } from '../../../src/platform/runtime/runtime-event-bridge';
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

  emitVisibility(foreground: boolean): void {
    this.visibilityListeners.forEach(listener => {
      listener(foreground);
    });
  }
}

describe('platform/foreground-check', () => {
  it('前后台切换探测只在状态变化时触发', () => {
    const runtime = new MockRuntimeAdapter();
    const events: string[] = [];
    const bridge = new RuntimeEventBridge(runtime, {
      onOnline: (): void => undefined,
      onOffline: (): void => undefined,
      onForeground: (): void => {
        events.push('foreground');
      },
      onBackground: (): void => {
        events.push('background');
      },
    });

    bridge.start();

    runtime.emitVisibility(true);
    events.length = 0;

    runtime.emitVisibility(false);
    runtime.emitVisibility(false);
    runtime.emitVisibility(true);
    runtime.emitVisibility(true);

    expect(events).toEqual(['background', 'foreground']);

    bridge.stop();
    runtime.emitVisibility(false);

    expect(events).toEqual(['background', 'foreground']);
  });
});
