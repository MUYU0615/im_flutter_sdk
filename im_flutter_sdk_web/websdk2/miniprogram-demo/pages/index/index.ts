import type { MiniAppWxLike } from '../../utils/platform-adapters';
import {
  buildCmdDraft,
  buildCustomDraft,
  buildFileDraft,
  buildImageDraft,
  buildLocationDraft,
  buildTextDraft,
  buildVideoDraft,
  buildVoiceDraft,
  DEFAULT_DRAFT_STATE,
  normalizeSelection,
  type MiniAppAttachmentSelection,
  type MiniAppDraftState,
} from '../../utils/message-drafts';
import {
  CHANNEL_TYPE_OPTIONS,
  DEFAULT_INIT_FORM,
  DEFAULT_LOGIN_FORM,
  MESSAGE_TYPE_OPTIONS,
  type MiniAppChannelType,
  type MiniAppMessageType,
} from '../../utils/env';
import {
  MiniProgramDemoRuntime,
  type DemoLogEntry,
  type DemoLogLevel,
  type MiniProgramClientLike,
} from '../../utils/demo-runtime';
import { getMiniProgramSdkMode } from '../../utils/sdk-loader';

const MAX_LOG_COUNT = 80;

interface ChooseMediaFile {
  readonly tempFilePath: string;
  readonly size: number;
  readonly duration?: number;
  readonly width?: number;
  readonly height?: number;
  readonly fileType?: string;
}

interface ChooseMessageFileItem {
  readonly path: string;
  readonly size: number;
  readonly name: string;
  readonly type?: string;
  readonly time?: number;
}

interface ChooseLocationResult {
  readonly latitude: number;
  readonly longitude: number;
  readonly address?: string;
  readonly name?: string;
}

interface MiniProgramDemoWx extends MiniAppWxLike {
  chooseMedia?(options: {
    readonly count?: number;
    readonly mediaType?: ReadonlyArray<'image' | 'video'>;
    readonly sourceType?: ReadonlyArray<'album' | 'camera'>;
    readonly success?: (result: { readonly tempFiles: ReadonlyArray<ChooseMediaFile> }) => void;
    readonly fail?: (error: unknown) => void;
  }): void;
  chooseMessageFile?(options: {
    readonly count?: number;
    readonly type?: 'all' | 'video' | 'image' | 'file';
    readonly extension?: ReadonlyArray<string>;
    readonly success?: (result: { readonly tempFiles: ReadonlyArray<ChooseMessageFileItem> }) => void;
    readonly fail?: (error: unknown) => void;
  }): void;
  chooseLocation?(options: {
    readonly success?: (result: ChooseLocationResult) => void;
    readonly fail?: (error: unknown) => void;
  }): void;
  showToast?(options: {
    readonly title: string;
    readonly icon?: 'success' | 'error' | 'none';
    readonly duration?: number;
  }): void;
}

interface InputEvent {
  readonly currentTarget: {
    readonly dataset: {
      readonly path?: string;
    };
  };
  readonly detail: {
    readonly value: string;
  };
}

interface SwitchEvent {
  readonly currentTarget: {
    readonly dataset: {
      readonly path?: string;
    };
  };
  readonly detail: {
    readonly value: boolean;
  };
}

interface PickerEvent {
  readonly detail: {
    readonly value: number | string;
  };
}

interface PageData {
  readonly sdkMode: string;
  readonly initForm: typeof DEFAULT_INIT_FORM;
  readonly loginForm: typeof DEFAULT_LOGIN_FORM;
  readonly draft: MiniAppDraftState;
  readonly messageTypeOptions: ReadonlyArray<MiniAppMessageType>;
  readonly messageTypeIndex: number;
  readonly channelTypeOptions: ReadonlyArray<MiniAppChannelType>;
  readonly channelTypeIndex: number;
  readonly logs: ReadonlyArray<DemoLogEntry>;
  readonly initialized: boolean;
  readonly connectionState: string;
  readonly currentUserId: string;
  readonly busy: boolean;
  readonly sending: boolean;
}

