import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { UserInfoAttribute } from 'im-sdk-web';
import type {
  ConversationItemRecord,
  DemoClient,
  GroupNamecardEventRecord,
  GroupNamecardRecord,
  LogType,
  MessageRecord,
  UserInfoEventRecord,
  UserInfoSummaryRecord,
} from '../types';
import { formatError, safeJsonStringify, withTimeout } from '../utils';
import { getMessageProfileVersionSidecar } from '../../../src/core/message/profile-sync/profile-version-sidecar';
import { RestClient } from '../../../src/rest/client';
import { parseAppKey } from '../../../src/upload/utils';

export interface ProfileSyncPanelProps {
  readonly client: DemoClient | null;
  readonly enableUserInfoSync: boolean;
  readonly currentUserId: string | null;
  readonly messages: ReadonlyArray<MessageRecord>;
  readonly conversations: ReadonlyArray<ConversationItemRecord>;
  readonly userInfoEvents: ReadonlyArray<UserInfoEventRecord>;
  readonly groupNamecardEvents: ReadonlyArray<GroupNamecardEventRecord>;
  readonly onAddLog: (type: LogType, message: string) => void;
  readonly onClearEvents: () => void;
}

const API_TIMEOUT = 15000;
const LIST_LIMIT = 12;
const DEFAULT_ATTRIBUTE_QUERY = 'nickname,avatarUrl,sign,ext';
const DEFAULT_GROUP_ATTRIBUTE_KEYS = 'groupNamecard,namecard';
const DEFAULT_GROUP_MEMBER_PAGE_NUM = 1;
const DEFAULT_GROUP_MEMBER_PAGE_SIZE = 20;
const USER_INFO_ATTRIBUTES = [
  'nickname',
  'avatarUrl',
  'mail',
  'phone',
  'gender',
  'sign',
  'birth',
  'ext',
] as const;

const splitInputValues = (value: string): ReadonlyArray<string> => {
  return value
    .split(/[\n,]/)
    .map(item => item.trim())
    .filter((item): boolean => item.length > 0);
};

const isUserInfoAttribute = (value: string): value is UserInfoAttribute => {
  return (USER_INFO_ATTRIBUTES as ReadonlyArray<string>).includes(value);
};

const formatTime = (value?: number): string => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return '-';
  }
  return new Date(value).toLocaleString();
};

const formatVersion = (value?: number): string => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return '-';
  }
  return `${value} (${new Date(value * 1000).toLocaleString()})`;
};

const formatResponseText = (label: string, response: unknown): string => {
  try {
    return JSON.stringify(
      {
        label,
        time: new Date().toLocaleString(),
        response,
      },
      null,
      2
    );
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

const resolveAttributeValue = (
  attribute: UserInfoAttribute,
  rawValue: string
): string | number | boolean => {
  if (attribute !== 'gender') {
    return rawValue;
  }
  const normalized = rawValue.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }
  if (normalized === 'false') {
    return false;
  }
  const numericValue = Number(rawValue);
  if (rawValue.trim() !== '' && Number.isFinite(numericValue)) {
    return numericValue;
  }
  return rawValue;
};

const matchesKeyword = (values: ReadonlyArray<string>, keyword: string): boolean => {
  if (!keyword) {
    return true;
  }
  return values.some(value => value.toLowerCase().includes(keyword));
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const extractGroupMemberList = (response: unknown): ReadonlyArray<unknown> => {
  if (isObjectRecord(response) && Array.isArray(response.data)) {
    return response.data;
  }
  if (
    isObjectRecord(response) &&
    isObjectRecord(response.data) &&
    Array.isArray(response.data.data)
  ) {
    return response.data.data;
  }
  return [];
};

const extractGroupMemberUserId = (value: unknown): string | undefined => {
  if (!isObjectRecord(value)) {
    return undefined;
  }
  const directKeys = ['owner', 'admin', 'member', 'userId', 'username'];
  for (const key of directKeys) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  const nestedUser = value.user;
  if (!isObjectRecord(nestedUser)) {
    return undefined;
  }
  const nestedUserId = nestedUser.userId;
  return typeof nestedUserId === 'string' && nestedUserId.trim() ? nestedUserId.trim() : undefined;
};

const filterGroupMemberFields = (
  value: unknown,
  keys: ReadonlyArray<string>
): Record<string, unknown> | unknown => {
  if (!isObjectRecord(value) || keys.length === 0) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).filter(([key]): boolean => {
      return (
        keys.includes(key) ||
        key === 'owner' ||
        key === 'admin' ||
        key === 'member' ||
        key === 'user' ||
        key === 'userId' ||
        key === 'username'
      );
    })
  );
};

