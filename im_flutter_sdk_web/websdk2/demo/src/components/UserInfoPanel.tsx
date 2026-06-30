import { useState } from 'react';
import type { ChangeEvent } from 'react';
import type { UserInfoAttribute } from 'im-sdk-web';
import type { DemoClient, LogType } from '../types';
import { formatError, parseUsernamesInput, safeJsonStringify, withTimeout } from '../utils';

export interface UserInfoPanelProps {
  readonly client: DemoClient | null;
  readonly onAddLog: (type: LogType, message: string) => void;
  readonly defaultTargetId?: string;
}

const API_TIMEOUT = 15000;
const USER_INFO_ATTRIBUTE_OPTIONS: ReadonlyArray<{
  readonly value: UserInfoAttribute;
  readonly label: string;
  readonly placeholder: string;
}> = [
  {
    value: 'nickname',
    label: 'nickname / 昵称',
    placeholder: '例如：测试昵称；留空字符串可清空',
  },
  {
    value: 'avatarUrl',
    label: 'avatarUrl / 头像地址',
    placeholder: '例如：https://example.com/avatar.png；留空字符串可清空',
  },
  {
    value: 'mail',
    label: 'mail / 邮箱',
    placeholder: '例如：demo@example.com；留空字符串可清空',
  },
  {
    value: 'phone',
    label: 'phone / 手机号',
    placeholder: '例如：13800000000；留空字符串可清空',
  },
  {
    value: 'gender',
    label: 'gender / 性别或自定义标识',
    placeholder: '例如：male、female、0、1、unknown',
  },
  {
    value: 'sign',
    label: 'sign / 签名',
    placeholder: '例如：hello websdk2；留空字符串可清空',
  },
  {
    value: 'birth',
    label: 'birth / 生日',
    placeholder: '例如：1990-01-01；留空字符串可清空',
  },
  {
    value: 'ext',
    label: 'ext / 扩展字段',
    placeholder: '例如：{\"role\":\"demo\"}；留空字符串可清空',
  },
] as const;

const formatResponseText = (label: string, response: unknown): string => {
  try {
    return `${label}\n${JSON.stringify(response, null, 2)}`;
  } catch {
    return `${label}\n${safeJsonStringify(response)}`;
  }
};

const buildVoidSuccessResponse = (
  label: string,
  userIds: ReadonlyArray<string>
): Record<string, unknown> => {
  return {
    ok: true,
    action: label,
    userIds,
    message: '无返回数据',
  };
};

