import type {
  CreateCmdMessageParams,
  CreateCustomMessageParams,
  CreateFileMessageParams,
  CreateImageMessageParams,
  CreateLocationMessageParams,
  CreateTextMessageParams,
  CreateVideoMessageParams,
  CreateVoiceMessageParams,
  Message,
} from '../../src/types';
import type { ConnectionEventHandlerMap } from '../../src/types/event-system';
import type { MiniAppInitForm, MiniAppLoginForm } from './env';
import { loadSdkModule, type MiniProgramSdkLoader, type MiniProgramSdkModule } from './sdk-loader';
import { buildInitConfig, buildInitSignature, validateInitForm, validateLoginForm } from './session-controller';

export type DemoLogLevel = 'info' | 'warn' | 'error' | 'success';

export interface DemoLogEntry {
  readonly id: string;
  readonly level: DemoLogLevel;
  readonly message: string;
  readonly time: string;
}

export interface MiniProgramClientLike {
  addEventHandler(id: string, handlers: ConnectionEventHandlerMap): void;
  login(form: MiniAppLoginForm): Promise<void>;
  logout(): Promise<void>;
  getConnectionState(): string;
  getCurrentUserId(): string | null;
  readonly chatManager: MiniProgramChatManagerLike;
}

export interface MiniProgramChatManagerLike {
  createTextMessage(params: CreateTextMessageParams): Message;
  createImageMessage(params: CreateImageMessageParams): Message;
  createVoiceMessage(params: CreateVoiceMessageParams): Message;
  createVideoMessage(params: CreateVideoMessageParams): Message;
  createFileMessage(params: CreateFileMessageParams): Message;
  createLocationMessage(params: CreateLocationMessageParams): Message;
  createCmdMessage(params: CreateCmdMessageParams): Message;
  createCustomMessage(params: CreateCustomMessageParams): Message;
  sendMessage(message: Message): Promise<Message>;
}

export interface DemoRuntimeDeps {
  readonly loadSdk?: MiniProgramSdkLoader;
  readonly addLog?: (level: DemoLogLevel, message: string) => void;
  readonly onConnectionStateChange?: (state: string) => void;
}

export class MiniProgramDemoRuntime {
  private readonly deps: DemoRuntimeDeps;
  private sdkModule: MiniProgramSdkModule | null = null;
  private client: MiniProgramClientLike | null = null;
  private initSignature: string | null = null;

  public constructor(deps: DemoRuntimeDeps) {
    this.deps = deps;
  }

  public getClient(): MiniProgramClientLike | null {
    return this.client;
  }

  public async init(form: MiniAppInitForm): Promise<MiniProgramClientLike> {
    const validationError = validateInitForm(form);
    if (validationError) {
      throw new Error(validationError);
    }

    const nextSignature = buildInitSignature(form);
    if (this.client && this.initSignature && this.initSignature !== nextSignature) {
      throw new Error('ChatClient 为单例，如需修改初始化配置请重启小程序');
    }

    this.sdkModule = await loadSdkModule(this.deps.loadSdk);
    const client = this.sdkModule.ChatClient.init(buildInitConfig(form)) as unknown as MiniProgramClientLike;

    client.addEventHandler('miniapp-demo', this.buildConnectionHandlers());
    this.client = client;
    this.initSignature = nextSignature;
    this.notifyConnectionState();
    this.log('success', 'SDK 初始化成功');
    return client;
  }

  public async login(form: MiniAppLoginForm): Promise<void> {
    const validationError = validateLoginForm(form);
    if (validationError) {
      throw new Error(validationError);
    }
    if (!this.client) {
      throw new Error('请先初始化 SDK');
    }
    await this.client.login({
      userId: form.userId.trim(),
      token: form.token.trim(),
    });
    this.notifyConnectionState();
    this.log('success', `登录成功: ${form.userId.trim()}`);
  }

  public async logout(): Promise<void> {
    if (!this.client) {
      throw new Error('请先初始化 SDK');
    }
    await this.client.logout();
    this.notifyConnectionState();
    this.log('success', '登出成功');
  }

  public async sendMessage(
    createMessage: (client: MiniProgramClientLike) => Message
  ): Promise<Message> {
    if (!this.client) {
      throw new Error('请先初始化 SDK');
    }
    const message = createMessage(this.client);
    const sentMessage = await this.client.chatManager.sendMessage(message);
    this.log('success', `发送成功: ${sentMessage.type}`);
    return sentMessage;
  }

  private buildConnectionHandlers(): ConnectionEventHandlerMap {
    return {
      onConnecting: (): void => {
        this.notifyConnectionState();
        this.log('info', '连接中');
      },
      onConnected: (): void => {
        this.notifyConnectionState();
        this.log('success', '已连接');
      },
      onDisconnected: (): void => {
        this.notifyConnectionState();
        this.log('warn', '连接断开');
      },
      onReconnectFailed: (): void => {
        this.notifyConnectionState();
        this.log('error', '重连失败');
      },
    };
  }

  private log(level: DemoLogLevel, message: string): void {
    this.deps.addLog?.(level, message);
  }

  private notifyConnectionState(): void {
    this.deps.onConnectionStateChange?.(this.client?.getConnectionState() ?? 'disconnected');
  }
}
