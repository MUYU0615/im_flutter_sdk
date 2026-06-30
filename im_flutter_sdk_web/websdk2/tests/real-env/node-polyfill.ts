/**
 * Node.js 环境 polyfill：注入 WebSocket、window、document 等使 ChatClient 平台检测为 web。
 * 在 real-env 测试文件顶部 import 即可。
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore ws 无类型声明
import WebSocket from 'ws';

const g = globalThis as unknown as Record<string, unknown>;

if (typeof g.WebSocket === 'undefined') {
  g.WebSocket = WebSocket;
}
if (typeof g.window === 'undefined') {
  g.window = {
    addEventListener: (): void => { /* stub */ },
    removeEventListener: (): void => { /* stub */ },
    navigator: { onLine: true },
  };
}
if (typeof g.document === 'undefined') {
  g.document = {
    addEventListener: (): void => { /* stub */ },
    removeEventListener: (): void => { /* stub */ },
    visibilityState: 'visible',
  };
}
if (typeof g.XMLHttpRequest === 'undefined') {
  // 最小 stub，upload adapter 需要 XMLHttpRequest 构造函数存在
  g.XMLHttpRequest = class {
    open(): void { /* stub */ }
    send(): void { /* stub */ }
    setRequestHeader(): void { /* stub */ }
    addEventListener(): void { /* stub */ }
  } as unknown as typeof XMLHttpRequest;
}
if (typeof g.localStorage === 'undefined') {
  const store = new Map<string, string>();
  g.localStorage = {
    getItem: (key: string): string | null => store.get(key) ?? null,
    setItem: (key: string, value: string): void => { store.set(key, value); },
    removeItem: (key: string): void => { store.delete(key); },
    clear: (): void => { store.clear(); },
    get length(): number { return store.size; },
    key: (index: number): string | null => [...store.keys()][index] ?? null,
  };
  // 同步到 window 上
  if (g.window && typeof g.window === 'object') {
    (g.window as Record<string, unknown>).localStorage = g.localStorage;
  }
}
