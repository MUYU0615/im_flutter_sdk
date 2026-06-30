import { vi } from 'vitest'; // 引入 Vitest Mock 工具
import { ChatClient } from '@/chat-client'; // 引入 ChatClient
import { ConnectionManager } from '@/core/connection/connection-manager';
import { buildProvisionResponse } from '../../test-utils/msync';
import { attachmentFileStore } from '@/upload/attachment-file-store';

export const resetChatClientSingleton = (): void => { // 重置单例
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null; // 清理实例
  attachmentFileStore.clear();
};

export class MockWebSocket { // Mock WebSocket
  static CONNECTING = 0; // 连接中状态
  static OPEN = 1; // 已连接状态
  static CLOSING = 2; // 关闭中状态
  static CLOSED = 3; // 已关闭状态
  static instances: MockWebSocket[] = []; // 实例列表

  url: string; // WebSocket URL
  readyState = MockWebSocket.CONNECTING; // 当前连接状态
  onopen: ((event: Event) => void) | null = null; // open 回调
  onclose: ((event: CloseEvent) => void) | null = null; // close 回调
  onerror: ((event: Event) => void) | null = null; // error 回调
  onmessage: ((event: MessageEvent) => void) | null = null; // message 回调
  binaryType = 'arraybuffer'; // 二进制类型
  private listeners = new Map<string, Set<(event: Event) => void>>(); // 事件监听器
  private provisionHandled = false; // provision 回包标记

  private emit(type: string, event: Event): void { // 同时派发属性回调与事件监听器
    if (type === 'open') {
      this.onopen?.(event);
    } else if (type === 'close') {
      this.onclose?.(event as CloseEvent);
    } else if (type === 'error') {
      this.onerror?.(event);
    } else if (type === 'message') {
      this.onmessage?.(event as MessageEvent);
    }
    this.listeners.get(type)?.forEach(listener => listener(event));
  }

  constructor(url: string) { // 构造函数
    this.url = url; // 保存 URL
    MockWebSocket.instances.push(this); // 记录实例

    setTimeout(() => { // 模拟异步连接成功
      this.readyState = MockWebSocket.OPEN; // 更新状态为已连接
      this.emit('open', new Event('open')); // 触发 open 回调
      this.emit('message', { data: buildProvisionResponse() } as MessageEvent); // 主动回包 provision
    }, 0); // 立即执行
  }

  send(): void { // 发送方法
    if (this.provisionHandled) { // 已响应过 provision
      return; // 直接返回
    }
    this.provisionHandled = true; // 标记已处理
    this.emit('message', { data: buildProvisionResponse() } as MessageEvent); // 触发 provision 回包
  }

  addEventListener(type: string, handler: (event: Event) => void): void { // 添加事件监听
    if (!this.listeners.has(type)) { // 首次注册事件
      this.listeners.set(type, new Set()); // 初始化集合
    }
    this.listeners.get(type)!.add(handler); // 添加监听器
  }

  removeEventListener(type: string, handler: (event: Event) => void): void { // 移除事件监听
    this.listeners.get(type)?.delete(handler); // 删除监听器
  }

  close(): void { // 关闭连接
    this.readyState = MockWebSocket.CLOSED; // 更新状态为已关闭
    this.emit('close', new Event('close') as CloseEvent); // 触发 close 回调
  }
}

export const createJsonResponse = (data: unknown, ok = true): Response => { // 构造 JSON 响应
  return { // 返回 Response 结构
    ok, // 响应是否成功
    status: ok ? 200 : 500, // 状态码
    statusText: ok ? 'OK' : 'Error', // 状态描述
    headers: { // 响应头
      get: () => 'application/json', // 内容类型
    }, // 结束响应头
    json: async () => data, // JSON 响应体
    text: async () => JSON.stringify(data), // 文本响应体
  } as unknown as Response; // 断言为 Response
};

export const setupLoggedInClient = async (options?: { // 创建已登录客户端
  userId?: string; // 用户 ID
  token?: string; // 用户 token
  dnsConfigUrls?: string[]; // DNS 地址列表
}): Promise<ChatClient> => { // 返回 ChatClient
  const userId = options?.userId ?? 'user-1'; // 默认用户 ID
  const token = options?.token ?? 'token-1'; // 默认 token
  const dnsConfigUrls = options?.dnsConfigUrls ?? ['https://rs.easemob.com']; // 默认 DNS 列表
  const dnsConfig = { // 构造 DNS 配置
    rest: { hosts: [{ protocol: 'http', domain: 'rest.example.com', port: '80' }] }, // REST 地址
    'msync-wx': { hosts: [{ protocol: 'http', domain: 'msync.example.com', port: '80' }] }, // 长连地址
  }; // 结束 DNS 配置

  globalThis.fetch = vi.fn(async () => createJsonResponse(dnsConfig)) as unknown as typeof fetch; // Mock fetch
  globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket; // Mock WebSocket
  vi.spyOn(ConnectionManager.prototype as any, 'startProvision').mockResolvedValue(undefined);

  const client = ChatClient.init({ appKey: 'app-key', serviceConfig: { dnsConfigUrls } }); // 初始化客户端
  await client.login({ userId, token }); // 登录

  return client; // 返回客户端
};
