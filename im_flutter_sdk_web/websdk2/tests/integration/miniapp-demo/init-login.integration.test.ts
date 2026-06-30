import { describe, expect, it, vi } from 'vitest';

import { RUNTIME_PLATFORMS } from '../../../src/platform';
import { DEFAULT_INIT_FORM } from '../../../miniprogram-demo/utils/env';
import { MiniProgramDemoRuntime, type MiniProgramClientLike } from '../../../miniprogram-demo/utils/demo-runtime';
import type { MiniProgramSdkModule } from '../../../miniprogram-demo/utils/sdk-loader';

const createFakeClient = (): MiniProgramClientLike & {
  readonly loginMock: ReturnType<typeof vi.fn>;
  readonly logoutMock: ReturnType<typeof vi.fn>;
} => {
  let currentUserId: string | null = null;
  let state = 'disconnected';
  const loginMock = vi.fn(async (form: { readonly userId: string; readonly token: string }) => {
    currentUserId = form.userId;
    state = 'connected';
  });
  const logoutMock = vi.fn(async () => {
    currentUserId = null;
    state = 'disconnected';
  });

  return {
    loginMock,
    logoutMock,
    addEventHandler: vi.fn(),
    login: loginMock,
    logout: logoutMock,
    getConnectionState: () => state,
    getCurrentUserId: () => currentUserId,
    chatManager: {
      createTextMessage: vi.fn(),
      createImageMessage: vi.fn(),
      createVoiceMessage: vi.fn(),
      createVideoMessage: vi.fn(),
      createFileMessage: vi.fn(),
      createLocationMessage: vi.fn(),
      createCmdMessage: vi.fn(),
      createCustomMessage: vi.fn(),
      sendMessage: vi.fn(),
    },
  } as unknown as MiniProgramClientLike & {
    readonly loginMock: ReturnType<typeof vi.fn>;
    readonly logoutMock: ReturnType<typeof vi.fn>;
  };
};

describe('miniapp-demo/init-login integration', () => {
  it('通过 runtime 串起初始化、登录、登出主路径', async () => {
    const fakeClient = createFakeClient();
    const initSpy = vi.fn(() => fakeClient);
    const logSpy = vi.fn();
    const stateSpy = vi.fn();
    const runtime = new MiniProgramDemoRuntime({
      loadSdk: async (): Promise<MiniProgramSdkModule> =>
        ({
          ChatClient: {
            init: initSpy,
          },
          RUNTIME_PLATFORMS,
        }) as unknown as MiniProgramSdkModule,
      addLog: logSpy,
      onConnectionStateChange: stateSpy,
    });

    const client = await runtime.init({
      ...DEFAULT_INIT_FORM,
      appKey: 'demo#app',
    });
    await runtime.login({
      userId: 'alice',
      token: 'token',
    });
    await runtime.logout();

    expect(client).toBe(fakeClient);
    expect(initSpy).toHaveBeenCalledTimes(1);
    expect(initSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        appKey: 'demo#app',
        enableSyncData: [],
        serviceConfig: {
          serverUrls: {
            restApiUrl: DEFAULT_INIT_FORM.restApiUrl,
            wsUrl: DEFAULT_INIT_FORM.wsUrl,
          },
        },
      })
    );
    expect(fakeClient.loginMock).toHaveBeenCalledWith({
      userId: 'alice',
      token: 'token',
    });
    expect(fakeClient.logoutMock).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith('success', 'SDK 初始化成功');
    expect(logSpy).toHaveBeenCalledWith('success', '登录成功: alice');
    expect(logSpy).toHaveBeenCalledWith('success', '登出成功');
    expect(stateSpy).toHaveBeenCalledWith('disconnected');
    expect(stateSpy).toHaveBeenCalledWith('connected');
  });
});