export const UserInfoPanel = (props: UserInfoPanelProps): JSX.Element => {
  const { client, onAddLog, defaultTargetId } = props;
  const [fetchUserIdsInput, setFetchUserIdsInput] = useState(defaultTargetId ?? '');
  const [subscribeUserIdsInput, setSubscribeUserIdsInput] = useState(defaultTargetId ?? '');
  const [unsubscribeUserIdsInput, setUnsubscribeUserIdsInput] = useState(defaultTargetId ?? '');
  const [updateAttribute, setUpdateAttribute] = useState<UserInfoAttribute>('nickname');
  const [updateValue, setUpdateValue] = useState('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<string>('暂无返回数据');

  const isBusy = pendingAction !== null;

  const ensureClientReady = (): DemoClient | null => {
    if (!client) {
      onAddLog('warn', '请先初始化 SDK');
      return null;
    }

    const connectionState = client.getConnectionState();
    if (connectionState !== 'connected') {
      onAddLog('warn', `请先登录（当前状态: ${connectionState}）`);
      return null;
    }

    return client;
  };

  const logResponse = (label: string, response: unknown): void => {
    // eslint-disable-next-line no-console -- demo 需要把 UserInfoManager 返回值直接打印到浏览器控制台
    console.log(`[UserInfoManager] ${label} 返回`, response);
    setLastResponse(formatResponseText(label, response));
    onAddLog('info', `${label}返回: ${safeJsonStringify(response)}`);
  };

  const runAction = async <T,>(
    label: string,
    operation: () => Promise<T>,
    getVoidResponse?: () => unknown,
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
        logResponse(label, getVoidResponse?.() ?? buildVoidSuccessResponse(label, []));
      } else {
        logResponse(label, response);
      }
      onSuccess?.(response);
    } catch (error) {
      // eslint-disable-next-line no-console -- demo 需要在控制台查看失败详情
      console.error(`[UserInfoManager] ${label} 失败`, error);
      onAddLog('error', `${label}失败: ${formatError(error)}`);
    } finally {
      setPendingAction(null);
    }
  };

  const handleInputChange =
    (setter: (value: string) => void) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      setter(event.target.value);
    };

  const handleAttributeChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    setUpdateAttribute(event.target.value as UserInfoAttribute);
  };

  const toClickHandler = (handler: () => Promise<void> | void): (() => void) => {
    return (): void => {
      void handler();
    };
  };

  const parseRequiredUserIds = (input: string, label: string): ReadonlyArray<string> | null => {
    const userIds = parseUsernamesInput(input);
    if (userIds.length === 0) {
      onAddLog('warn', `${label}不能为空（支持逗号或换行分隔）`);
      return null;
    }
    return userIds;
  };

  const selectedAttributeOption =
    USER_INFO_ATTRIBUTE_OPTIONS.find(option => option.value === updateAttribute) ??
    USER_INFO_ATTRIBUTE_OPTIONS[0];

  const handleFetchUserInfoByUserId = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const userIds = parseRequiredUserIds(fetchUserIdsInput, '查询用户 ID');
    if (!userIds) {
      return;
    }

    await runAction(
      '按用户 ID 查询资料',
      () => readyClient.userInfoManager.getUserInfoByUserId({ userIds }),
      undefined,
      response => {
        onAddLog('success', `按用户 ID 查询资料成功，共 ${response.length} 条`);
      }
    );
  };

  const handleGetSubscribedUsers = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    await runAction(
      '查询订阅资料列表',
      () => readyClient.userInfoManager.getSubscribedUsers(),
      undefined,
      response => {
        onAddLog('success', `查询订阅资料列表成功，共 ${response.length} 条`);
      }
    );
  };

  const handleSubscribeUsersInfo = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const userIds = parseRequiredUserIds(subscribeUserIdsInput, '订阅用户 ID');
    if (!userIds) {
      return;
    }

    await runAction(
      '订阅资料变化',
      () => readyClient.userInfoManager.subscribeUsersInfo({ userIds }),
      () => buildVoidSuccessResponse('订阅资料变化', userIds)
    );
  };

  const handleUnsubscribeUsersInfo = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const userIds = parseRequiredUserIds(unsubscribeUserIdsInput, '取消订阅用户 ID');
    if (!userIds) {
      return;
    }

    await runAction(
      '取消订阅资料变化',
      () => readyClient.userInfoManager.unsubscribeUsersInfo({ userIds }),
      () => buildVoidSuccessResponse('取消订阅资料变化', userIds)
    );
  };

  const handleUpdateOwnInfoByAttribute = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    await runAction(
      `设置当前用户资料字段 ${updateAttribute}`,
      () => readyClient.userInfoManager.updateOwnInfoByAttribute(updateAttribute, updateValue),
      undefined,
      response => {
        onAddLog('success', `设置当前用户资料成功：${response.userId}.${updateAttribute}`);
      }
    );
  };

  return (
    <div className="card">
      <div className="card-title">UserInfoManager 调试</div>
      <p className="push-note">
        资料订阅 notify 会继续写入页面日志，同时把原始事件载荷打印到浏览器控制台，便于直接观察
        `onUserInfoUpdated` 和 `onContactInfoUpdated`。
      </p>
      <p className="push-note">
        设置资料走 `updateOwnInfoByAttribute`，作用于当前登录用户；字符串字段传空字符串即可清空。
      </p>

      <div className="push-grid">
        <section className="push-section">
          <h3>设置当前用户资料</h3>
          <div className="form-group">
            <label htmlFor="user-info-update-attribute">资料字段</label>
            <select
              id="user-info-update-attribute"
              value={updateAttribute}
              onChange={handleAttributeChange}
            >
              {USER_INFO_ATTRIBUTE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="user-info-update-value">字段值</label>
            <input
              id="user-info-update-value"
              placeholder={selectedAttributeOption?.placeholder ?? ''}
              value={updateValue}
              onChange={handleInputChange(setUpdateValue)}
            />
          </div>
          <button
            className="btn btn-success"
            disabled={isBusy}
            onClick={toClickHandler(handleUpdateOwnInfoByAttribute)}
          >
            设置当前用户资料
          </button>
        </section>

        <section className="push-section">
          <h3>按用户 ID 查询资料</h3>
          <div className="form-group">
            <label htmlFor="user-info-fetch-user-ids">用户 ID 列表</label>
            <textarea
              id="user-info-fetch-user-ids"
              placeholder={'支持逗号或换行分隔，例如：\nzd2, zd3'}
              rows={4}
              value={fetchUserIdsInput}
              onChange={handleInputChange(setFetchUserIdsInput)}
            />
          </div>
          <button
            className="btn btn-primary"
            disabled={isBusy}
            onClick={toClickHandler(handleFetchUserInfoByUserId)}
          >
            按用户 ID 查询资料
          </button>
        </section>

        <section className="push-section">
          <h3>资料订阅操作</h3>
          <div className="form-group">
            <label htmlFor="user-info-subscribe-user-ids">订阅用户 ID 列表</label>
            <textarea
              id="user-info-subscribe-user-ids"
              placeholder={'支持逗号或换行分隔，例如：\nzd2, zd3'}
              rows={4}
              value={subscribeUserIdsInput}
              onChange={handleInputChange(setSubscribeUserIdsInput)}
            />
          </div>
          <button
            className="btn btn-success"
            disabled={isBusy}
            onClick={toClickHandler(handleSubscribeUsersInfo)}
          >
            订阅资料变化
          </button>
          <button
            className="btn btn-primary"
            disabled={isBusy}
            onClick={toClickHandler(handleGetSubscribedUsers)}
          >
            查询订阅资料列表
          </button>
        </section>

        <section className="push-section">
          <h3>取消订阅操作</h3>
          <div className="form-group">
            <label htmlFor="user-info-unsubscribe-user-ids">取消订阅用户 ID 列表</label>
            <textarea
              id="user-info-unsubscribe-user-ids"
              placeholder={'支持逗号或换行分隔，例如：\nzd2, zd3'}
              rows={4}
              value={unsubscribeUserIdsInput}
              onChange={handleInputChange(setUnsubscribeUserIdsInput)}
            />
          </div>
          <button
            className="btn btn-danger"
            disabled={isBusy}
            onClick={toClickHandler(handleUnsubscribeUsersInfo)}
          >
            取消订阅资料变化
          </button>
        </section>
      </div>

      <div className="push-result">
        <div className="presence-result-label">
          最近返回结果
          {pendingAction ? `（执行中: ${pendingAction}）` : ''}
        </div>
        <pre className="cache-debug-result">{lastResponse}</pre>
      </div>
    </div>
  );
};
