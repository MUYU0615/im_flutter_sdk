import { useState } from 'react';
import type { ChangeEvent } from 'react';
import type {
  ConversationIdentifier,
  PushConversationType,
  PushRemindTypeWithoutDefault,
  PushSilentModeRuleInput,
} from 'im-sdk-web';
import type { DemoClient, LogType } from '../types';
import { formatError, safeJsonStringify, withTimeout } from '../utils';

export interface PushPanelProps {
  readonly client: DemoClient | null;
  readonly onAddLog: (type: LogType, message: string) => void;
  readonly defaultConversationId?: string;
}

const API_TIMEOUT = 15000;
const RULE_MODES = ['REMIND_TYPE', 'DURATION', 'INTERVAL'] as const;
type RuleMode = (typeof RULE_MODES)[number];
const PUSH_REMIND_TYPES: ReadonlyArray<PushRemindTypeWithoutDefault> = ['ALL', 'AT', 'NONE'];
const PUSH_CONVERSATION_TYPES: ReadonlyArray<PushConversationType> = ['singleChat', 'groupChat'];

const parsePositiveInteger = (value: string): number | null => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

const parseRangeInteger = (value: string, min: number, max: number): number | null => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return null;
  }
  return parsed;
};

const parseConversationType = (value: string): PushConversationType | null => {
  if (PUSH_CONVERSATION_TYPES.includes(value as PushConversationType)) {
    return value as PushConversationType;
  }
  return null;
};

const formatResponseText = (label: string, response: unknown): string => {
  try {
    return `${label}\n${JSON.stringify(response, null, 2)}`;
  } catch {
    return `${label}\n${safeJsonStringify(response)}`;
  }
};