type CreatedMiniProgramMessage = ReturnType<
  MiniProgramClientLike['chatManager']['createTextMessage']
>;

interface IndexPageInstance {
  readonly data: PageData;
  runtime: MiniProgramDemoRuntime | null;
  setData(data: Record<string, unknown>, callback?: () => void): void;
  addLog(level: DemoLogLevel, message: string): void;
  syncSessionState(): void;
  showToast(message: string, level?: DemoLogLevel): void;
  withLoading(kind: 'busy' | 'sending', action: () => Promise<void>): Promise<void>;
  createMessage(client: MiniProgramClientLike): CreatedMiniProgramMessage;
}

const wxRef = wx as unknown as MiniProgramDemoWx;

const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'errMsg' in error) {
    return String((error as { errMsg?: unknown }).errMsg ?? 'unknown error');
  }
  return String(error);
};

const createLogEntry = (level: DemoLogLevel, message: string): DemoLogEntry => {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    level,
    message,
    time: new Date().toLocaleTimeString(),
  };
};

const toMediaSelection = (file: ChooseMediaFile): MiniAppAttachmentSelection => {
  return normalizeSelection({
    path: file.tempFilePath,
    size: file.size,
    duration: file.duration,
    width: file.width,
    height: file.height,
  });
};

const toMessageFileSelection = (file: ChooseMessageFileItem): MiniAppAttachmentSelection => {
  return normalizeSelection({
    path: file.path,
    name: file.name,
    type: file.type,
    size: file.size,
  });
};

const chooseMedia = (
  mediaType: 'image' | 'video'
): Promise<MiniAppAttachmentSelection> => {
  if (!wxRef.chooseMedia) {
    return Promise.reject(new Error('当前基础库不支持 chooseMedia'));
  }
  return new Promise<MiniAppAttachmentSelection>((resolve, reject) => {
    wxRef.chooseMedia?.({
      count: 1,
      mediaType: [mediaType],
      sourceType: ['album', 'camera'],
      success: (result): void => {
        const file = result.tempFiles[0];
        if (!file) {
          reject(new Error('未选择素材'));
          return;
        }
        resolve(toMediaSelection(file));
      },
      fail: (error): void => {
        reject(new Error(formatError(error)));
      },
    });
  });
};

const chooseMessageFile = (
  options?: { readonly extension?: ReadonlyArray<string> }
): Promise<MiniAppAttachmentSelection> => {
  if (!wxRef.chooseMessageFile) {
    return Promise.reject(new Error('当前基础库不支持 chooseMessageFile'));
  }
  return new Promise<MiniAppAttachmentSelection>((resolve, reject) => {
    wxRef.chooseMessageFile?.({
      count: 1,
      type: 'file',
      extension: options?.extension,
      success: (result): void => {
        const file = result.tempFiles[0];
        if (!file) {
          reject(new Error('未选择文件'));
          return;
        }
        resolve(toMessageFileSelection(file));
      },
      fail: (error): void => {
        reject(new Error(formatError(error)));
      },
    });
  });
};

const chooseLocation = (): Promise<ChooseLocationResult> => {
  if (!wxRef.chooseLocation) {
    return Promise.reject(new Error('当前基础库不支持 chooseLocation'));
  }
  return new Promise<ChooseLocationResult>((resolve, reject) => {
    wxRef.chooseLocation?.({
      success: (result): void => {
        resolve(result);
      },
      fail: (error): void => {
        reject(new Error(formatError(error)));
      },
    });
  });
};

const buildMessageFromDraft = (
  client: MiniProgramClientLike,
  messageType: MiniAppMessageType,
  draft: MiniAppDraftState
): CreatedMiniProgramMessage => {
  switch (messageType) {
    case 'text':
      return client.chatManager.createTextMessage(buildTextDraft(draft));
    case 'image':
      return client.chatManager.createImageMessage(buildImageDraft(draft));
    case 'voice':
      return client.chatManager.createVoiceMessage(buildVoiceDraft(draft));
    case 'video':
      return client.chatManager.createVideoMessage(buildVideoDraft(draft));
    case 'file':
      return client.chatManager.createFileMessage(buildFileDraft(draft));
    case 'location':
      return client.chatManager.createLocationMessage(buildLocationDraft(draft));
    case 'cmd':
      return client.chatManager.createCmdMessage(buildCmdDraft(draft));
    case 'custom':
      return client.chatManager.createCustomMessage(buildCustomDraft(draft));
  }
};