const summarizeUserInfoPayload = (
  payload: ReadonlyArray<UserInfoEventRecord['payload'][number]>
): string => {
  return payload
    .map(item => {
      const nickname = item.nickname?.trim();
      return nickname ? `${item.userId}(${nickname})` : item.userId;
    })
    .join(', ');
};

export const ProfileSyncPanel = (props: ProfileSyncPanelProps): JSX.Element => {
  const {
    client,
    enableUserInfoSync,
    currentUserId,
    messages,
    conversations,
    userInfoEvents,
    groupNamecardEvents,
    onAddLog,
    onClearEvents,
  } = props;
  const [userIdQuery, setUserIdQuery] = useState<string>('');
  const [attributeQuery, setAttributeQuery] = useState<string>(DEFAULT_ATTRIBUTE_QUERY);
  const [updateNickname, setUpdateNickname] = useState<string>('');
  const [updateAvatarUrl, setUpdateAvatarUrl] = useState<string>('');
  const [updateSign, setUpdateSign] = useState<string>('');
  const [updateExt, setUpdateExt] = useState<string>('');
  const [singleAttribute, setSingleAttribute] = useState<UserInfoAttribute>('nickname');
  const [singleAttributeValue, setSingleAttributeValue] = useState<string>('');
  const [groupId, setGroupId] = useState<string>('');
  const [groupMemberUserId, setGroupMemberUserId] = useState<string>('');
  const [groupAttributeKeys, setGroupAttributeKeys] = useState<string>(
    DEFAULT_GROUP_ATTRIBUTE_KEYS
  );
  const [groupNamecard, setGroupNamecard] = useState<string>('');
  const [cacheKeyword, setCacheKeyword] = useState<string>('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string>('暂无返回数据');

  useEffect((): void => {
    if (currentUserId && !groupMemberUserId.trim()) {
      setGroupMemberUserId(currentUserId);
    }
  }, [currentUserId, groupMemberUserId]);

  const isBusy = pendingAction !== null;
  const cacheManager = client?.getCacheManager() ?? null;
  const normalizedKeyword = cacheKeyword.trim().toLowerCase();
  const normalizedGroupId = groupId.trim();

  const userInfoSummaries = [...(cacheManager?.loadUserInfoSummaries() ?? [])].sort(
    (left, right): number => right.lastUpdate - left.lastUpdate
  );
  const filteredUserInfoSummaries = userInfoSummaries.filter((item): boolean =>
    matchesKeyword(
      [item.userId, item.nickname ?? '', item.avatarUrl ?? '', item.sign ?? '', item.ext ?? ''],
      normalizedKeyword
    )
  );
  const filteredUserInfoIds = filteredUserInfoSummaries.map(item => item.userId);

  const groupNamecardRecords = [
    ...(cacheManager?.loadGroupNamecards(normalizedGroupId || undefined) ?? []),
  ].sort((left, right): number => right.lastUpdate - left.lastUpdate);
  const filteredGroupNamecards = groupNamecardRecords.filter((item): boolean =>
    matchesKeyword([item.groupId, item.userId, item.namecard], normalizedKeyword)
  );
  const filteredGroupNamecardTargets = filteredGroupNamecards.map(item => ({
    groupId: item.groupId,
    userId: item.userId,
  }));

  const ensureClientReady = (): DemoClient | null => {
    if (!client) {
      onAddLog('warn', '请先初始化并登录 SDK');
      return null;
    }
    const connectionState = client.getConnectionState();
    if (connectionState !== 'connected') {
      onAddLog('warn', `请先登录（当前状态: ${connectionState}）`);
      return null;
    }
    return client;
  };

  const runAction = async <T,>(label: string, operation: () => Promise<T>): Promise<void> => {
    if (isBusy) {
      return;
    }
    setPendingAction(label);
    try {
      const response = await withTimeout(operation(), API_TIMEOUT, label);
      const normalizedResponse =
        response === undefined ? buildVoidSuccessResponse(label) : response;
      // eslint-disable-next-line no-console -- demo 需要把资料补位调试接口返回直接打印到控制台
      console.log(`[ProfileSyncDemo] ${label}`, normalizedResponse);
      setLastResult(formatResponseText(label, normalizedResponse));
      onAddLog('success', `${label}成功`);
    } catch (error) {
      // eslint-disable-next-line no-console -- demo 需要在控制台查看原始错误
      console.error(`[ProfileSyncDemo] ${label}失败`, error);
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
    setSingleAttribute(event.target.value as UserInfoAttribute);
  };

  const getTargetUserIds = (): ReadonlyArray<string> | null => {
    const userIds = splitInputValues(userIdQuery);
    if (userIds.length === 0) {
      onAddLog('warn', '请输入 userId，支持逗号或换行分隔');
      return null;
    }
    return userIds;
  };

  const getRequestedAttributes = (): ReadonlyArray<UserInfoAttribute> | null => {
    const rawAttributes = splitInputValues(attributeQuery);
    if (rawAttributes.length === 0) {
      onAddLog('warn', '请输入要查询的资料字段');
      return null;
    }
    const invalidAttributes = rawAttributes.filter(
      (attribute): boolean => !isUserInfoAttribute(attribute)
    );
    if (invalidAttributes.length > 0) {
      onAddLog('warn', `存在不支持的字段: ${invalidAttributes.join(', ')}`);
      return null;
    }
    return rawAttributes as ReadonlyArray<UserInfoAttribute>;
  };

  const getTrimmedGroupContext = (): { groupId: string; userId: string } | null => {
    const trimmedGroupId = groupId.trim();
    const trimmedUserId = groupMemberUserId.trim();
    if (!trimmedGroupId) {
      onAddLog('warn', '请输入群组 ID');
      return null;
    }
    if (!trimmedUserId) {
      onAddLog('warn', '请输入群成员 userId');
      return null;
    }
    return {
      groupId: trimmedGroupId,
      userId: trimmedUserId,
    };
  };

  const toClickHandler = (handler: () => Promise<void>): (() => void) => {
    return (): void => {
      void handler();
    };
  };

  const handleFetchUserInfoByUserId = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    const userIds = getTargetUserIds();
    if (!readyClient || !userIds) {
      return;
    }
    await runAction('按 userId 查询资料', () =>
      readyClient.userInfoManager.getUserInfoByUserId({ userIds })
    );
  };

  const handleFetchUserInfoByAttribute = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    const userIds = getTargetUserIds();
    const attributes = getRequestedAttributes();
    if (!readyClient || !userIds || !attributes) {
      return;
    }
    await runAction('按字段查询资料', () =>
      readyClient.userInfoManager.getUserInfoByAttribute({
        userIds,
        attributes,
      })
    );
  };

  const handleUpdateOwnInfo = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }
    const payload: {
      nickname?: string;
      avatarUrl?: string;
      sign?: string;
      ext?: string;
    } = {};
    if (updateNickname.trim()) {
      payload.nickname = updateNickname.trim();
    }
    if (updateAvatarUrl.trim()) {
      payload.avatarUrl = updateAvatarUrl.trim();
    }
    if (updateSign.trim()) {
      payload.sign = updateSign.trim();
    }
    if (updateExt.trim()) {
      payload.ext = updateExt.trim();
    }
    if (Object.keys(payload).length === 0) {
      onAddLog('warn', '请至少填写一个非空资料字段');
      return;
    }
    await runAction('更新我的资料', () => readyClient.userInfoManager.updateOwnInfo(payload));
  };

  const handleUpdateOwnInfoByAttribute = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }
    await runAction(`按字段更新我的资料(${singleAttribute})`, () =>
      readyClient.userInfoManager.updateOwnInfoByAttribute(
        singleAttribute,
        resolveAttributeValue(singleAttribute, singleAttributeValue)
      )
    );
  };

  const handleGetGroupMemberAttributes = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    const context = getTrimmedGroupContext();
    if (!readyClient || !context) {
      return;
    }
    const keys = splitInputValues(groupAttributeKeys);
    const restContext = readyClient.getRestContext();
    const restClient = new RestClient(restContext.restBaseUrl);
    restClient.setAuthToken(restContext.token);
    const { orgName, appName } = parseAppKey(restContext.appKey);
    const endpoint =
      `/${orgName}/${appName}/chatgroups/${encodeURIComponent(context.groupId)}` +
      `/users?pagenum=${DEFAULT_GROUP_MEMBER_PAGE_NUM}&pagesize=${DEFAULT_GROUP_MEMBER_PAGE_SIZE}`;
    await runAction('查询群成员属性', async () => {
      const response = await restClient.get<unknown>(endpoint, {
        operation: 'getGroupMemberList',
      });
      const members = extractGroupMemberList(response);
      const matchedMembers = members
        .filter((item): boolean => extractGroupMemberUserId(item) === context.userId)
        .map(item => filterGroupMemberFields(item, keys));
      return {
        endpoint,
        queryMode: 'GET /chatgroups/{groupId}/users?pagenum=1&pagesize=20',
        userId: context.userId,
        localKeyFilter: keys.length > 0 ? keys : undefined,
        matchedCount: matchedMembers.length,
        matchedMembers,
        response,
      };
    });
  };

  const handleUpdateGroupNamecard = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    const context = getTrimmedGroupContext();
    const trimmedNamecard = groupNamecard.trim();
    if (!readyClient || !context) {
      return;
    }
    if (!trimmedNamecard) {
      onAddLog('warn', '请输入要设置的群名片');
      return;
    }
    if (context.userId !== currentUserId) {
      onAddLog(
        'warn',
        '当前页面的群名片更新已改为 PUT /sdk/chatgroups/{groupId}/nameCard，只支持更新当前登录用户自己的群名片'
      );
      return;
    }
    await runAction('更新群名片', async () => {
      await readyClient.groupManager.getGroup(context.groupId).setMemberAttributes({
        userId: context.userId,
        memberAttributes: {
          groupNamecard: trimmedNamecard,
        },
      });
      return {
        ok: true,
        groupId: context.groupId,
        userId: context.userId,
        namecard: trimmedNamecard,
        note:
          context.userId === currentUserId
            ? '当前用户自己的群名片已更新；下一条该群消息应携带新的 namecardUpdateTime'
            : '已提交群名片更新请求',
      };
    });
  };

  const handleClearFilteredUserInfoCache = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient || !cacheManager) {
      return;
    }
    if (filteredUserInfoIds.length === 0) {
      onAddLog('warn', '当前过滤结果里没有可清除的用户资料缓存');
      return;
    }
    await runAction('清除当前过滤结果的用户资料缓存', async () => {
      cacheManager.removeUserInfo(filteredUserInfoIds);
      return {
        ok: true,
        removedCount: filteredUserInfoIds.length,
        removedUserIds: filteredUserInfoIds,
        keyword: normalizedKeyword || '(全部)',
      };
    });
  };

  const handleClearFilteredGroupNamecardCache = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient || !cacheManager) {
      return;
    }
    if (filteredGroupNamecardTargets.length === 0) {
      onAddLog('warn', '当前过滤结果里没有可清除的群名片缓存');
      return;
    }
    await runAction('清除当前过滤结果的群名片缓存', async () => {
      cacheManager.removeGroupNamecards(filteredGroupNamecardTargets);
      return {
        ok: true,
        removedCount: filteredGroupNamecardTargets.length,
        removedTargets: filteredGroupNamecardTargets,
        keyword: normalizedKeyword || '(全部)',
        groupId: normalizedGroupId || '(全部)',
      };
    });
  };

  const resolveCachedGroupNamecard = (
    groupIdValue: string,
    userId: string
  ): GroupNamecardRecord | null => {
    if (!cacheManager) {
      return null;
    }
    return cacheManager.getGroupNamecard(groupIdValue, userId, false);
  };

  const recentMessages = messages.slice(0, LIST_LIMIT);
  const recentConversations = conversations.slice(0, LIST_LIMIT);

  return (
    <div className="grid">
      <div className="card">
        <div className="card-title">测试说明</div>
        <div className="profile-sync-note">
          这个页面按 031
          的真实链路组织：先看消息上的版本信息，再看缓存快照和事件回调，最后用手动接口触发“自己更新资料/群名片”的发送前置条件。
        </div>
        <ol className="profile-sync-step-list">
          <li>在“初始化/登录”页登录当前测试账号。</li>
          <li>在本页先记录当前缓存和事件为空的状态。</li>
          <li>
            用另一个账号更新资料后给当前账号发消息，观察 `onUserInfoUpdated`、消息 sender
            展示和缓存版本。
          </li>
          <li>
            在群里更新另一个账号的群名片并发群消息，观察 `onUserGroupNamecardUpdated` 与群名片缓存。
          </li>
          <li>
            用本页更新当前账号自己的资料或群名片，再去“发送消息”页发下一条消息，回看这里的消息版本与会话列表 sender。
          </li>
        </ol>
        <div className="form-row">
          <div className="profile-sync-summary-item">
            <span className="profile-sync-summary-label">enableUserInfoSync</span>
            <span>{enableUserInfoSync ? '开启' : '关闭'}</span>
          </div>
          <div className="profile-sync-summary-item">
            <span className="profile-sync-summary-label">当前用户</span>
            <span>{currentUserId ?? '未登录'}</span>
          </div>
          <div className="profile-sync-summary-item">
            <span className="profile-sync-summary-label">用户资料事件</span>
            <span>{userInfoEvents.length}</span>
          </div>
          <div className="profile-sync-summary-item">
            <span className="profile-sync-summary-label">群名片事件</span>
            <span>{groupNamecardEvents.length}</span>
          </div>
          <div className="profile-sync-summary-item">
            <span className="profile-sync-summary-label">用户资料缓存</span>
            <span>{userInfoSummaries.length}</span>
          </div>
          <div className="profile-sync-summary-item">
            <span className="profile-sync-summary-label">群名片缓存</span>
            <span>{groupNamecardRecords.length}</span>
          </div>
        </div>
        {!enableUserInfoSync ? (
          <div className="profile-sync-note">
            当前初始化时已关闭
            `enableUserInfoSync`。此时你仍可手动调用资料接口，但消息不会携带版本时间，也不会触发消息驱动的资料补位事件。
          </div>
        ) : null}
      </div>

      <div className="card">
        <div className="card-title">手动操作</div>
        <div className="presence-section">
          <div className="presence-section-title">用户资料接口</div>
          <div className="form-group">
            <label htmlFor="profile-sync-user-ids">查询 userId</label>
            <textarea
              id="profile-sync-user-ids"
              rows={3}
              placeholder="alice,bob 或一行一个 userId"
              value={userIdQuery}
              onChange={handleInputChange(setUserIdQuery)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="profile-sync-attributes">查询字段</label>
            <input
              id="profile-sync-attributes"
              value={attributeQuery}
              onChange={handleInputChange(setAttributeQuery)}
              placeholder={DEFAULT_ATTRIBUTE_QUERY}
            />
          </div>
          <button
            className="btn btn-primary"
            type="button"
            disabled={isBusy}
            onClick={toClickHandler(handleFetchUserInfoByUserId)}
          >
            按 userId 查询
          </button>
          <button
            className="btn btn-success"
            type="button"
            disabled={isBusy}
            onClick={toClickHandler(handleFetchUserInfoByAttribute)}
          >
            按字段查询
          </button>
        </div>

        <div className="presence-section">
          <div className="presence-section-title">更新当前用户资料</div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="profile-sync-update-nickname">昵称</label>
              <input
                id="profile-sync-update-nickname"
                value={updateNickname}
                onChange={handleInputChange(setUpdateNickname)}
                placeholder="新的昵称"
              />
            </div>
            <div className="form-group">
              <label htmlFor="profile-sync-update-avatar">头像 URL</label>
              <input
                id="profile-sync-update-avatar"
                value={updateAvatarUrl}
                onChange={handleInputChange(setUpdateAvatarUrl)}
                placeholder="https://..."
              />
            </div>
            <div className="form-group">
              <label htmlFor="profile-sync-update-sign">签名</label>
              <input
                id="profile-sync-update-sign"
                value={updateSign}
                onChange={handleInputChange(setUpdateSign)}
                placeholder="新的签名"
              />
            </div>
            <div className="form-group">
              <label htmlFor="profile-sync-update-ext">ext</label>
              <input
                id="profile-sync-update-ext"
                value={updateExt}
                onChange={handleInputChange(setUpdateExt)}
                placeholder="自定义扩展"
              />
            </div>
          </div>
          <button
            className="btn btn-primary"
            type="button"
            disabled={isBusy}
            onClick={toClickHandler(handleUpdateOwnInfo)}
          >
            整体更新我的资料
          </button>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="profile-sync-single-attribute">单字段</label>
              <select
                id="profile-sync-single-attribute"
                value={singleAttribute}
                onChange={handleAttributeChange}
              >
                {USER_INFO_ATTRIBUTES.map(attribute => (
                  <option key={attribute} value={attribute}>
                    {attribute}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="profile-sync-single-value">字段值</label>
              <input
                id="profile-sync-single-value"
                value={singleAttributeValue}
                onChange={handleInputChange(setSingleAttributeValue)}
                placeholder="空字符串可用于清空字段"
              />
            </div>
          </div>
          <button
            className="btn btn-success"
            type="button"
            disabled={isBusy}
            onClick={toClickHandler(handleUpdateOwnInfoByAttribute)}
          >
            单字段更新我的资料
          </button>
        </div>

        <div className="presence-section">
          <div className="presence-section-title">群名片调试</div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="profile-sync-group-id">群组 ID</label>
              <input
                id="profile-sync-group-id"
                value={groupId}
                onChange={handleInputChange(setGroupId)}
                placeholder="群组 ID"
              />
            </div>
            <div className="form-group">
              <label htmlFor="profile-sync-group-user-id">群成员 userId</label>
              <input
                id="profile-sync-group-user-id"
                value={groupMemberUserId}
                onChange={handleInputChange(setGroupMemberUserId)}
                placeholder="默认回填当前用户"
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="profile-sync-group-keys">本地展示字段过滤</label>
            <input
              id="profile-sync-group-keys"
              value={groupAttributeKeys}
              onChange={handleInputChange(setGroupAttributeKeys)}
              placeholder="从 /users 返回结果里本地筛选字段"
            />
          </div>
          <button
            className="btn btn-primary"
            type="button"
            disabled={isBusy}
            onClick={toClickHandler(handleGetGroupMemberAttributes)}
          >
            查询群成员属性
          </button>
          <div className="form-group">
            <label htmlFor="profile-sync-group-namecard">新的群名片</label>
            <input
              id="profile-sync-group-namecard"
              value={groupNamecard}
              onChange={handleInputChange(setGroupNamecard)}
              placeholder="写入当前登录用户的 nameCard"
            />
          </div>
          <button
            className="btn btn-success"
            type="button"
            disabled={isBusy}
            onClick={toClickHandler(handleUpdateGroupNamecard)}
          >
            更新群名片
          </button>
        </div>

        <div className="profile-sync-result">
          <div className="presence-result-label">
            最近操作结果 {pendingAction ? `（执行中: ${pendingAction}）` : ''}
          </div>
          <pre>{lastResult}</pre>
        </div>
      </div>

      <div className="card">
        <div className="card-title">事件流</div>
        <button className="btn btn-warning" type="button" onClick={onClearEvents}>
          清空事件记录
        </button>
        <div className="presence-section">
          <div className="presence-section-title">用户资料事件</div>
          <div className="profile-sync-list">
            {userInfoEvents.length === 0 ? (
              <div className="profile-sync-empty">
                暂无 `onOwnInfoUpdated / onUserInfoUpdated` 事件
              </div>
            ) : (
              userInfoEvents.map(record => (
                <div className="profile-sync-item" key={record.id}>
                  <div className="profile-sync-item-title">
                    <span>{record.kind === 'self' ? 'onOwnInfoUpdated' : 'onUserInfoUpdated'}</span>
                    <span className="profile-sync-item-time">{record.time}</span>
                  </div>
                  <div className="profile-sync-item-meta">
                    命中用户: {summarizeUserInfoPayload(record.payload)}
                  </div>
                  <div className="profile-sync-item-json">{safeJsonStringify(record.payload)}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="presence-section">
          <div className="presence-section-title">群名片事件</div>
          <div className="profile-sync-list">
            {groupNamecardEvents.length === 0 ? (
              <div className="profile-sync-empty">暂无 `onUserGroupNamecardUpdated` 事件</div>
            ) : (
              groupNamecardEvents.map(record => (
                <div className="profile-sync-item" key={record.id}>
                  <div className="profile-sync-item-title">
                    <span>onUserGroupNamecardUpdated</span>
                    <span className="profile-sync-item-time">{record.time}</span>
                  </div>
                  <div className="profile-sync-item-meta">
                    groupId={record.payload.groupId} userId={record.payload.userId}
                  </div>
                  <div className="profile-sync-item-json">namecard={record.payload.namecard}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">缓存快照</div>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="profile-sync-cache-keyword">过滤关键词</label>
            <input
              id="profile-sync-cache-keyword"
              value={cacheKeyword}
              onChange={handleInputChange(setCacheKeyword)}
              placeholder="userId / nickname / namecard"
            />
          </div>
          <div className="form-group">
            <label htmlFor="profile-sync-cache-group-filter">群名片过滤 groupId</label>
            <input
              id="profile-sync-cache-group-filter"
              value={groupId}
              onChange={handleInputChange(setGroupId)}
              placeholder="留空查看所有群"
            />
          </div>
        </div>

        <div className="presence-section">
          <div className="form-row">
            <div className="presence-section-title">用户资料缓存</div>
            <button
              className="btn btn-danger"
              type="button"
              disabled={isBusy || filteredUserInfoIds.length === 0}
              onClick={toClickHandler(handleClearFilteredUserInfoCache)}
            >
              清除当前过滤结果
            </button>
          </div>
          <div className="profile-sync-list">
            {filteredUserInfoSummaries.length === 0 ? (
              <div className="profile-sync-empty">没有匹配的用户资料缓存</div>
            ) : (
              filteredUserInfoSummaries.slice(0, LIST_LIMIT).map((item: UserInfoSummaryRecord) => (
                <div className="profile-sync-item" key={item.userId}>
                  <div className="profile-sync-item-title">
                    <span>{item.userId}</span>
                    <span className="profile-sync-item-time">
                      最近更新: {formatTime(item.lastUpdate)}
                    </span>
                  </div>
                  <div className="profile-sync-item-meta">
                    nickname={item.nickname ?? '-'} sign={item.sign ?? '-'}
                  </div>
                  <div className="profile-sync-item-json">
                    version={formatVersion(item.userInfoUpdateTime)} lastSyncAt=
                    {formatTime(item.lastSyncAt)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="presence-section">
          <div className="form-row">
            <div className="presence-section-title">群名片缓存</div>
            <button
              className="btn btn-danger"
              type="button"
              disabled={isBusy || filteredGroupNamecardTargets.length === 0}
              onClick={toClickHandler(handleClearFilteredGroupNamecardCache)}
            >
              清除当前过滤结果
            </button>
          </div>
          <div className="profile-sync-list">
            {filteredGroupNamecards.length === 0 ? (
              <div className="profile-sync-empty">没有匹配的群名片缓存</div>
            ) : (
              filteredGroupNamecards.slice(0, LIST_LIMIT).map((item: GroupNamecardRecord) => (
                <div className="profile-sync-item" key={`${item.groupId}-${item.userId}`}>
                  <div className="profile-sync-item-title">
                    <span>
                      {item.groupId} / {item.userId}
                    </span>
                    <span className="profile-sync-item-time">
                      最近更新: {formatTime(item.lastUpdate)}
                    </span>
                  </div>
                  <div className="profile-sync-item-meta">
                    namecard={item.namecard || '(空名片)'}
                  </div>
                  <div className="profile-sync-item-json">
                    version={formatVersion(item.namecardUpdateTime)} lastSyncAt=
                    {formatTime(item.lastSyncAt)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">消息版本调试</div>
        <div className="profile-sync-list">
          {recentMessages.length === 0 ? (
            <div className="profile-sync-empty">暂无消息，可先去“发送消息”页发送或等待接收</div>
          ) : (
            recentMessages.map((message: MessageRecord) => {
              const sidecar = getMessageProfileVersionSidecar(message);
              const cachedGroupNamecard =
                message.conversationType === 'groupChat'
                  ? resolveCachedGroupNamecard(message.conversationId, message.sender.userId)
                  : null;
              return (
                <div className="profile-sync-item" key={message.msgServerId || message.msgLocalId}>
                  <div className="profile-sync-item-title">
                    <span>
                      {message.direct ?? '-'} / {message.conversationType} / {message.type}
                    </span>
                    <span className="profile-sync-item-time">{formatTime(message.timestamp)}</span>
                  </div>
                  <div className="profile-sync-item-meta">
                    conversationId={message.conversationId} sender={message.sender.userId}
                  </div>
                  <div className="profile-sync-item-json">
                    sender.nickname={message.sender.nickname ?? '-'} sender.avatarUrl=
                    {message.sender.avatarUrl ?? '-'}
                  </div>
                  <div className="profile-sync-item-json">
                    userInfoUpdateTime={formatVersion(sidecar?.userInfoUpdateTime)}{' '}
                    namecardUpdateTime=
                    {formatVersion(sidecar?.namecardUpdateTime)}
                  </div>
                  {cachedGroupNamecard ? (
                    <div className="profile-sync-item-json">
                      当前缓存群名片={cachedGroupNamecard.namecard} (
                      {formatVersion(cachedGroupNamecard.namecardUpdateTime)})
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-title">会话列表 sender 调试</div>
        <div className="profile-sync-list">
          {recentConversations.length === 0 ? (
            <div className="profile-sync-empty">
              暂无会话列表项，可等待收到消息或切到“会话列表”页触发刷新
            </div>
          ) : (
            recentConversations.map((conversation: ConversationItemRecord) => (
              <div
                className="profile-sync-item"
                key={`${conversation.conversationType}-${conversation.conversationId}`}
              >
                <div className="profile-sync-item-title">
                  <span>
                    {conversation.conversationId} / {conversation.conversationType}
                  </span>
                  <span className="profile-sync-item-time">
                    最近更新: {formatTime(conversation.lastMessageAt)}
                  </span>
                </div>
                <div className="profile-sync-item-meta">
                  unread={conversation.unreadCount} pinned={String(Boolean(conversation.isPinned))}
                </div>
                <div className="profile-sync-item-json">
                  conversationName={conversation.conversationName} conversationAvatar=
                  {conversation.conversationAvatar ?? '-'}
                </div>
                <div className="profile-sync-item-json">
                  lastMessage.sender.nickname={conversation.lastMessage?.sender.nickname ?? '-'}{' '}
                  lastMessage.sender.avatarUrl=
                  {conversation.lastMessage?.sender.avatarUrl ?? '-'}
                </div>
                <div className="profile-sync-item-json">
                  lastMessage.body={safeJsonStringify(conversation.lastMessage?.body ?? null)}
                </div>
                <div className="profile-sync-item-json">
                  lastMessage.userInfoUpdateTime=
                  {formatVersion(conversation.lastMessage?.userInfoUpdateTime)}{' '}
                  lastMessage.namecardUpdateTime=
                  {formatVersion(conversation.lastMessage?.namecardUpdateTime)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
