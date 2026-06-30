import { describe, expect, it } from 'vitest';

import {
  buildCmdDraft,
  buildCustomDraft,
  buildImageDraft,
  buildLocationDraft,
  buildTextDraft,
  buildVoiceDraft,
  DEFAULT_DRAFT_STATE,
  normalizeSelection,
  toMiniAppFile,
} from '../../../miniprogram-demo/utils/message-drafts';

describe('miniapp-demo/message-drafts', () => {
  it('提供稳定的默认草稿值', () => {
    expect(DEFAULT_DRAFT_STATE.channelType).toBe('single');
    expect(DEFAULT_DRAFT_STATE.targetId).toBe('');
    expect(DEFAULT_DRAFT_STATE.imageSelection).toBeNull();
  });

  it('文本消息会校验目标和内容', () => {
    const draft = buildTextDraft({
      ...DEFAULT_DRAFT_STATE,
      targetId: ' user-1 ',
      textMessage: ' hello ',
    });

    expect(draft.conversationId).toBe('user-1');
    expect(draft.conversationType).toBe('singleChat');
    expect(draft.content).toBe('hello');
  });

  it('附件选择结果会推断名称和类型', () => {
    const selection = normalizeSelection({
      path: '/tmp/demo/sample.jpg',
      size: 128,
    });

    expect(selection.name).toBe('sample.jpg');
    expect(selection.type).toBe('image/jpeg');
    expect(toMiniAppFile(selection)).toEqual({
      path: '/tmp/demo/sample.jpg',
      name: 'sample.jpg',
      type: 'image/jpeg',
      size: 128,
    });
  });

  it('图片与语音草稿会转换为 MiniAppFile', () => {
    const imageSelection = normalizeSelection({
      path: '/tmp/demo/pic.png',
      size: 100,
      width: 80,
      height: 60,
    });
    const voiceSelection = normalizeSelection({
      path: '/tmp/demo/voice.amr',
      size: 90,
      duration: 6,
    });

    const imageDraft = buildImageDraft({
      ...DEFAULT_DRAFT_STATE,
      targetId: 'group-1',
      channelType: 'group',
      imageSelection,
      imageSendOriginal: true,
    });
    const voiceDraft = buildVoiceDraft({
      ...DEFAULT_DRAFT_STATE,
      targetId: 'room-1',
      channelType: 'room',
      voiceSelection,
    });

    expect(imageDraft.conversationType).toBe('groupChat');
    expect((imageDraft.data as { path: string }).path).toBe('/tmp/demo/pic.png');
    expect(imageDraft.isOriginalImage).toBe(true);
    expect(voiceDraft.conversationType).toBe('chatRoom');
    expect(voiceDraft.duration).toBe(6);
  });

  it('位置、命令和自定义消息会按创建入参收敛草稿', () => {
    const locationDraft = buildLocationDraft({
      ...DEFAULT_DRAFT_STATE,
      targetId: 'user-2',
      locationLatitude: '31.23',
      locationLongitude: '121.47',
      locationAddress: 'Shanghai',
      locationBuildingName: 'Tower',
    });
    const cmdDraft = buildCmdDraft({
      ...DEFAULT_DRAFT_STATE,
      targetId: 'user-3',
      cmdAction: 'sync',
    });
    const customDraft = buildCustomDraft({
      ...DEFAULT_DRAFT_STATE,
      targetId: 'user-4',
      customEvent: 'order_changed',
      customParamsJson: '{"orderId":10001}',
    });

    expect(locationDraft.latitude).toBe(31.23);
    expect(locationDraft.longitude).toBe(121.47);
    expect(cmdDraft.action).toBe('sync');
    expect('params' in cmdDraft).toBe(false);
    expect(customDraft.params).toEqual({
      orderId: '10001',
    });
  });
});
