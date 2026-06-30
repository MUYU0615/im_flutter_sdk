import { useState } from 'react';
import type { ChangeEvent } from 'react';
import type { ConversationMark } from 'im-sdk-web';
import type { ConversationItemRecord, DemoClient, LogType } from '../types'; // 引入会话类型
import { formatError, safeJsonStringify, withTimeout } from '../utils';

export interface ConversationPanelProps { // 会话面板属性
  readonly client: DemoClient | null;
  readonly conversations: ReadonlyArray<ConversationItemRecord>; // 会话列表
  readonly sourceLabel?: string; // 来源文案
  readonly onClear: () => void; // 清空回调
  readonly onAddLog: (type: LogType, message: string) => void;
} // 接口结束

const API_TIMEOUT = 15000;

const formatTime = (timestamp?: number): string => { // 格式化时间
  if (!timestamp || !Number.isFinite(timestamp)) { // 校验时间
    return '未知时间'; // 返回未知
  } // 判断结束
  return new Date(timestamp).toLocaleString(); // 返回格式化时间
}; // 函数结束

const resolveLastMessageText = (conversation: ConversationItemRecord): string => { // 解析最后消息
  const lastMessage = conversation.lastMessage; // 读取最后消息
  if (!lastMessage) { // 无消息
    return '无最后消息'; // 返回占位
  } // 判断结束
  const body = lastMessage.body; // 读取消息体
  if (typeof body === 'object' && body !== null && 'message' in body) { // 文本消息判断
    const message = (body as Record<string, unknown>).message; // 读取 message 字段
    if (typeof message === 'string' && message.trim()) { // 校验文本
      return message; // 返回文本
    } // 判断结束
  } // 判断结束
  return `${lastMessage.type ?? 'unknown'} / ${lastMessage.msgServerId}`; // 返回摘要
}; // 函数结束

