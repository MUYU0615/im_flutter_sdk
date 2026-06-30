import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_DRAFT_STATE,
  buildCmdDraft,
  buildCustomDraft,
  buildFileDraft,
  buildImageDraft,
  buildLocationDraft,
  buildTextDraft,
  buildVideoDraft,
  buildVoiceDraft,
  normalizeSelection,
} from '../../../miniprogram-demo/utils/message-drafts';
import { DEFAULT_INIT_FORM, type MiniAppMessageType } from '../../../miniprogram-demo/utils/env';
import {
  MiniProgramDemoRuntime,
  type MiniProgramClientLike,
} from '../../../miniprogram-demo/utils/demo-runtime';
import { RUNTIME_PLATFORMS } from '../../../src/platform';
import type { Message } from '../../../src/types';
import type { MiniProgramSdkModule } from '../../../miniprogram-demo/utils/sdk-loader';

const createFakeMessage = (type: MiniAppMessageType, body: Record<string, unknown>): Message => {
  return {
    msgLocalId: `local-${type}`,
    from: '',
    to: '',
    msgServerId: '',
    sender: {
      userId: 'demo-user',
    },
    conversationId: String(body.channelId ?? 'target-1'),
    conversationType: 'singleChat',
    type,
    status: 'sending',
    timestamp: Date.now(),
    body: body as unknown as Message['body'],
    ext: {},
  };
};

const createFakeClient = (): MiniProgramClientLike & {
  readonly createTextMessageMock: ReturnType<typeof vi.fn>;
  readonly createImageMessageMock: ReturnType<typeof vi.fn>;
  readonly createVoiceMessageMock: ReturnType<typeof vi.fn>;
  readonly createVideoMessageMock: ReturnType<typeof vi.fn>;
  readonly createFileMessageMock: ReturnType<typeof vi.fn>;
  readonly createLocationMessageMock: ReturnType<typeof vi.fn>;
  readonly createCmdMessageMock: ReturnType<typeof vi.fn>;
  readonly createCustomMessageMock: ReturnType<typeof vi.fn>;
  readonly sendMessageMock: ReturnType<typeof vi.fn>;
} => {
  const createTextMessageMock = vi.fn(params => createFakeMessage('text', params));
  const createImageMessageMock = vi.fn(params => createFakeMessage('image', params));
  const createVoiceMessageMock = vi.fn(params => createFakeMessage('voice', params));
  const createVideoMessageMock = vi.fn(params => createFakeMessage('video', params));
  const createFileMessageMock = vi.fn(params => createFakeMessage('file', params));
  const createLocationMessageMock = vi.fn(params => createFakeMessage('location', params));
  const createCmdMessageMock = vi.fn(params => createFakeMessage('cmd', params));
  const createCustomMessageMock = vi.fn(params => createFakeMessage('custom', params));
  const sendMessageMock = vi.fn(async (message: Message) => ({
    ...message,
    status: 'sent',
  }));
  const chatManager = {
    createTextMessage: createTextMessageMock,
    createImageMessage: createImageMessageMock,
    createVoiceMessage: createVoiceMessageMock,
    createVideoMessage: createVideoMessageMock,
    createFileMessage: createFileMessageMock,
    createLocationMessage: createLocationMessageMock,
    createCmdMessage: createCmdMessageMock,
    createCustomMessage: createCustomMessageMock,
    sendMessage: sendMessageMock,
  };

  return {
    addEventHandler: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    getConnectionState: () => 'connected',
    getCurrentUserId: () => 'demo-user',
    createTextMessageMock,
    createImageMessageMock,
    createVoiceMessageMock,
    createVideoMessageMock,
    createFileMessageMock,
    createLocationMessageMock,
    createCmdMessageMock,
    createCustomMessageMock,
    sendMessageMock,
    chatManager,
  } as unknown as MiniProgramClientLike & {
    readonly createTextMessageMock: ReturnType<typeof vi.fn>;
    readonly createImageMessageMock: ReturnType<typeof vi.fn>;
    readonly createVoiceMessageMock: ReturnType<typeof vi.fn>;
    readonly createVideoMessageMock: ReturnType<typeof vi.fn>;
    readonly createFileMessageMock: ReturnType<typeof vi.fn>;
    readonly createLocationMessageMock: ReturnType<typeof vi.fn>;
    readonly createCmdMessageMock: ReturnType<typeof vi.fn>;
    readonly createCustomMessageMock: ReturnType<typeof vi.fn>;
    readonly sendMessageMock: ReturnType<typeof vi.fn>;
  };
};

