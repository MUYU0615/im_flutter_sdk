/**
 * 多 ChatClient 实例管理
 *
 * ChatClient.init 是单例模式，需要绕过才能创建多个实例。
 * 通过传入 serviceConfig.serverUrls 跳过 DNS 解析，确保重置单例后仍能正常连接。
 */
import { ChatClient } from '@/chat-client';
import type { ManagerRegistration } from '@/types';

export interface ClientInstance {
  readonly client: ChatClient;
  readonly userId: string;
  readonly token: string;
}

export interface CreateFreshClientOptions {
  readonly appKey: string;
  readonly restApiUrl?: string;
  readonly wsUrl?: string;
  readonly managers?: ReadonlyArray<ManagerRegistration<ChatClient>>;
}

/**
 * 创建新的 ChatClient 实例（绕过单例）
 * 如果提供了 restApiUrl/wsUrl，会跳过 DNS 解析直接连接。
 */
export function createFreshClient(options: CreateFreshClientOptions): ChatClient {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;

  const initConfig: Record<string, unknown> = {
    appKey: options.appKey,
    useFixedDeviceId: true,
  };

  if (options.restApiUrl && options.wsUrl) {
    initConfig.serviceConfig = {
      serverUrls: {
        restApiUrl: options.restApiUrl,
        wsUrl: options.wsUrl,
      },
    };
  }

  if (options.managers && options.managers.length > 0) {
    initConfig.managers = options.managers;
  }

  return ChatClient.init(initConfig as Parameters<typeof ChatClient.init>[0]);
}

/**
 * 创建并登录一个 ChatClient 实例
 */
export async function createAndLogin(options: CreateFreshClientOptions & {
  userId: string;
  token: string;
}): Promise<ClientInstance> {
  const client = createFreshClient(options);
  await client.login({ userId: options.userId, token: options.token });
  return { client, userId: options.userId, token: options.token };
}

/**
 * 批量登出并清理实例
 */
export async function cleanupClients(...instances: ClientInstance[]): Promise<void> {
  for (const inst of instances) {
    try {
      if (inst.client.getConnectionState() === 'connected') {
        await inst.client.logout();
      }
    } catch {
      // 忽略登出错误
    }
  }
}
