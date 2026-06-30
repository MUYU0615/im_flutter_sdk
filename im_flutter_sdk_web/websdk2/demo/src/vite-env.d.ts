/// <reference types="vite/client" /> // Vite 类型引用

declare global {
  interface ImportMetaEnv {
    readonly VITE_EASEMOB_APPKEY?: string;
    readonly VITE_EASEMOB_DNS_URLS?: string;
    readonly VITE_EASEMOB_USE_FIXED_URLS?: string;
    readonly VITE_EASEMOB_USERID?: string;
    readonly VITE_EASEMOB_TOKEN?: string;
    readonly VITE_EASEMOB_PASSWORD?: string;
    readonly VITE_EASEMOB_TARGET_ID?: string;
    readonly VITE_EASEMOB_CHANNEL_TYPE?: 'single' | 'group' | 'room';
    readonly VITE_EASEMOB_MESSAGE?: string;
    readonly EASEMOB_APPKEY?: string; // AppKey
    readonly EASEMOB_DNS_URLS?: string; // DNS 地址
    readonly EASEMOB_USE_FIXED_URLS?: string; // 是否使用固定服务地址
    readonly EASEMOB_USERID?: string; // 用户 ID
    readonly EASEMOB_TOKEN?: string; // Token
    readonly EASEMOB_PASSWORD?: string; // Password
    readonly EASEMOB_TARGET_ID?: string; // 目标 ID
    readonly EASEMOB_CHANNEL_TYPE?: 'single' | 'group' | 'room'; // 会话类型
    readonly EASEMOB_MESSAGE?: string; // 默认消息
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  interface Window {
    __demoClient: import('./types').DemoClient | null;
    __cacheQuota: import('./types').CacheDebugTools | null;
  }
}

export {};
