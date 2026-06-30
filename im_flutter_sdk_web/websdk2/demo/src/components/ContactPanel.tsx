import { useState } from 'react';
import type { ChangeEvent } from 'react';
import type { DemoClient, LogType } from '../types';
import { formatError, parseUsernamesInput, safeJsonStringify, withTimeout } from '../utils';

export interface ContactPanelProps {
  readonly client: DemoClient | null;
  readonly onAddLog: (type: LogType, message: string) => void;
  readonly defaultTargetId?: string;
}

const API_TIMEOUT = 15000;

const formatResponseText = (label: string, response: unknown): string => {
  try {
    return `${label}\n${JSON.stringify(response, null, 2)}`;
  } catch {
    return `${label}\n${safeJsonStringify(response)}`;
  }
};

const buildVoidSuccessResponse = (label: string): Record<string, unknown> => {
  return {
    ok: true,
    action: label,
    message: '无返回数据',
  };
};

export const ContactPanel = (props: ContactPanelProps): JSX.Element => {
  const { client, onAddLog, defaultTargetId } = props;
  const [targetUserId, setTargetUserId] = useState(defaultTargetId ?? '');
  const [inviteMessage, setInviteMessage] = useState('');
  const [remark, setRemark] = useState('');
  const [blocklistInput, setBlocklistInput] = useState(defaultTargetId ?? '');
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<string>('暂无返回数据');

  const isBusy = pendingAction !== null;

  const ensureClientInitialized = (): DemoClient | null => {
    if (!client) {
      onAddLog('warn', '请先初始化 SDK');
      return null;
    }
    return client;
  };

  const ensureClientReady = (): DemoClient | null => {
    const initializedClient = ensureClientInitialized();
    if (!initializedClient) {
      return null;
    }

    const connectionState = initializedClient.getConnectionState();
    if (connectionState !== 'connected') {
      onAddLog('warn', `请先登录（当前状态: ${connectionState}）`);
      return null;
    }

    return initializedClient;
  };

  const logResponse = (label: string, response: unknown): void => {
    // eslint-disable-next-line no-console -- demo 需要把 ContactManager 返回值直接打印到浏览器控制台
    console.log(`[ContactManager] ${label} 返回`, response);
    setLastResponse(formatResponseText(label, response));
    onAddLog('info', `${label}返回: ${safeJsonStringify(response)}`);
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
        const successResponse = buildVoidSuccessResponse(label);
        logResponse(label, successResponse);
      } else {
        logResponse(label, response);
      }
      onSuccess?.(response);
    } catch (error) {
      // eslint-disable-next-line no-console -- demo 需要在控制台查看失败详情
      console.error(`[ContactManager] ${label} 失败`, error);
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

  const toClickHandler = (handler: () => Promise<void> | void): (() => void) => {
    return (): void => {
      void handler();
    };
  };

  const getTrimmedTargetUserId = (): string | null => {
    const trimmedUserId = targetUserId.trim();
    if (!trimmedUserId) {
      onAddLog('warn', '请输入目标用户 ID');
      return null;
    }
    return trimmedUserId;
  };

  const handleGetContacts = (): void => {
    const initializedClient = ensureClientInitialized();
    if (!initializedClient) {
      return;
    }

    const contacts = initializedClient.contactManager.getContacts();
    logResponse('获取联系人列表', contacts);
    onAddLog('success', `获取联系人列表成功，共 ${contacts.length} 条`);
  };

  const handleGetSnapshot = (): void => {
    const initializedClient = ensureClientInitialized();
    if (!initializedClient) {
      return;
    }

    const snapshot = initializedClient.getContactSnapshot();
    logResponse('通过 ChatClient 获取联系人快照', snapshot);
    onAddLog('success', `通过 ChatClient 获取联系人快照成功：${snapshot ? '有快照' : '无快照'}`);
  };

  const handleAddContact = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const userId = getTrimmedTargetUserId();
    if (!userId) {
      return;
    }

    const message = inviteMessage.trim();
    await runAction('添加联系人', () =>
      readyClient.contactManager.addContact({
        userId,
        message: message || undefined,
      })
    );
  };

  const handleDeleteContact = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const userId = getTrimmedTargetUserId();
    if (!userId) {
      return;
    }

    await runAction('删除联系人', () => readyClient.contactManager.deleteContact({ userId }));
  };

  const handleAcceptContactInvite = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const userId = getTrimmedTargetUserId();
    if (!userId) {
      return;
    }

    await runAction('同意好友申请', () =>
      readyClient.contactManager.acceptContactInvite({ userId })
    );
  };

  const handleDeclineContactInvite = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const userId = getTrimmedTargetUserId();
    if (!userId) {
      return;
    }

    await runAction('拒绝好友申请', () =>
      readyClient.contactManager.declineContactInvite({ userId })
    );
  };

  const handleSetContactRemark = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const userId = getTrimmedTargetUserId();
    if (!userId) {
      return;
    }

    await runAction('设置联系人备注', () =>
      readyClient.contactManager.setContactRemark({
        userId,
        remark,
      })
    );
  };

  const handleGetBlocklist = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    await runAction('获取黑名单', () => readyClient.contactManager.getBlocklist());
  };

  const parseBlocklistUserIds = (): ReadonlyArray<string> | null => {
    const userIds = parseUsernamesInput(blocklistInput);
    if (userIds.length === 0) {
      onAddLog('warn', '请输入黑名单用户 ID（支持逗号或换行分隔）');
      return null;
    }
    return userIds;
  };

  const handleAddUsersToBlocklist = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const userIds = parseBlocklistUserIds();
    if (!userIds) {
      return;
    }

    await runAction('添加到黑名单', () =>
      readyClient.contactManager.addUsersToBlocklist({ userIds })
    );
  };

  const handleRemoveUsersFromBlocklist = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const userIds = parseBlocklistUserIds();
    if (!userIds) {
      return;
    }

    await runAction('移除黑名单', () =>
      readyClient.contactManager.removeUserFromBlocklist({ userIds })
    );
  };

  return (
    <div className="card">
      <div className="card-title">ContactManager 调试</div>
      <p className="push-note">
        所有 ContactManager 接口返回值都会打印到浏览器控制台，便于和服务端原始行为一起排查。
      </p>

      <div className="push-grid">
        <section className="push-section">
          <h3>本地快照读取</h3>
          <p className="push-note">
            `getContacts()` 由 `ContactManager` 提供；如需完整快照元数据，请通过 `ChatClient.getContactSnapshot()` 调试读取。
          </p>
          <button className="btn btn-primary" disabled={isBusy} onClick={handleGetContacts}>
            获取联系人列表
          </button>
          <button className="btn btn-primary" disabled={isBusy} onClick={handleGetSnapshot}>
            通过 ChatClient 获取联系人快照
          </button>
        </section>

        <section className="push-section">
          <h3>联系人操作</h3>
          <div className="form-group">
            <label htmlFor="contact-target-user-id">目标用户 ID</label>
            <input
              id="contact-target-user-id"
              placeholder="例如：zd2"
              value={targetUserId}
              onChange={handleInputChange(setTargetUserId)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="contact-invite-message">好友申请附言（可选）</label>
            <input
              id="contact-invite-message"
              placeholder="例如：我是 demo 联调用户"
              value={inviteMessage}
              onChange={handleInputChange(setInviteMessage)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="contact-remark">联系人备注（允许留空用于清空）</label>
            <input
              id="contact-remark"
              placeholder="例如：测试备注"
              value={remark}
              onChange={handleInputChange(setRemark)}
            />
          </div>
          <button
            className="btn btn-success"
            disabled={isBusy}
            onClick={toClickHandler(handleAddContact)}
          >
            添加联系人
          </button>
          <button
            className="btn btn-danger"
            disabled={isBusy}
            onClick={toClickHandler(handleDeleteContact)}
          >
            删除联系人
          </button>
          <button
            className="btn btn-primary"
            disabled={isBusy}
            onClick={toClickHandler(handleAcceptContactInvite)}
          >
            同意好友申请
          </button>
          <button
            className="btn btn-warning"
            disabled={isBusy}
            onClick={toClickHandler(handleDeclineContactInvite)}
          >
            拒绝好友申请
          </button>
          <button
            className="btn btn-primary"
            disabled={isBusy}
            onClick={toClickHandler(handleSetContactRemark)}
          >
            设置联系人备注
          </button>
        </section>

        <section className="push-section">
          <h3>黑名单操作</h3>
          <div className="form-group">
            <label htmlFor="contact-blocklist-user-ids">黑名单用户 ID 列表</label>
            <textarea
              id="contact-blocklist-user-ids"
              placeholder={'支持逗号或换行分隔，例如：\nzd2, zd3'}
              rows={4}
              value={blocklistInput}
              onChange={handleInputChange(setBlocklistInput)}
            />
          </div>
          <button
            className="btn btn-primary"
            disabled={isBusy}
            onClick={toClickHandler(handleGetBlocklist)}
          >
            获取黑名单
          </button>
          <button
            className="btn btn-warning"
            disabled={isBusy}
            onClick={toClickHandler(handleAddUsersToBlocklist)}
          >
            添加到黑名单
          </button>
          <button
            className="btn btn-danger"
            disabled={isBusy}
            onClick={toClickHandler(handleRemoveUsersFromBlocklist)}
          >
            移除黑名单
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
