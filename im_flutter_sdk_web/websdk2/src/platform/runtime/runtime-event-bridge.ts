/**
 * 运行时事件桥接器
 */

import type { RuntimeAdapter } from '../types';

export interface RuntimeEventBridgeHandlers {
  readonly onOnline: () => void;
  readonly onOffline: () => void;
  readonly onForeground: () => void;
  readonly onBackground: () => void;
}

export class RuntimeEventBridge {
  private readonly runtime: RuntimeAdapter;
  private readonly handlers: RuntimeEventBridgeHandlers;
  private unsubscribeNetwork: (() => void) | null = null;
  private unsubscribeVisibility: (() => void) | null = null;
  private lastOnline: boolean | null = null;
  private lastForeground: boolean | null = null;

  constructor(runtime: RuntimeAdapter, handlers: RuntimeEventBridgeHandlers) {
    this.runtime = runtime;
    this.handlers = handlers;
  }

  start(): void {
    if (this.unsubscribeNetwork || this.unsubscribeVisibility) {
      return;
    }

    this.unsubscribeNetwork = this.runtime.onNetworkChange(online => {
      this.handleNetworkChange(online);
    });
    this.unsubscribeVisibility = this.runtime.onAppVisibilityChange(foreground => {
      this.handleVisibilityChange(foreground);
    });
  }

  stop(): void {
    this.unsubscribeNetwork?.();
    this.unsubscribeVisibility?.();
    this.unsubscribeNetwork = null;
    this.unsubscribeVisibility = null;
    this.lastOnline = null;
    this.lastForeground = null;
  }

  private handleNetworkChange(online: boolean): void {
    if (this.lastOnline === online) {
      return;
    }
    this.lastOnline = online;
    if (online) {
      this.handlers.onOnline();
      return;
    }
    this.handlers.onOffline();
  }

  private handleVisibilityChange(foreground: boolean): void {
    if (this.lastForeground === foreground) {
      return;
    }
    this.lastForeground = foreground;
    if (foreground) {
      this.handlers.onForeground();
      return;
    }
    this.handlers.onBackground();
  }
}
