/**
 * Web 平台运行时适配器
 */

import type { RuntimeAdapter, RuntimePlatform } from '../types';

interface EventBridgeLike {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

interface DocumentLike extends EventBridgeLike {
  readonly visibilityState?: string;
}

interface NavigatorLike {
  readonly onLine?: boolean;
}

export interface WebRuntimeAdapterOptions {
  readonly platform: RuntimePlatform;
  readonly windowRef?: EventBridgeLike;
  readonly documentRef?: DocumentLike;
  readonly navigatorRef?: NavigatorLike;
}

const isForeground = (documentRef?: DocumentLike): boolean => {
  return documentRef?.visibilityState !== 'hidden';
};

export const createWebRuntimeAdapter = (options: WebRuntimeAdapterOptions): RuntimeAdapter => {
  return {
    getPlatform(): RuntimePlatform {
      return options.platform;
    },
    onNetworkChange(listener: (online: boolean) => void): () => void {
      const windowRef = options.windowRef;
      if (!windowRef) {
        return (): void => undefined;
      }

      const notifyOnline = (): void => {
        listener(true);
      };
      const notifyOffline = (): void => {
        listener(false);
      };

      windowRef.addEventListener('online', notifyOnline);
      windowRef.addEventListener('offline', notifyOffline);

      if (typeof options.navigatorRef?.onLine === 'boolean') {
        listener(options.navigatorRef.onLine);
      }

      return (): void => {
        windowRef.removeEventListener('online', notifyOnline);
        windowRef.removeEventListener('offline', notifyOffline);
      };
    },
    onAppVisibilityChange(listener: (foreground: boolean) => void): () => void {
      const documentRef = options.documentRef;
      if (!documentRef) {
        return (): void => undefined;
      }

      const handleVisibilityChange = (): void => {
        listener(isForeground(documentRef));
      };

      documentRef.addEventListener('visibilitychange', handleVisibilityChange);
      handleVisibilityChange();

      return (): void => {
        documentRef.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    },
  };
};