Page({
  data: {
    sdkMode: getMiniProgramSdkMode(),
    initForm: DEFAULT_INIT_FORM,
    loginForm: DEFAULT_LOGIN_FORM,
    draft: DEFAULT_DRAFT_STATE,
    messageTypeOptions: MESSAGE_TYPE_OPTIONS,
    messageTypeIndex: 0,
    channelTypeOptions: CHANNEL_TYPE_OPTIONS,
    channelTypeIndex: 0,
    logs: [],
    initialized: false,
    connectionState: 'disconnected',
    currentUserId: '',
    busy: false,
    sending: false,
  } satisfies PageData,

  runtime: null,

  onLoad(this: IndexPageInstance): void {
    this.runtime = new MiniProgramDemoRuntime({
      addLog: (level, message): void => {
        this.addLog(level, message);
      },
      onConnectionStateChange: (state): void => {
        this.setData({
          connectionState: state,
        });
      },
    });
    this.syncSessionState();
  },

  addLog(this: IndexPageInstance, level: DemoLogLevel, message: string): void {
    const nextLogs = [createLogEntry(level, message), ...this.data.logs].slice(0, MAX_LOG_COUNT);
    this.setData({
      logs: nextLogs,
    });
  },

  syncSessionState(this: IndexPageInstance): void {
    const client = this.runtime?.getClient() ?? null;
    this.setData({
      initialized: Boolean(client),
      currentUserId: client?.getCurrentUserId() ?? '',
      connectionState: client?.getConnectionState() ?? 'disconnected',
    });
  },

  showToast(this: IndexPageInstance, message: string, level: DemoLogLevel = 'info'): void {
    const icon = level === 'success' ? 'success' : level === 'error' ? 'error' : 'none';
    wxRef.showToast?.({
      title: message,
      icon,
      duration: 1800,
    });
  },

  async withLoading(
    this: IndexPageInstance,
    kind: 'busy' | 'sending',
    action: () => Promise<void>
  ): Promise<void> {
    this.setData({
      [kind]: true,
    });
    try {
      await action();
    } finally {
      this.setData({
        [kind]: false,
      });
    }
  },

  handleInput(this: IndexPageInstance, event: InputEvent): void {
    const path = event.currentTarget.dataset.path;
    if (!path) {
      return;
    }
    this.setData({
      [path]: event.detail.value,
    });
  },

  handleSwitch(this: IndexPageInstance, event: SwitchEvent): void {
    const path = event.currentTarget.dataset.path;
    if (!path) {
      return;
    }
    this.setData({
      [path]: event.detail.value,
    });
  },

  handleMessageTypeChange(this: IndexPageInstance, event: PickerEvent): void {
    const nextIndex = Number(event.detail.value);
    this.setData({
      messageTypeIndex: nextIndex,
    });
  },

  handleChannelTypeChange(this: IndexPageInstance, event: PickerEvent): void {
    const nextIndex = Number(event.detail.value);
    const nextChannelType = CHANNEL_TYPE_OPTIONS[nextIndex] ?? 'single';
    this.setData({
      channelTypeIndex: nextIndex,
      'draft.channelType': nextChannelType,
    });
  },

  async initSdk(this: IndexPageInstance): Promise<void> {
    await this.withLoading('busy', async (): Promise<void> => {
      try {
        await this.runtime?.init(this.data.initForm);
        this.syncSessionState();
        this.showToast('初始化成功', 'success');
      } catch (error) {
        const message = `初始化失败: ${formatError(error)}`;
        this.addLog('error', message);
        this.showToast('初始化失败', 'error');
      }
    });
  },

  async login(this: IndexPageInstance): Promise<void> {
    await this.withLoading('busy', async (): Promise<void> => {
      try {
        await this.runtime?.login(this.data.loginForm);
        this.syncSessionState();
        this.showToast('登录成功', 'success');
      } catch (error) {
        const message = `登录失败: ${formatError(error)}`;
        this.addLog('error', message);
        this.showToast('登录失败', 'error');
      }
    });
  },

  async logout(this: IndexPageInstance): Promise<void> {
    await this.withLoading('busy', async (): Promise<void> => {
      try {
        await this.runtime?.logout();
        this.syncSessionState();
        this.showToast('已登出', 'success');
      } catch (error) {
        const message = `登出失败: ${formatError(error)}`;
        this.addLog('error', message);
        this.showToast('登出失败', 'error');
      }
    });
  },

  async sendCurrentMessage(this: IndexPageInstance): Promise<void> {
    await this.withLoading('sending', async (): Promise<void> => {
      try {
        const messageType = MESSAGE_TYPE_OPTIONS[this.data.messageTypeIndex] ?? 'text';
        const sentMessage = await this.runtime?.sendMessage(client =>
          buildMessageFromDraft(client, messageType, this.data.draft)
        );
        this.syncSessionState();
        this.addLog(
          'info',
          `消息已发送: ${sentMessage?.type ?? messageType} / ${sentMessage?.msgLocalId ?? '-'}`
        );
        this.showToast('发送成功', 'success');
      } catch (error) {
        const message = `发送失败: ${formatError(error)}`;
        this.addLog('error', message);
        this.showToast('发送失败', 'error');
      }
    });
  },

  async chooseImage(this: IndexPageInstance): Promise<void> {
    try {
      const selection = await chooseMedia('image');
      this.setData({
        'draft.imageSelection': selection,
      });
      this.addLog('info', `已选择图片: ${selection.name}`);
    } catch (error) {
      this.addLog('warn', `选择图片失败: ${formatError(error)}`);
    }
  },

  async chooseVoice(this: IndexPageInstance): Promise<void> {
    try {
      const selection = await chooseMessageFile({
        extension: ['mp3', 'm4a', 'aac', 'wav', 'amr'],
      });
      this.setData({
        'draft.voiceSelection': selection,
        'draft.voiceDuration': this.data.draft.voiceDuration || '',
      });
      this.addLog('info', `已选择语音: ${selection.name}`);
    } catch (error) {
      this.addLog('warn', `选择语音失败: ${formatError(error)}`);
    }
  },

  async chooseVideo(this: IndexPageInstance): Promise<void> {
    try {
      const selection = await chooseMedia('video');
      this.setData({
        'draft.videoSelection': selection,
      });
      this.addLog('info', `已选择视频: ${selection.name}`);
    } catch (error) {
      this.addLog('warn', `选择视频失败: ${formatError(error)}`);
    }
  },

  async chooseFile(this: IndexPageInstance): Promise<void> {
    try {
      const selection = await chooseMessageFile();
      this.setData({
        'draft.fileSelection': selection,
      });
      this.addLog('info', `已选择文件: ${selection.name}`);
    } catch (error) {
      this.addLog('warn', `选择文件失败: ${formatError(error)}`);
    }
  },

  async pickLocation(this: IndexPageInstance): Promise<void> {
    try {
      const location = await chooseLocation();
      this.setData({
        'draft.locationLatitude': String(location.latitude),
        'draft.locationLongitude': String(location.longitude),
        'draft.locationAddress': location.address ?? '',
        'draft.locationBuildingName': location.name ?? '',
      });
      this.addLog('info', '已填充位置坐标');
    } catch (error) {
      this.addLog('warn', `选择位置失败: ${formatError(error)}`);
    }
  },

  clearAttachment(this: IndexPageInstance, event: InputEvent): void {
    const path = event.currentTarget.dataset.path;
    if (!path) {
      return;
    }
    this.setData({
      [path]: null,
    });
  },
} as Record<string, unknown>);