export const ConversationPanel = (props: ConversationPanelProps): JSX.Element => { // 会话面板组件
  const { client, conversations, sourceLabel, onClear, onAddLog } = props; // 解构属性
  const [conversationId, setConversationId] = useState(''); // 当前会话 ID
  const [conversationType, setConversationType] = useState<'singleChat' | 'groupChat' | 'chatRoom'>(
    'singleChat'
  ); // 当前会话类型
  const [mark, setMark] = useState('0'); // 标记值
  const [pendingAction, setPendingAction] = useState<string | null>(null); // 请求中动作
  const label = sourceLabel ? `会话列表（来源: ${sourceLabel}）` : '会话列表'; // 标题文案

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

  const parseMark = (): ConversationMark | null => {
    const parsed = Number.parseInt(mark, 10);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 19) {
      onAddLog('warn', '请输入合法的 mark（0-19）');
      return null;
    }
    return parsed as ConversationMark;
  };

  const getTrimmedConversationId = (): string | null => {
    const trimmed = conversationId.trim();
    if (!trimmed) {
      onAddLog('warn', '请输入会话 ID');
      return null;
    }
    return trimmed;
  };

  const handleInputChange =
    (setter: (value: string) => void) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
      setter(event.target.value);
    };

  const runAction = async (label: string, operation: () => Promise<unknown>): Promise<void> => {
    if (isBusy) {
      return;
    }
    setPendingAction(label);
    try {
      const result = await withTimeout(operation(), API_TIMEOUT, label);
      // eslint-disable-next-line no-console -- demo 需要打印会话查询返回
      console.log(`[ConversationDemo] ${label} 返回`, result);
      onAddLog('success', `${label}成功`);
      if (result !== undefined) {
        onAddLog('info', `${label}返回: ${safeJsonStringify(result)}`);
      }
    } catch (error) {
      // eslint-disable-next-line no-console -- demo 需要在控制台查看失败详情
      console.error(`[ConversationDemo] ${label} 失败`, error);
      onAddLog('error', `${label}失败: ${formatError(error)}`);
    } finally {
      setPendingAction(null);
    }
  };

  const handleRefreshConversationList = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }
    await runAction('getConversationList', () =>
      Promise.resolve(readyClient.chatManager.getConversationList())
    );
  };

  const handleRefreshPinnedConversationList = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }
    await runAction('getPinnedConversationList', () =>
      Promise.resolve(readyClient.chatManager.getConversationList({ isPinned: true }))
    );
  };

  const handleRefreshConversationListByMark = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }
    const parsedMark = parseMark();
    if (parsedMark === null) {
      return;
    }
    await runAction('getConversationListByMark', () =>
      Promise.resolve(readyClient.chatManager.getConversationList({ mark: parsedMark }))
    );
  };

  const handleSetPinned = async (pinned: boolean): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }
    const trimmedConversationId = getTrimmedConversationId();
    if (!trimmedConversationId) {
      return;
    }
    await runAction(pinned ? 'setConversationPinned(true)' : 'setConversationPinned(false)', () =>
      readyClient.chatManager.setConversationPinned({
        conversationId: trimmedConversationId,
        conversationType,
        pinned,
      })
    );
  };

  const handleDeleteConversation = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }
    const trimmedConversationId = getTrimmedConversationId();
    if (!trimmedConversationId) {
      return;
    }
    await runAction('deleteConversation', () =>
      readyClient.chatManager.deleteConversation({
        conversationId: trimmedConversationId,
        conversationType,
        deleteRoamingMessages: false,
      })
    );
  };

  const handleAddMark = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }
    const trimmedConversationId = getTrimmedConversationId();
    if (!trimmedConversationId) {
      return;
    }
    const parsedMark = parseMark();
    if (parsedMark === null) {
      return;
    }
    await runAction('addConversationMark', () =>
      readyClient.chatManager.addConversationMark({
        conversations: [{ conversationId: trimmedConversationId, conversationType }],
        mark: parsedMark,
      })
    );
  };

  const handleRemoveMark = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }
    const trimmedConversationId = getTrimmedConversationId();
    if (!trimmedConversationId) {
      return;
    }
    const parsedMark = parseMark();
    if (parsedMark === null) {
      return;
    }
    await runAction('removeConversationMark', () =>
      readyClient.chatManager.removeConversationMark({
        conversations: [{ conversationId: trimmedConversationId, conversationType }],
        mark: parsedMark,
      })
    );
  };

  const handleClearServerMessagesAndConversations = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }
    await runAction('clearAllMessagesAndConversations', () =>
      readyClient.chatManager.clearAllMessagesAndConversations()
    );
  };

  const renderEmpty = (): JSX.Element => { // 渲染空状态
    return <div className="conversation-empty">暂无会话</div>; // 返回空内容
  }; // 函数结束

  const renderList = (): JSX.Element => { // 渲染会话列表
    if (conversations.length === 0) { // 无会话
      return renderEmpty(); // 返回空状态
    } // 判断结束
    return ( // 返回会话列表
      <> {/* 列表片段 */}
        {conversations.map((conversation): JSX.Element => ( // 遍历会话
          <div className="conversation-item" key={`${conversation.conversationType}-${conversation.conversationId}`}> {/* 会话项 */}
            <div className="conversation-title"> {/* 标题行 */}
              <span className="conversation-id">{conversation.conversationId}</span> {/* 会话 ID */}
              <span className="conversation-type">{conversation.conversationType}</span> {/* 会话类型 */}
              <span className="conversation-unread">未读: {conversation.unreadCount}</span> {/* 未读数 */}
            {/* 标题行结束 */}</div>
            <div className="conversation-meta"> {/* 元信息 */}
              <div>最后消息: {resolveLastMessageText(conversation)}</div> {/* 最后消息 */}
              <div>更新时间: {formatTime(conversation.lastMessageAt)}</div> {/* 更新时间 */}
            {/* 元信息结束 */}</div>
          {/* 会话项结束 */}</div>
        ))} {/* 遍历结束 */}
      {/* 列表片段结束 */}</>
    ); // 返回结束
  }; // 函数结束

  return ( // 返回 UI
    <div className="card" data-testid="legacy-conversation-panel"> {/* 卡片 */}
      <div className="card-title"> {/* 标题 */}
        {label} {/* 标题文案 */}
        <button className="btn btn-warning" onClick={onClear}>清空会话{/* 清空按钮 */}</button>
      {/* 标题结束 */}</div>
      <p className="push-note">
        这是旧会话列表能力面板；035 新 ConversationItem 面板会与本面板并行展示，便于对照联调。
      </p>
      <p className="push-note">
        `getConversationList`、`getPinnedConversationList`、`getConversationListByMark`
        当前均基于本地 session-list 缓存分页/过滤，不再请求旧的会话查询 REST。
      </p>
      <p className="push-note">
        会话 mutation 成功后默认不会自动 patch 当前列表，请手动再次点击查询按钮进行刷新。
      </p>
      <div className="push-grid">
        <section className="push-section">
          <h3>主动刷新</h3>
          <div className="form-group">
            <label htmlFor="conversation-mark">mark</label>
            <input
              id="conversation-mark"
              value={mark}
              onChange={handleInputChange(setMark)}
            />
          </div>
          <button className="btn btn-primary" disabled={isBusy} onClick={(): void => { void handleRefreshConversationList(); }}>
            getConversationList
          </button>
          <button className="btn btn-primary" disabled={isBusy} onClick={(): void => { void handleRefreshPinnedConversationList(); }}>
            getPinnedConversationList
          </button>
          <button className="btn btn-primary" disabled={isBusy} onClick={(): void => { void handleRefreshConversationListByMark(); }}>
            getConversationListByMark
          </button>
        </section>

        <section className="push-section">
          <h3>会话操作</h3>
          <div className="form-group">
            <label htmlFor="conversation-id">conversationId</label>
            <input
              id="conversation-id"
              value={conversationId}
              onChange={handleInputChange(setConversationId)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="conversation-type">type</label>
            <select
              id="conversation-type"
              value={conversationType}
              onChange={handleInputChange(value => {
                setConversationType(value as 'singleChat' | 'groupChat' | 'chatRoom');
              })}
            >
              <option value="singleChat">singleChat</option>
              <option value="groupChat">groupChat</option>
              <option value="chatRoom">chatRoom</option>
            </select>
          </div>
          <button className="btn btn-success" disabled={isBusy} onClick={(): void => { void handleSetPinned(true); }}>
            setConversationPinned(true)
          </button>
          <button className="btn btn-warning" disabled={isBusy} onClick={(): void => { void handleSetPinned(false); }}>
            setConversationPinned(false)
          </button>
          <button className="btn btn-primary" disabled={isBusy} onClick={(): void => { void handleAddMark(); }}>
            addConversationMark
          </button>
          <button className="btn btn-primary" disabled={isBusy} onClick={(): void => { void handleRemoveMark(); }}>
            removeConversationMark
          </button>
          <button className="btn btn-danger" disabled={isBusy} onClick={(): void => { void handleDeleteConversation(); }}>
            deleteConversation
          </button>
          <button className="btn btn-danger" disabled={isBusy} onClick={(): void => { void handleClearServerMessagesAndConversations(); }}>
            clearAllMessagesAndConversations
          </button>
        </section>
      </div>
      <div className="conversation-list" data-testid="legacy-conversation-list"> {/* 会话列表区域 */}
        {pendingAction ? <div className="conversation-empty">执行中: {pendingAction}</div> : null}
        {renderList()} {/* 渲染列表 */}
      {/* 列表区域结束 */}</div>
    {/* 卡片结束 */}</div>
  ); // 返回结束
}; // 组件结束