const createRuntime = async () => {
  const fakeClient = createFakeClient();
  const runtime = new MiniProgramDemoRuntime({
    loadSdk: async (): Promise<MiniProgramSdkModule> =>
      ({
        ChatClient: {
          init: vi.fn(() => fakeClient),
        },
        RUNTIME_PLATFORMS,
      }) as unknown as MiniProgramSdkModule,
  });

  await runtime.init({
    ...DEFAULT_INIT_FORM,
    appKey: 'demo#app',
  });

  return {
    runtime,
    fakeClient,
  };
};

describe('miniapp-demo/message-send integration', () => {
  it('覆盖 8 类消息发送主路径', async () => {
    const { runtime, fakeClient } = await createRuntime();
    const imageSelection = normalizeSelection({
      path: '/tmp/demo/image.png',
      size: 10,
      width: 80,
      height: 60,
    });
    const voiceSelection = normalizeSelection({
      path: '/tmp/demo/voice.amr',
      size: 9,
      duration: 5,
    });
    const videoSelection = normalizeSelection({
      path: '/tmp/demo/video.mp4',
      size: 11,
      duration: 8,
      width: 100,
      height: 80,
    });
    const fileSelection = normalizeSelection({
      path: '/tmp/demo/demo.pdf',
      size: 12,
    });

    const sentTypes = await Promise.all([
      runtime.sendMessage(client =>
        client.chatManager.createTextMessage(
          buildTextDraft({
            ...DEFAULT_DRAFT_STATE,
            targetId: 'target-1',
            textMessage: 'hello',
          })
        )
      ),
      runtime.sendMessage(client =>
        client.chatManager.createImageMessage(
          buildImageDraft({
            ...DEFAULT_DRAFT_STATE,
            targetId: 'target-1',
            imageSelection,
          })
        )
      ),
      runtime.sendMessage(client =>
        client.chatManager.createVoiceMessage(
          buildVoiceDraft({
            ...DEFAULT_DRAFT_STATE,
            targetId: 'target-1',
            voiceSelection,
          })
        )
      ),
      runtime.sendMessage(client =>
        client.chatManager.createVideoMessage(
          buildVideoDraft({
            ...DEFAULT_DRAFT_STATE,
            targetId: 'target-1',
            videoSelection,
          })
        )
      ),
      runtime.sendMessage(client =>
        client.chatManager.createFileMessage(
          buildFileDraft({
            ...DEFAULT_DRAFT_STATE,
            targetId: 'target-1',
            fileSelection,
          })
        )
      ),
      runtime.sendMessage(client =>
        client.chatManager.createLocationMessage(
          buildLocationDraft({
            ...DEFAULT_DRAFT_STATE,
            targetId: 'target-1',
            locationLatitude: '31.23',
            locationLongitude: '121.47',
          })
        )
      ),
      runtime.sendMessage(client =>
        client.chatManager.createCmdMessage(
          buildCmdDraft({
            ...DEFAULT_DRAFT_STATE,
            targetId: 'target-1',
            cmdAction: 'sync',
          })
        )
      ),
      runtime.sendMessage(client =>
        client.chatManager.createCustomMessage(
          buildCustomDraft({
            ...DEFAULT_DRAFT_STATE,
            targetId: 'target-1',
            customEvent: 'order_changed',
            customParamsJson: '{"bizId":"10001"}',
          })
        )
      ),
    ]);

    expect(sentTypes.map(item => item.type)).toEqual([
      'text',
      'image',
      'voice',
      'video',
      'file',
      'location',
      'cmd',
      'custom',
    ]);
    expect(fakeClient.createTextMessageMock).toHaveBeenCalledTimes(1);
    expect(fakeClient.createImageMessageMock).toHaveBeenCalledTimes(1);
    expect(fakeClient.createVoiceMessageMock).toHaveBeenCalledTimes(1);
    expect(fakeClient.createVideoMessageMock).toHaveBeenCalledTimes(1);
    expect(fakeClient.createFileMessageMock).toHaveBeenCalledTimes(1);
    expect(fakeClient.createLocationMessageMock).toHaveBeenCalledTimes(1);
    expect(fakeClient.createCmdMessageMock).toHaveBeenCalledTimes(1);
    expect(fakeClient.createCustomMessageMock).toHaveBeenCalledTimes(1);
    expect(fakeClient.sendMessageMock).toHaveBeenCalledTimes(8);
  });
});
