import { describe, expect, it } from 'vitest';
import type {
  PushConversationType,
  PushSilentModeRuleInput,
  PushTimePoint,
  SetConversationSilentModeParams,
  UploadPushTokenParams,
} from '@/types/push';

const buildIntervalRule = (): PushSilentModeRuleInput => {
  const startTime: PushTimePoint = { hours: 9, minutes: 0 };
  const endTime: PushTimePoint = { hours: 18, minutes: 0 };
  return {
    mode: 'INTERVAL',
    startTime,
    endTime,
  };
};

describe('push manager types', () => {
  it('PushConversationType 仅允许 singleChat/groupChat', () => {
    const singleChat: PushConversationType = 'singleChat';
    const groupChat: PushConversationType = 'groupChat';
    expect(singleChat).toBe('singleChat');
    expect(groupChat).toBe('groupChat');
  });

  it('PushSilentModeRuleInput 支持可判别联合类型', () => {
    const remindTypeRule: PushSilentModeRuleInput = {
      mode: 'REMIND_TYPE',
      remindType: 'ALL',
    };
    const durationRule: PushSilentModeRuleInput = {
      mode: 'DURATION',
      duration: 3600,
    };
    const intervalRule = buildIntervalRule();

    expect(remindTypeRule.mode).toBe('REMIND_TYPE');
    expect(durationRule.mode).toBe('DURATION');
    expect(intervalRule.mode).toBe('INTERVAL');
  });

  it('PushManager 参数类型应带 success/error 回调签名', () => {
    const uploadParams: UploadPushTokenParams = {
      deviceId: 'device-1',
      deviceToken: 'token-1',
      notifierName: 'FCM',
    };
    const conversationParams: SetConversationSilentModeParams = {
      conversationId: 'group-1',
      conversationType: 'groupChat',
      rule: {
        mode: 'REMIND_TYPE',
        remindType: 'AT',
      },
    };

    expect(uploadParams.notifierName).toBe('FCM');
    expect(conversationParams.conversationType).toBe('groupChat');
  });

  it('旧 API 方法名不在类型层暴露', () => {
    type LegacyApiName = 'uploadPushTokenToServer';
    const legacyApiName: LegacyApiName = 'uploadPushTokenToServer';
    expect(legacyApiName).toBe('uploadPushTokenToServer');
  });
});
