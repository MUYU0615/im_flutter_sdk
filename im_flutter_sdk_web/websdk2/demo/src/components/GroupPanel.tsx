import { useState } from 'react';
import type { ChangeEvent } from 'react';
import type { DemoClient, LogType } from '../types';
import { formatError, safeJsonStringify, withTimeout } from '../utils';

export interface GroupPanelProps {
  readonly client: DemoClient | null;
  readonly onAddLog: (type: LogType, message: string) => void;
  readonly defaultGroupId?: string;
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

export const GroupPanel = (props: GroupPanelProps): JSX.Element => {
  const { client, onAddLog, defaultGroupId } = props;
  const [groupId, setGroupId] = useState(defaultGroupId ?? '');
  const [pageNum, setPageNum] = useState('1');
  const [pageSize, setPageSize] = useState('20');
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<string>('暂无返回数据');

  // 创建群
  const [createGroupName, setCreateGroupName] = useState('');
  const [createGroupDesc, setCreateGroupDesc] = useState('');
  const [createGroupMembers, setCreateGroupMembers] = useState('');
  const [createGroupPublic, setCreateGroupPublic] = useState(true);
  const [createGroupApproval, setCreateGroupApproval] = useState(false);
  const [createGroupAllowInvites, setCreateGroupAllowInvites] = useState(true);

  // 加群/申请
  const [joinMessage, setJoinMessage] = useState('');

  // 审批
  const [approvalUserId, setApprovalUserId] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  // 更新群信息
  const [updateInfoPayload, setUpdateInfoPayload] = useState('{\n  "name": "SDK Demo Group"\n}');
  const [updateConfigsPayload, setUpdateConfigsPayload] = useState('{\n  "public": true\n}');

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
    // eslint-disable-next-line no-console -- demo 需要把 GroupManager / Group 返回值直接打印到浏览器控制台
    console.log(`[GroupDemo] ${label} 返回`, response);
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
        logResponse(label, buildVoidSuccessResponse(label));
      } else {
        logResponse(label, response);
      }
      onSuccess?.(response);
    } catch (error) {
      // eslint-disable-next-line no-console -- demo 需要在控制台查看失败详情
      console.error(`[GroupDemo] ${label} 失败`, error);
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

  const parsePageValue = (value: string, fallback: number): number => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  const parseRawJsonInput = (value: string): unknown => {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return undefined;
    }
    return JSON.parse(trimmedValue) as unknown;
  };

  const getTrimmedGroupId = (): string | null => {
    const trimmedGroupId = groupId.trim();
    if (!trimmedGroupId) {
      onAddLog('warn', '请输入群组 ID');
      return null;
    }
    return trimmedGroupId;
  };

  const handleGetJoinedGroupList = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    await runAction(
      '读取本地已加入群快照',
      async () => readyClient.groupManager.getJoinedGroupList(),
      response => {
        const firstGroupId = response[0]?.groupId;
        if (firstGroupId) {
          setGroupId(firstGroupId);
          onAddLog('info', `已将 groupId 自动填充为 ${firstGroupId}`);
        }
      }
    );
  };

  const handleGetPublicGroupList = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    await runAction('获取公开群列表', () =>
      readyClient.groupManager.getPublicGroupList({
        pageSize: parsePageValue(pageSize, 20),
      })
    );
  };

  const handleGetGroupDetail = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const trimmedGroupId = getTrimmedGroupId();
    if (!trimmedGroupId) {
      return;
    }

    await runAction('通过 Group 获取群详情', () =>
      readyClient.groupManager.getGroup(trimmedGroupId).getDetail()
    );
  };

  const handleGetMembers = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const trimmedGroupId = getTrimmedGroupId();
    if (!trimmedGroupId) {
      return;
    }

    await runAction('通过 Group 获取成员列表', () =>
      readyClient.groupManager.getGroup(trimmedGroupId).getMembers({
        pageSize: parsePageValue(pageSize, 20),
      })
    );
  };

  const handleGetAdmins = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const trimmedGroupId = getTrimmedGroupId();
    if (!trimmedGroupId) {
      return;
    }

    await runAction('通过 Group 获取管理员列表', () =>
      readyClient.groupManager.getGroup(trimmedGroupId).getAdmins()
    );
  };

  const handleGetAnnouncement = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const trimmedGroupId = getTrimmedGroupId();
    if (!trimmedGroupId) {
      return;
    }

    await runAction('通过 Group 获取公告', () =>
      readyClient.groupManager.getGroup(trimmedGroupId).getAnnouncement()
    );
  };

  const handleGetMuteList = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const trimmedGroupId = getTrimmedGroupId();
    if (!trimmedGroupId) {
      return;
    }

    await runAction('通过 Group 获取禁言列表', () =>
      readyClient.groupManager.getGroup(trimmedGroupId).getMuteList()
    );
  };

  const handleGetAllowlist = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const trimmedGroupId = getTrimmedGroupId();
    if (!trimmedGroupId) {
      return;
    }

    await runAction('通过 Group 获取 allowlist', () =>
      readyClient.groupManager.getGroup(trimmedGroupId).getAllowlist()
    );
  };

  const handleGetBlocklist = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const trimmedGroupId = getTrimmedGroupId();
    if (!trimmedGroupId) {
      return;
    }

    await runAction('通过 Group 获取黑名单', () =>
      readyClient.groupManager.getGroup(trimmedGroupId).getBlocklist()
    );
  };

  const handleGetSharedFiles = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const trimmedGroupId = getTrimmedGroupId();
    if (!trimmedGroupId) {
      return;
    }

    await runAction('通过 Group 获取共享文件列表', () =>
      readyClient.groupManager.getGroup(trimmedGroupId).getSharedFileList({
        pageNum: parsePageValue(pageNum, 1),
        pageSize: parsePageValue(pageSize, 20),
      })
    );
  };

  const handleCreateGroup = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }
    const name = createGroupName.trim();
    if (!name) {
      onAddLog('warn', '请输入群名称');
      return;
    }
    const memberIds = createGroupMembers
      .split(/[,，\n]/)
      .map(s => s.trim())
      .filter(Boolean);

    await runAction(
      '创建群组',
      () =>
        readyClient.groupManager.createGroup({
          name,
          description: createGroupDesc.trim(),
          memberIds,
          public: createGroupPublic,
          joinApprovalRequired: createGroupApproval,
          allowInvites: createGroupAllowInvites,
          inviteNeedConfirm: false,
        }),
      response => {
        setGroupId(response.groupId);
        onAddLog('info', `已将 groupId 自动填充为 ${response.groupId}`);
      }
    );
  };

  const handleJoinGroup = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }
    const trimmedGroupId = getTrimmedGroupId();
    if (!trimmedGroupId) {
      return;
    }

    await runAction('申请加入群组', () =>
      readyClient.groupManager.joinGroup({
        groupId: trimmedGroupId,
        message: joinMessage.trim() || undefined,
      })
    );
  };

  const handleAcceptJoinRequest = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }
    const trimmedGroupId = getTrimmedGroupId();
    if (!trimmedGroupId) {
      return;
    }
    const userId = approvalUserId.trim();
    if (!userId) {
      onAddLog('warn', '请输入申请人用户 ID');
      return;
    }

    await runAction('同意入群申请', () =>
      readyClient.groupManager.acceptGroupJoinRequest({
        groupId: trimmedGroupId,
        userId,
      })
    );
  };

  const handleRejectJoinRequest = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }
    const trimmedGroupId = getTrimmedGroupId();
    if (!trimmedGroupId) {
      return;
    }
    const userId = approvalUserId.trim();
    if (!userId) {
      onAddLog('warn', '请输入申请人用户 ID');
      return;
    }

    await runAction('拒绝入群申请', () =>
      readyClient.groupManager.rejectGroupJoinRequest({
        groupId: trimmedGroupId,
        userId,
        reason: rejectReason.trim() || '管理员拒绝',
      })
    );
  };

  const handleUpdateInfo = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }
    const trimmedGroupId = getTrimmedGroupId();
    if (!trimmedGroupId) {
      return;
    }

    await runAction('通过 Group 更新群信息', () =>
      readyClient.groupManager
        .getGroup(trimmedGroupId)
        .updateInfo(parseRawJsonInput(updateInfoPayload) as never)
    );
  };

  const handleUpdateConfigs = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }
    const trimmedGroupId = getTrimmedGroupId();
    if (!trimmedGroupId) {
      return;
    }

    await runAction('通过 Group 更新群配置', () =>
      readyClient.groupManager
        .getGroup(trimmedGroupId)
        .updateConfigs(parseRawJsonInput(updateConfigsPayload) as never)
    );
  };

  return (
    <div className="card">
      <div className="card-title">GroupManager / Group 调试</div>
      <p className="push-note">
        本面板用于演示 `groupManager.getJoinedGroupList()` 和 `groupManager.getGroup(groupId)`
        的常见调用。所有返回值都会打印到浏览器 console。
      </p>

      <div className="push-grid">
        <section className="push-section">
          <h3>群列表</h3>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="group-page-num">pageNum</label>
              <input
                id="group-page-num"
                value={pageNum}
                onChange={handleInputChange(setPageNum)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="group-page-size">pageSize</label>
              <input
                id="group-page-size"
                value={pageSize}
                onChange={handleInputChange(setPageSize)}
              />
            </div>
          </div>
          <button
            className="btn btn-primary"
            disabled={isBusy}
            onClick={toClickHandler(handleGetJoinedGroupList)}
          >
            getJoinedGroupList
          </button>
          <button
            className="btn btn-success"
            disabled={isBusy}
            onClick={toClickHandler(handleGetPublicGroupList)}
          >
            getPublicGroupList
          </button>
        </section>

        <section className="push-section">
          <h3>单群上下文</h3>
          <div className="form-group">
            <label htmlFor="group-id">groupId</label>
            <input
              id="group-id"
              placeholder="例如：group-1"
              value={groupId}
              onChange={handleInputChange(setGroupId)}
            />
          </div>
          <button
            className="btn btn-primary"
            disabled={isBusy}
            onClick={toClickHandler(handleGetGroupDetail)}
          >
            group.getDetail
          </button>
          <button
            className="btn btn-primary"
            disabled={isBusy}
            onClick={toClickHandler(handleGetMembers)}
          >
            group.getMembers
          </button>
          <button
            className="btn btn-primary"
            disabled={isBusy}
            onClick={toClickHandler(handleGetAdmins)}
          >
            group.getAdmins
          </button>
          <button
            className="btn btn-primary"
            disabled={isBusy}
            onClick={toClickHandler(handleGetAnnouncement)}
          >
            group.getAnnouncement
          </button>
          <button
            className="btn btn-primary"
            disabled={isBusy}
            onClick={toClickHandler(handleGetMuteList)}
          >
            group.getMuteList
          </button>
          <button
            className="btn btn-primary"
            disabled={isBusy}
            onClick={toClickHandler(handleGetAllowlist)}
          >
            group.getAllowlist
          </button>
          <button
            className="btn btn-primary"
            disabled={isBusy}
            onClick={toClickHandler(handleGetBlocklist)}
          >
            group.getBlocklist
          </button>
          <button
            className="btn btn-primary"
            disabled={isBusy}
            onClick={toClickHandler(handleGetSharedFiles)}
          >
            group.getSharedFileList
          </button>
        </section>

        <section className="push-section">
          <h3>创建群组</h3>
          <div className="form-group">
            <label htmlFor="create-group-name">群名称</label>
            <input
              id="create-group-name"
              placeholder="必填"
              value={createGroupName}
              onChange={handleInputChange(setCreateGroupName)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="create-group-desc">群描述</label>
            <input
              id="create-group-desc"
              placeholder="可选"
              value={createGroupDesc}
              onChange={handleInputChange(setCreateGroupDesc)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="create-group-members">初始成员</label>
            <input
              id="create-group-members"
              placeholder="逗号分隔，例如: user1, user2"
              value={createGroupMembers}
              onChange={handleInputChange(setCreateGroupMembers)}
            />
          </div>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={createGroupPublic}
                onChange={e => setCreateGroupPublic(e.target.checked)}
              />{' '}
              公开群
            </label>
            <label>
              <input
                type="checkbox"
                checked={createGroupApproval}
                onChange={e => setCreateGroupApproval(e.target.checked)}
              />{' '}
              入群需审批
            </label>
            <label>
              <input
                type="checkbox"
                checked={createGroupAllowInvites}
                onChange={e => setCreateGroupAllowInvites(e.target.checked)}
              />{' '}
              允许成员邀请
            </label>
          </div>
          <button
            className="btn btn-success"
            disabled={isBusy}
            onClick={toClickHandler(handleCreateGroup)}
          >
            创建群组
          </button>
        </section>

        <section className="push-section">
          <h3>修改群信息</h3>
          <div className="form-group">
            <label htmlFor="update-group-info-payload">updateInfo JSON</label>
            <textarea
              id="update-group-info-payload"
              rows={6}
              spellCheck={false}
              value={updateInfoPayload}
              onChange={handleInputChange(setUpdateInfoPayload)}
            />
          </div>
          <button
            className="btn btn-success"
            disabled={isBusy}
            onClick={toClickHandler(handleUpdateInfo)}
          >
            group.updateInfo
          </button>
        </section>

        <section className="push-section">
          <h3>修改群配置</h3>
          <div className="form-group">
            <label htmlFor="update-group-configs-payload">updateConfigs JSON</label>
            <textarea
              id="update-group-configs-payload"
              rows={6}
              spellCheck={false}
              value={updateConfigsPayload}
              onChange={handleInputChange(setUpdateConfigsPayload)}
            />
          </div>
          <button
            className="btn btn-success"
            disabled={isBusy}
            onClick={toClickHandler(handleUpdateConfigs)}
          >
            group.updateConfigs
          </button>
        </section>

        <section className="push-section">
          <h3>加入群组</h3>
          <div className="form-group">
            <label htmlFor="join-group-message">申请附言</label>
            <input
              id="join-group-message"
              placeholder="可选，需要上方 groupId"
              value={joinMessage}
              onChange={handleInputChange(setJoinMessage)}
            />
          </div>
          <button
            className="btn btn-success"
            disabled={isBusy}
            onClick={toClickHandler(handleJoinGroup)}
          >
            申请加入群组
          </button>
        </section>

        <section className="push-section">
          <h3>入群审批</h3>
          <div className="form-group">
            <label htmlFor="approval-user-id">申请人用户 ID</label>
            <input
              id="approval-user-id"
              placeholder="必填，需要上方 groupId"
              value={approvalUserId}
              onChange={handleInputChange(setApprovalUserId)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="reject-reason">拒绝原因</label>
            <input
              id="reject-reason"
              placeholder="拒绝时必填"
              value={rejectReason}
              onChange={handleInputChange(setRejectReason)}
            />
          </div>
          <button
            className="btn btn-success"
            disabled={isBusy}
            onClick={toClickHandler(handleAcceptJoinRequest)}
          >
            同意入群
          </button>
          <button
            className="btn btn-danger"
            disabled={isBusy}
            onClick={toClickHandler(handleRejectJoinRequest)}
          >
            拒绝入群
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