export const PushPanel = (props: PushPanelProps): JSX.Element => {
  const { client, onAddLog, defaultConversationId } = props;
  const [deviceId, setDeviceId] = useState('demo-device-id');
  const [deviceToken, setDeviceToken] = useState('demo-device-token');
  const [notifierName, setNotifierName] = useState('FCM');

  const [globalRuleMode, setGlobalRuleMode] = useState<RuleMode>('REMIND_TYPE');
  const [globalRemindType, setGlobalRemindType] = useState<PushRemindTypeWithoutDefault>('ALL');
  const [globalDuration, setGlobalDuration] = useState('3600');
  const [globalStartHours, setGlobalStartHours] = useState('22');
  const [globalStartMinutes, setGlobalStartMinutes] = useState('0');
  const [globalEndHours, setGlobalEndHours] = useState('8');
  const [globalEndMinutes, setGlobalEndMinutes] = useState('0');

  const [conversationId, setConversationId] = useState(defaultConversationId ?? '');
  const [conversationType, setConversationType] = useState<PushConversationType>('singleChat');
  const [conversationRuleMode, setConversationRuleMode] = useState<RuleMode>('REMIND_TYPE');
  const [conversationRemindType, setConversationRemindType] =
    useState<PushRemindTypeWithoutDefault>('AT');
  const [conversationDuration, setConversationDuration] = useState('1800');
  const [conversationStartHours, setConversationStartHours] = useState('23');
  const [conversationStartMinutes, setConversationStartMinutes] = useState('0');
  const [conversationEndHours, setConversationEndHours] = useState('7');
  const [conversationEndMinutes, setConversationEndMinutes] = useState('30');

  const [conversationListInput, setConversationListInput] = useState(
    defaultConversationId ? `${defaultConversationId}:singleChat` : ''
  );
  const [pushLanguage, setPushLanguage] = useState('zh-Hans');
  const [pageSizeInput, setPageSizeInput] = useState('20');
  const [cursorInput, setCursorInput] = useState('');

  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<string>('暂无返回数据');

  const isBusy = pendingAction !== null;

  const ensureClientReady = (): DemoClient | null => {
    if (!client) {
      onAddLog('warn', '请先初始化 SDK');
      return null;
    }

    if (client.getConnectionState() !== 'connected') {
      onAddLog('warn', `请先登录（当前状态: ${client.getConnectionState()}）`);
      return null;
    }

    return client;
  };

  const buildRule = (
    mode: RuleMode,
    remindType: PushRemindTypeWithoutDefault,
    duration: string,
    startHours: string,
    startMinutes: string,
    endHours: string,
    endMinutes: string,
    label: string
  ): PushSilentModeRuleInput | null => {
    if (mode === 'REMIND_TYPE') {
      return {
        mode: 'REMIND_TYPE',
        remindType,
      };
    }

    if (mode === 'DURATION') {
      const durationValue = parsePositiveInteger(duration);
      if (durationValue === null) {
        onAddLog('warn', `${label}时长需要是正整数`);
        return null;
      }
      return {
        mode: 'DURATION',
        duration: durationValue,
      };
    }

    const startHoursValue = parseRangeInteger(startHours, 0, 23);
    const startMinutesValue = parseRangeInteger(startMinutes, 0, 59);
    const endHoursValue = parseRangeInteger(endHours, 0, 23);
    const endMinutesValue = parseRangeInteger(endMinutes, 0, 59);

    if (
      startHoursValue === null ||
      startMinutesValue === null ||
      endHoursValue === null ||
      endMinutesValue === null
    ) {
      onAddLog('warn', `${label}时间区间必须在合法范围（小时 0-23，分钟 0-59）`);
      return null;
    }

    return {
      mode: 'INTERVAL',
      startTime: {
        hours: startHoursValue,
        minutes: startMinutesValue,
      },
      endTime: {
        hours: endHoursValue,
        minutes: endMinutesValue,
      },
    };
  };

  const parseConversationList = (input: string): ReadonlyArray<ConversationIdentifier> | null => {
    const segments = input
      .split(/[,，\n]/)
      .map((item: string): string => item.trim())
      .filter((item: string): boolean => item.length > 0);

    if (segments.length === 0) {
      onAddLog('warn', '请输入批量查询会话，格式示例: user01:singleChat');
      return null;
    }

    const parsedList: ConversationIdentifier[] = [];
    for (const segment of segments) {
      const [idPart, typePart] = segment.split(':');
      const id = (idPart ?? '').trim();
      const typeValue = (typePart ?? 'singleChat').trim();
      const type = parseConversationType(typeValue);

      if (!id) {
        onAddLog('warn', `批量会话项格式错误（缺少 id）: ${segment}`);
        return null;
      }
      if (!type) {
        onAddLog('warn', `批量会话项类型仅支持 singleChat/groupChat: ${segment}`);
        return null;
      }

      parsedList.push({
        conversationId: id,
        conversationType: type,
      });
    }

    return parsedList;
  };

  const runAction = async <T,>(
    label: string,
    operation: () => Promise<T>,
    onSuccess?: (response: T) => void
  ): Promise<void> => {
    if (isBusy) {
      return;
    }

    setPendingAction(label);
    try {
      const response = await withTimeout(operation(), API_TIMEOUT, label);
      onAddLog('success', `${label}成功`);
      if (response === undefined) {
        console.log(`[PushManager] ${label} 成功（无返回数据）`);
        setLastResponse(formatResponseText(label, { message: '无返回数据' }));
        onAddLog('info', `${label}返回: 无返回数据`);
      } else {
        console.log(`[PushManager] ${label} 返回`, response);
        setLastResponse(formatResponseText(label, response));
        onAddLog('info', `${label}返回: ${safeJsonStringify(response)}`);
      }
      onSuccess?.(response);
    } catch (error) {
      console.error(`[PushManager] ${label} 失败`, error);
      onAddLog('error', `${label}失败: ${formatError(error)}`);
    } finally {
      setPendingAction(null);
    }
  };

  const handleInputChange =
    (setter: (value: string) => void) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>): void => {
      setter(event.target.value);
    };

  const toClickHandler = (handler: () => Promise<void>): (() => void) => {
    return (): void => {
      void handler();
    };
  };

  const handleUploadPushToken = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const trimmedDeviceId = deviceId.trim();
    const trimmedDeviceToken = deviceToken.trim();
    const trimmedNotifierName = notifierName.trim();

    if (!trimmedDeviceId || !trimmedDeviceToken || !trimmedNotifierName) {
      onAddLog('warn', '上传 Push Token 需要填写 deviceId/deviceToken/notifierName');
      return;
    }

    await runAction('上传 Push Token', () =>
      readyClient.pushManager.uploadPushToken({
        deviceId: trimmedDeviceId,
        deviceToken: trimmedDeviceToken,
        notifierName: trimmedNotifierName,
      })
    );
  };

  const handleSetGlobalSilentMode = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const rule = buildRule(
      globalRuleMode,
      globalRemindType,
      globalDuration,
      globalStartHours,
      globalStartMinutes,
      globalEndHours,
      globalEndMinutes,
      '全局免打扰'
    );

    if (!rule) {
      return;
    }

    await runAction('设置全局免打扰', () =>
      readyClient.pushManager.setGlobalSilentMode({
        rule,
      })
    );
  };

  const handleGetGlobalSilentMode = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    await runAction('查询全局免打扰', () => readyClient.pushManager.getGlobalSilentMode());
  };

  const handleSetConversationSilentMode = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const trimmedConversationId = conversationId.trim();
    if (!trimmedConversationId) {
      onAddLog('warn', '请填写会话 ID');
      return;
    }

    const rule = buildRule(
      conversationRuleMode,
      conversationRemindType,
      conversationDuration,
      conversationStartHours,
      conversationStartMinutes,
      conversationEndHours,
      conversationEndMinutes,
      '会话免打扰'
    );

    if (!rule) {
      return;
    }

    await runAction('设置会话免打扰', () =>
      readyClient.pushManager.setConversationSilentMode({
        conversationId: trimmedConversationId,
        conversationType,
        rule,
      })
    );
  };

  const handleGetConversationSilentMode = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const trimmedConversationId = conversationId.trim();
    if (!trimmedConversationId) {
      onAddLog('warn', '请填写会话 ID');
      return;
    }

    await runAction('查询会话免打扰', () =>
      readyClient.pushManager.getConversationSilentMode({
        conversationId: trimmedConversationId,
        conversationType,
      })
    );
  };

  const handleClearConversationRemindType = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const trimmedConversationId = conversationId.trim();
    if (!trimmedConversationId) {
      onAddLog('warn', '请填写会话 ID');
      return;
    }

    await runAction('清除会话提醒类型', () =>
      readyClient.pushManager.clearConversationRemindType({
        conversationId: trimmedConversationId,
        conversationType,
      })
    );
  };

  const handleGetConversationSilentModes = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const conversationList = parseConversationList(conversationListInput);
    if (!conversationList) {
      return;
    }

    await runAction('批量查询会话免打扰', () =>
      readyClient.pushManager.getConversationSilentModes({
        conversationList,
      })
    );
  };

  const handleSetPushLanguage = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const trimmedLanguage = pushLanguage.trim();
    if (!trimmedLanguage) {
      onAddLog('warn', '请填写推送语言');
      return;
    }

    await runAction('设置推送语言', () =>
      readyClient.pushManager.setPushLanguage({
        language: trimmedLanguage,
      })
    );
  };

  const handleGetPushLanguage = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    await runAction('查询推送语言', () => readyClient.pushManager.getPushLanguage());
  };

  const handleGetConversationListByRemindType = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const pageSize = parsePositiveInteger(pageSizeInput);
    if (pageSize === null) {
      onAddLog('warn', '分页大小必须是正整数');
      return;
    }

    const cursor = cursorInput.trim();
    await runAction(
      '分页查询免打扰会话',
      () =>
        readyClient.pushManager.getConversationListByRemindType({
          pageSize,
          cursor: cursor.length > 0 ? cursor : undefined,
        }),
      (response): void => {
        if (typeof response.cursor === 'string') {
          setCursorInput(response.cursor);
        }
      }
    );
  };

  const renderRuleFields = (
    mode: RuleMode,
    remindType: PushRemindTypeWithoutDefault,
    onModeChange: (event: ChangeEvent<HTMLSelectElement>) => void,
    onRemindTypeChange: (event: ChangeEvent<HTMLSelectElement>) => void,
    duration: string,
    onDurationChange: (event: ChangeEvent<HTMLInputElement>) => void,
    startHours: string,
    startMinutes: string,
    endHours: string,
    endMinutes: string,
    onStartHoursChange: (event: ChangeEvent<HTMLInputElement>) => void,
    onStartMinutesChange: (event: ChangeEvent<HTMLInputElement>) => void,
    onEndHoursChange: (event: ChangeEvent<HTMLInputElement>) => void,
    onEndMinutesChange: (event: ChangeEvent<HTMLInputElement>) => void
  ): JSX.Element => {
    return (
      <>
        <div className="form-row">
          <div className="form-group">
            <label>规则模式</label>
            <select value={mode} onChange={onModeChange}>
              {RULE_MODES.map((item: RuleMode) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          {mode === 'REMIND_TYPE' ? (
            <div className="form-group">
              <label>提醒类型</label>
              <select value={remindType} onChange={onRemindTypeChange}>
                {PUSH_REMIND_TYPES.map((item: PushRemindTypeWithoutDefault) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {mode === 'DURATION' ? (
            <div className="form-group">
              <label>静默时长（秒）</label>
              <input value={duration} onChange={onDurationChange} placeholder="例如 3600" />
            </div>
          ) : null}
        </div>
        {mode === 'INTERVAL' ? (
          <div className="form-row">
            <div className="form-group">
              <label>开始小时</label>
              <input value={startHours} onChange={onStartHoursChange} placeholder="0-23" />
            </div>
            <div className="form-group">
              <label>开始分钟</label>
              <input value={startMinutes} onChange={onStartMinutesChange} placeholder="0-59" />
            </div>
            <div className="form-group">
              <label>结束小时</label>
              <input value={endHours} onChange={onEndHoursChange} placeholder="0-23" />
            </div>
            <div className="form-group">
              <label>结束分钟</label>
              <input value={endMinutes} onChange={onEndMinutesChange} placeholder="0-59" />
            </div>
          </div>
        ) : null}
      </>
    );
  };

  return (
    <div className="card">
      <h2 className="card-title">PushManager 调试面板</h2>
      <div className="push-grid">
        <section className="push-section">
          <h3>1. 上传 Push Token</h3>
          <div className="form-group">
            <label>deviceId</label>
            <input value={deviceId} onChange={handleInputChange(setDeviceId)} />
          </div>
          <div className="form-group">
            <label>deviceToken</label>
            <input value={deviceToken} onChange={handleInputChange(setDeviceToken)} />
          </div>
          <div className="form-group">
            <label>notifierName</label>
            <input value={notifierName} onChange={handleInputChange(setNotifierName)} />
          </div>
          <button
            className="btn btn-primary"
            disabled={isBusy}
            onClick={toClickHandler(handleUploadPushToken)}
          >
            {pendingAction === '上传 Push Token' ? '请求中...' : 'uploadPushToken'}
          </button>
        </section>

        <section className="push-section">
          <h3>2. 全局免打扰</h3>
          {renderRuleFields(
            globalRuleMode,
            globalRemindType,
            (event: ChangeEvent<HTMLSelectElement>): void => {
              setGlobalRuleMode(event.target.value as RuleMode);
            },
            (event: ChangeEvent<HTMLSelectElement>): void => {
              setGlobalRemindType(event.target.value as PushRemindTypeWithoutDefault);
            },
            globalDuration,
            handleInputChange(setGlobalDuration),
            globalStartHours,
            globalStartMinutes,
            globalEndHours,
            globalEndMinutes,
            handleInputChange(setGlobalStartHours),
            handleInputChange(setGlobalStartMinutes),
            handleInputChange(setGlobalEndHours),
            handleInputChange(setGlobalEndMinutes)
          )}
          <div>
            <button
              className="btn btn-primary"
              disabled={isBusy}
              onClick={toClickHandler(handleSetGlobalSilentMode)}
            >
              {pendingAction === '设置全局免打扰' ? '请求中...' : 'setGlobalSilentMode'}
            </button>
            <button
              className="btn btn-success"
              disabled={isBusy}
              onClick={toClickHandler(handleGetGlobalSilentMode)}
            >
              {pendingAction === '查询全局免打扰' ? '请求中...' : 'getGlobalSilentMode'}
            </button>
          </div>
        </section>

        <section className="push-section">
          <h3>3. 会话免打扰</h3>
          <div className="form-row">
            <div className="form-group">
              <label>会话 ID</label>
              <input
                value={conversationId}
                onChange={handleInputChange(setConversationId)}
                placeholder="singleChat/groupChat 会话 ID"
              />
            </div>
            <div className="form-group">
              <label>会话类型</label>
              <select
                value={conversationType}
                onChange={(event: ChangeEvent<HTMLSelectElement>): void => {
                  setConversationType(event.target.value as PushConversationType);
                }}
              >
                {PUSH_CONVERSATION_TYPES.map((item: PushConversationType) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {renderRuleFields(
            conversationRuleMode,
            conversationRemindType,
            (event: ChangeEvent<HTMLSelectElement>): void => {
              setConversationRuleMode(event.target.value as RuleMode);
            },
            (event: ChangeEvent<HTMLSelectElement>): void => {
              setConversationRemindType(event.target.value as PushRemindTypeWithoutDefault);
            },
            conversationDuration,
            handleInputChange(setConversationDuration),
            conversationStartHours,
            conversationStartMinutes,
            conversationEndHours,
            conversationEndMinutes,
            handleInputChange(setConversationStartHours),
            handleInputChange(setConversationStartMinutes),
            handleInputChange(setConversationEndHours),
            handleInputChange(setConversationEndMinutes)
          )}
          <div>
            <button
              className="btn btn-primary"
              disabled={isBusy}
              onClick={toClickHandler(handleSetConversationSilentMode)}
            >
              {pendingAction === '设置会话免打扰' ? '请求中...' : 'setConversationSilentMode'}
            </button>
            <button
              className="btn btn-success"
              disabled={isBusy}
              onClick={toClickHandler(handleGetConversationSilentMode)}
            >
              {pendingAction === '查询会话免打扰' ? '请求中...' : 'getConversationSilentMode'}
            </button>
            <button
              className="btn btn-warning"
              disabled={isBusy}
              onClick={toClickHandler(handleClearConversationRemindType)}
            >
              {pendingAction === '清除会话提醒类型' ? '请求中...' : 'clearConversationRemindType'}
            </button>
          </div>
        </section>

        <section className="push-section">
          <h3>4. 批量会话免打扰查询</h3>
          <div className="form-group">
            <label>conversationList</label>
            <textarea
              value={conversationListInput}
              onChange={handleInputChange(setConversationListInput)}
              rows={4}
              placeholder={'一行一个，格式: 会话ID:会话类型\n例如: user01:singleChat'}
            />
          </div>
          <div className="push-note">
            支持逗号、中文逗号或换行分隔，类型仅支持 singleChat/groupChat。
          </div>
          <button
            className="btn btn-primary"
            disabled={isBusy}
            onClick={toClickHandler(handleGetConversationSilentModes)}
          >
            {pendingAction === '批量查询会话免打扰' ? '请求中...' : 'getConversationSilentModes'}
          </button>
        </section>

        <section className="push-section">
          <h3>5. 推送语言</h3>
          <div className="form-group">
            <label>language</label>
            <input
              value={pushLanguage}
              onChange={handleInputChange(setPushLanguage)}
              placeholder="例如 zh-Hans / en"
            />
          </div>
          <div>
            <button
              className="btn btn-primary"
              disabled={isBusy}
              onClick={toClickHandler(handleSetPushLanguage)}
            >
              {pendingAction === '设置推送语言' ? '请求中...' : 'setPushLanguage'}
            </button>
            <button
              className="btn btn-success"
              disabled={isBusy}
              onClick={toClickHandler(handleGetPushLanguage)}
            >
              {pendingAction === '查询推送语言' ? '请求中...' : 'getPushLanguage'}
            </button>
          </div>
        </section>

        <section className="push-section">
          <h3>6. 分页查询免打扰会话</h3>
          <p className="push-note">
            当前查询基于本地 session-list 缓存分页过滤，不再请求旧的会话查询 REST。
          </p>
          <div className="form-row">
            <div className="form-group">
              <label>pageSize</label>
              <input value={pageSizeInput} onChange={handleInputChange(setPageSizeInput)} />
            </div>
            <div className="form-group">
              <label>cursor（可选）</label>
              <input
                value={cursorInput}
                onChange={handleInputChange(setCursorInput)}
                placeholder="为空表示第一页"
              />
            </div>
          </div>
          <button
            className="btn btn-primary"
            disabled={isBusy}
            onClick={toClickHandler(handleGetConversationListByRemindType)}
          >
            {pendingAction === '分页查询免打扰会话'
              ? '请求中...'
              : 'getConversationListByRemindType'}
          </button>
        </section>
      </div>

      <div className="presence-result push-result">
        <div className="presence-result-label">最近一次 Push API 返回</div>
        <pre>{lastResponse}</pre>
      </div>
    </div>
  );
};
