import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatClient } from '@/chat-client';
import { PushManager } from '@/managers/push-manager';
import { RestClient } from '@/rest/client';
import type { RestContext } from '@/types/chat-client';
import type { ConversationItem } from '@/types/conversation';
import type { PushConversationType, PushSilentModeRuleInput } from '@/types/push';
import { ERROR_CODES } from '@/utils/error-codes';
import { RestBusinessError, RestTransportError, SDKError, ValidationError } from '@/utils/errors';

const DEFAULT_REST_CONTEXT: RestContext = {
  restBaseUrl: 'https://api.example.com',
  appKey: 'org#app',
  userId: 'alice',
  token: 'token',
  clientResource: 'web',
};

const createMockClient = (context: RestContext = DEFAULT_REST_CONTEXT): ChatClient => {
  return {
    getRestContext: (): RestContext => context,
    getCacheManager: () => ({
      loadSessionList: (): ReadonlyArray<ConversationItem> => [],
    }),
  } as unknown as ChatClient;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const createBusinessErrorResponse = (payload: Record<string, unknown>): Response => {
  return {
    ok: false,
    status: 400,
    statusText: 'Bad Request',
    json: vi.fn().mockResolvedValue(payload),
    text: vi.fn().mockResolvedValue(''),
    headers: new Headers({ 'content-type': 'application/json' }),
  } as unknown as Response;
};

describe('PushManager', () => {
  let manager: PushManager;

  beforeEach((): void => {
    manager = new PushManager();
    manager.bind(createMockClient());
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('uploadPushToken 参数非法时应 fail-fast 且不触发请求', async () => {
    const requestSpy = vi.spyOn(RestClient.prototype, 'request');

    await expect(
      manager.uploadPushToken({
        deviceId: '',
        deviceToken: 'token-1',
        notifierName: 'FCM',
      })
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      manager.uploadPushToken({
        deviceId: '',
        deviceToken: 'token-1',
        notifierName: 'FCM',
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
    });
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it('uploadPushToken 成功后不返回数据且重复上传仍走覆盖请求', async () => {
    const requestSpy = vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({});

    const first = await manager.uploadPushToken({
      deviceId: 'device-1',
      deviceToken: 'token-a',
      notifierName: 'FCM',
    });
    const second = await manager.uploadPushToken({
      deviceId: 'device-1',
      deviceToken: 'token-b',
      notifierName: 'FCM',
    });

    expect(first).toBeUndefined();
    expect(second).toBeUndefined();
    expect(requestSpy).toHaveBeenCalledTimes(2);

    const secondConfig = requestSpy.mock.calls[1]?.[1];
    if (!secondConfig || !isRecord(secondConfig) || !isRecord(secondConfig.body)) {
      throw new Error('Expected second request config to contain body');
    }
    expect(secondConfig.body.device_token).toBe('token-b');
  });

  it('应支持设置全局时间区间免打扰', async () => {
    const requestSpy = vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      ignoreInterval: '09:00-18:00',
    });

    const result = await manager.setGlobalSilentMode({
      rule: {
        mode: 'INTERVAL',
        startTime: { hours: 9, minutes: 0 },
        endTime: { hours: 18, minutes: 0 },
      },
    });

    expect(result.scope).toBe('global');
    expect(result.rule.silentModeStartTime).toEqual({ hours: 9, minutes: 0 });
    expect(result.rule.silentModeEndTime).toEqual({ hours: 18, minutes: 0 });
    const requestConfig = requestSpy.mock.calls[0]?.[1];
    if (!requestConfig || !isRecord(requestConfig) || !isRecord(requestConfig.body)) {
      throw new Error('Expected request config to contain body');
    }
    expect(requestConfig.body.ignoreInterval).toBe('09:00-18:00');
  });

  it('设置会话时间区间免打扰时应按 HH:MM 格式发送', async () => {
    const requestSpy = vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({});

    await manager.setConversationSilentMode({
      conversationId: 'user-1',
      conversationType: 'singleChat',
      rule: {
        mode: 'INTERVAL',
        startTime: { hours: 8, minutes: 0 },
        endTime: { hours: 10, minutes: 30 },
      },
    });

    const requestConfig = requestSpy.mock.calls[0]?.[1];
    if (!requestConfig || !isRecord(requestConfig) || !isRecord(requestConfig.body)) {
      throw new Error('Expected request config to contain body');
    }
    expect(requestConfig.body.ignoreInterval).toBe('08:00-10:30');
  });

  it('设置时间区间免打扰缺少时间点时应返回 ValidationError', async () => {
    const requestSpy = vi.spyOn(RestClient.prototype, 'request');

    await expect(
      manager.setGlobalSilentMode({
        rule: {
          mode: 'INTERVAL',
          endTime: { hours: 18, minutes: 0 },
        } as unknown as PushSilentModeRuleInput,
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
      details: {
        fields: [
          {
            path: 'rule.startTime',
            rule: 'invalid_format',
          },
        ],
      },
    });

    await expect(
      manager.setConversationSilentMode({
        conversationId: 'user-1',
        conversationType: 'singleChat',
        rule: {
          mode: 'INTERVAL',
          startTime: { hours: 8, minutes: 0 },
          endTime: null,
        } as unknown as PushSilentModeRuleInput,
      })
    ).rejects.toBeInstanceOf(ValidationError);

    expect(requestSpy).not.toHaveBeenCalled();
  });

  it('设置会话免打扰应兼容 data 包裹层并返回 remindType 与 expireTimestamp', async () => {
    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      data: {
        type: 'AT',
        ignoreDuration: 1772533899989,
      },
    });

    const result = await manager.setConversationSilentMode({
      conversationId: '3aec5a7dd0',
      conversationType: 'singleChat',
      rule: {
        mode: 'DURATION',
        duration: 120,
      },
    });

    expect(result.conversationId).toBe('3aec5a7dd0');
    expect(result.conversationType).toBe('singleChat');
    expect(result.rule.remindType).toBe('AT');
    expect(result.rule.expireTimestamp).toBe(1772533899989);
  });

  it('应支持读取全局提醒类型免打扰', async () => {
    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      type: 'AT',
    });

    const result = await manager.getGlobalSilentMode();

    expect(result.rule.remindType).toBe('AT');
  });

  it('查询全局免打扰应兼容 data 包裹层的 expireTimestamp 结构', async () => {
    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      data: {
        type: 'DEFAULT',
        ignoreDuration: 1772525304009,
      },
    });

    const result = await manager.getGlobalSilentMode();

    expect(result.scope).toBe('global');
    expect(result.rule.expireTimestamp).toBe(1772525304009);
  });

  it('查询全局免打扰在 type 与 ignoreDuration 同时存在时应优先返回 duration', async () => {
    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      data: {
        type: 'ALL',
        ignoreDuration: 1772521704009,
      },
    });

    const result = await manager.getGlobalSilentMode();

    expect(result.rule.remindType).toBe('ALL');
    expect(result.rule.expireTimestamp).toBe(1772521704009);
  });

  it('会话类型为 chatRoom 时应返回 INVALID_PARAM(110)', async () => {
    const requestSpy = vi.spyOn(RestClient.prototype, 'request');

    await expect(
      manager.setConversationSilentMode({
        conversationId: 'room-1',
        conversationType: 'chatRoom' as unknown as PushConversationType,
        rule: {
          mode: 'REMIND_TYPE',
          remindType: 'ALL',
        },
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
    });

    expect(requestSpy).not.toHaveBeenCalled();
  });

  it('设置 remindType 为 DEFAULT 时应返回参数错误', async () => {
    const requestSpy = vi.spyOn(RestClient.prototype, 'request');

    await expect(
      manager.setGlobalSilentMode({
        rule: {
          mode: 'REMIND_TYPE',
          remindType: 'DEFAULT',
        } as unknown as PushSilentModeRuleInput,
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
    });

    expect(requestSpy).not.toHaveBeenCalled();
  });

  it('批量会话查询超过 20 条时应返回 INVALID_PARAM(110)', async () => {
    const requestSpy = vi.spyOn(RestClient.prototype, 'request');
    const conversationList = Array.from({ length: 21 }).map((_, index) => ({
      conversationId: `user-${index}`,
      conversationType: 'singleChat' as const,
    }));

    await expect(
      manager.getConversationSilentModes({
        conversationList,
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
    });

    expect(requestSpy).not.toHaveBeenCalled();
  });

  it('批量会话查询应按输入列表映射单聊与群聊结果', async () => {
    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      user: {
        'user-1': {
          type: 'ALL',
        },
      },
      group: {
        'group-1': {
          ignoreDuration: 600,
        },
      },
    });

    const result = await manager.getConversationSilentModes({
      conversationList: [
        { conversationId: 'group-1', conversationType: 'groupChat' },
        { conversationId: 'user-1', conversationType: 'singleChat' },
      ],
    });

    expect(result.conversations).toHaveLength(2);
    expect(result.conversations[0]?.conversationId).toBe('group-1');
    expect(result.conversations[0]?.conversationType).toBe('groupChat');
    expect(result.conversations[0]?.rule.expireTimestamp).toBe(600);
    expect(result.conversations[1]?.conversationId).toBe('user-1');
    expect(result.conversations[1]?.conversationType).toBe('singleChat');
    expect(result.conversations[1]?.rule.remindType).toBe('ALL');
  });

  it('批量会话查询应兼容 data.user/data.group 返回结构', async () => {
    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      data: {
        user: {
          '3aec5a7dd0': {
            type: 'AT',
            ignoreDuration: 1772519993210,
          },
          '61e1f0e2bd': {
            type: 'ALL',
          },
        },
        group: {},
      },
    });

    const result = await manager.getConversationSilentModes({
      conversationList: [
        { conversationId: '3aec5a7dd0', conversationType: 'singleChat' },
        { conversationId: '61e1f0e2bd', conversationType: 'singleChat' },
      ],
    });

    expect(result.conversations).toHaveLength(2);
    expect(result.conversations[0]?.conversationId).toBe('3aec5a7dd0');
    expect(result.conversations[0]?.rule.remindType).toBe('AT');
    expect(result.conversations[0]?.rule.expireTimestamp).toBe(1772519993210);
    expect(result.conversations[1]?.conversationId).toBe('61e1f0e2bd');
    expect(result.conversations[1]?.rule.remindType).toBe('ALL');
  });

  it('清除会话提醒类型应返回 DEFAULT 规则', async () => {
    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({});

    const result = await manager.clearConversationRemindType({
      conversationId: 'group-1',
      conversationType: 'groupChat',
    });

    expect(result.conversationId).toBe('group-1');
    expect(result.conversationType).toBe('groupChat');
    expect(result.rule.remindType).toBe('DEFAULT');
  });

  it('清除会话提醒类型在服务端只返回 duration 字段时应补齐 DEFAULT fallback', async () => {
    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      data: {
        ignoreDuration: 1772528904009,
      },
    });

    const result = await manager.clearConversationRemindType({
      conversationId: 'group-1',
      conversationType: 'groupChat',
    });

    expect(result).toEqual({
      conversationId: 'group-1',
      conversationType: 'groupChat',
      rule: {
        remindType: 'DEFAULT',
        expireTimestamp: 1772528904009,
      },
    });
  });

  it('查询会话免打扰应兼容 data 包裹层的 expireTimestamp 结构', async () => {
    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      data: {
        type: 'DEFAULT',
        ignoreDuration: 1772528904009,
      },
    });

    const result = await manager.getConversationSilentMode({
      conversationId: 'user-1',
      conversationType: 'singleChat',
    });

    expect(result.rule.remindType).toBe('DEFAULT');
    expect(result.rule.expireTimestamp).toBe(1772528904009);
  });

  it('应支持设置与读取推送翻译语言', async () => {
    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      translationLanguage: 'EN',
    });

    const setResult = await manager.setPushLanguage({
      language: 'EN',
    });
    const getResult = await manager.getPushLanguage();

    expect(setResult).toBeUndefined();
    expect(getResult.language).toBe('EN');
  });

  it('getPushLanguage 应兼容 data.language 返回结构', async () => {
    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      data: {
        language: 'zh-Hans',
      },
    });

    const result = await manager.getPushLanguage();

    expect(result.language).toBe('zh-Hans');
  });

  it('分页查询已设置免打扰会话应基于 session-list 缓存过滤 DEFAULT 并返回本地 cursor', async () => {
    manager.bind({
      ...createMockClient(),
      getCacheManager: () => ({
        loadSessionList: (): ReadonlyArray<ConversationItem> => [
          {
            conversationId: 'user-1',
            conversationType: 'singleChat',
            unreadCount: 0,
            lastMessage: null,
            marks: [],
            remindType: 'NONE',
            conversationName: 'user-1',
          },
          {
            conversationId: 'group-1',
            conversationType: 'groupChat',
            unreadCount: 0,
            lastMessage: null,
            marks: [],
            remindType: 'AT',
            conversationName: 'group-1',
          },
          {
            conversationId: 'group-2',
            conversationType: 'groupChat',
            unreadCount: 0,
            lastMessage: null,
            marks: [],
            remindType: 'DEFAULT',
            conversationName: 'group-2',
          },
        ],
      }),
    } as unknown as ChatClient);

    const result = await manager.getConversationListByRemindType({ pageSize: 1 });

    expect(result.cursor).toBe('1');
    expect(result.conversations).toHaveLength(1);
    expect(result.conversations[0]?.conversationType).toBe('singleChat');
  });

  it('请求失败时应抛出 SDKError', async () => {
    vi.spyOn(RestClient.prototype, 'request').mockRejectedValue(
      new RestTransportError('network error')
    );

    await expect(manager.getPushLanguage()).rejects.toBeInstanceOf(SDKError);
  });

  it('uploadPushToken 服务端业务错误应精确映射为 1500', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createBusinessErrorResponse({
        error: 'TOKEN_UPLOAD_FAILED',
        code: 1500,
        message: 'Push token 上传失败',
      })
    );

    const promise = manager.uploadPushToken({
      deviceId: 'device-1',
      deviceToken: 'token-1',
      notifierName: 'FCM',
    });

    await expect(promise).rejects.toBeInstanceOf(RestBusinessError);
    await expect(promise).rejects.toMatchObject({
      code: ERROR_CODES.PUSH_TOKEN_UPLOAD_FAILED,
      details: {
        api: 'uploadPushToken',
        serverCode: 1500,
        serverMessage: 'Push token 上传失败',
      },
    });
  });

  it('setGlobalSilentMode 服务端业务错误应精确映射为 1501', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createBusinessErrorResponse({
        error: 'SILENT_MODE_OPERATION_FAILED',
        code: 1501,
        message: '免打扰设置失败',
      })
    );

    const promise = manager.setGlobalSilentMode({
      rule: {
        mode: 'REMIND_TYPE',
        remindType: 'ALL',
      },
    });

    await expect(promise).rejects.toBeInstanceOf(RestBusinessError);
    await expect(promise).rejects.toMatchObject({
      code: ERROR_CODES.PUSH_SILENT_MODE_OPERATION_FAILED,
      details: {
        api: 'setGlobalSilentMode',
        serverCode: 1501,
        serverMessage: '免打扰设置失败',
      },
    });
  });

  it('setPushLanguage 服务端业务错误应精确映射为 1502', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createBusinessErrorResponse({
        error: 'PUSH_LANGUAGE_OPERATION_FAILED',
        code: 1502,
        message: '推送翻译语言设置失败',
      })
    );

    const promise = manager.setPushLanguage({
      language: 'EN',
    });

    await expect(promise).rejects.toBeInstanceOf(RestBusinessError);
    await expect(promise).rejects.toMatchObject({
      code: ERROR_CODES.PUSH_LANGUAGE_OPERATION_FAILED,
      details: {
        api: 'setPushLanguage',
        serverCode: 1502,
        serverMessage: '推送翻译语言设置失败',
      },
    });
  });

  it('旧 API 方法名不应作为 PushManager 能力暴露', () => {
    const legacy = manager as unknown as Record<string, unknown>;

    expect(typeof legacy.uploadPushTokenToServer).toBe('undefined');
    expect(typeof legacy.setSilentModeForAll).toBe('undefined');
    expect(typeof legacy.getSilentModeForConversations).toBe('undefined');
  });
});
