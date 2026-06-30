import { useState } from 'react';
import type { ConversationItemRecord, DemoClient, LogType } from '../types';
import { formatError, safeJsonStringify, withTimeout } from '../utils';

export interface SessionListPanelProps {
  readonly client: DemoClient | null;
  readonly sessions: ReadonlyArray<ConversationItemRecord>;
  readonly capabilityLabel?: string;
  readonly onAddLog: (type: LogType, message: string) => void;
  readonly onClear: () => void;
}

const API_TIMEOUT = 15000;

const formatTimestamp = (value?: number): string => {
  if (!value || !Number.isFinite(value)) {
    return '未知时间';
  }
  return new Date(value).toLocaleString();
};

const formatJson = (value: unknown): string => {
  return safeJsonStringify(value) || '{}';
};

const resolveLastMessageText = (item: ConversationItemRecord): string => {
  if (!item.lastMessage) {
    return '无最后消息';
  }
  const body = item.lastMessage.body;
  if (typeof body.content === 'string' && body.content.trim()) {
    return body.content;
  }
  return item.lastMessage.msgServerId;
};

const resolveSessionIdLabel = (item: ConversationItemRecord): string => {
  if (item.conversationType === 'groupChat') {
    return 'groupId';
  }
  if (item.conversationType === 'chatRoom') {
    return 'roomId';
  }
  return 'peerId';
};

const resolveLastMessageSender = (item: ConversationItemRecord): string => {
  const sender = item.lastMessage?.sender;
  if (!sender) {
    return '-';
  }
  if (typeof sender === 'string') {
    return sender;
  }
  return sender.nickname || sender.userId || '-';
};

export const SessionListPanel = (props: SessionListPanelProps): JSX.Element => {
  const { client, sessions, capabilityLabel, onAddLog, onClear } = props;
  const [pendingAction, setPendingAction] = useState<string | null>(null);

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

  const runAction = async (label: string, operation: () => Promise<unknown>): Promise<void> => {
    if (pendingAction) {
      return;
    }
    setPendingAction(label);
    try {
      const result = await withTimeout(operation(), API_TIMEOUT, label);
      // eslint-disable-next-line no-console -- demo 需要直接输出会话列表刷新结果便于联调
      console.log(`[SessionListDemo] ${label} 返回`, result);
      onAddLog('success', `${label}成功`);
      if (result !== undefined) {
        onAddLog('info', `${label}返回: ${safeJsonStringify(result)}`);
      }
    } catch (error) {
      // eslint-disable-next-line no-console -- demo 需要直接输出失败详情
      console.error(`[SessionListDemo] ${label} 失败`, error);
      onAddLog('error', `${label}失败: ${formatError(error)}`);
    } finally {
      setPendingAction(null);
    }
  };

  const handleRefresh = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }
    await runAction('refreshSessionList', () => readyClient.chatManager.refreshSessionList());
  };

  return (
    <div className="card" data-testid="session-list-panel">
      <div className="card-title">新会话列表 ConversationItem</div>
      <p>说明：本面板展示 035 新链路的 ConversationItem 读取结果；旧会话列表仍保留在“会话列表”面板。</p>
      <p>capability: {capabilityLabel ?? 'unknown'}</p>
      <div className="button-group">
        <button type="button" onClick={handleRefresh} disabled={pendingAction !== null}>
          {pendingAction === 'refreshSessionList' ? '刷新中…' : 'refreshSessionList'}
        </button>
        <button type="button" onClick={onClear}>
          清空面板数据
        </button>
      </div>
      {sessions.length === 0 ? (
        <div className="conversation-empty">暂无会话</div>
      ) : (
        <div className="conversation-list" data-testid="session-list-panel-list">
          {sessions.map(item => (
            <article key={`${item.conversationType}:${item.conversationId}`} className="conversation-item">
              <div className="conversation-item-header">
                <strong>{item.conversationName}</strong>
                <span className="conversation-item-divider">·</span>
                <span className="conversation-item-type">{item.conversationType}</span>
              </div>
              <div>{resolveSessionIdLabel(item)}: {item.conversationId}</div>
              <div>unread: {item.unreadCount}</div>
              <div>remindType: {item.remindType}</div>
              <div>isPinned: {String(item.isPinned ?? false)}</div>
              <div>pinnedTimestamp: {formatTimestamp(item.pinnedTimestamp)}</div>
              <div>readAt: {formatTimestamp(item.readAt)}</div>
              <div>marks: {item.marks.length > 0 ? item.marks.join(', ') : '[]'}</div>
              <div>conversationAvatar: {item.conversationAvatar ?? '-'}</div>
              <div>lastMessage: {resolveLastMessageText(item)}</div>
              <div>lastMessageAt: {formatTimestamp(item.lastMessageAt)}</div>
              {item.lastMessage ? (
                <>
                  <div>lastMessageId: {item.lastMessage.msgServerId}</div>
                  <div>lastMessageFrom: {item.lastMessage.from || '-'}</div>
                  <div>lastMessageTo: {item.lastMessage.to || '-'}</div>
                  <div>lastMessageSender: {resolveLastMessageSender(item)}</div>
                  <div>lastMessageTimestamp: {formatTimestamp(item.lastMessage.timestamp)}</div>
                  <div>lastMessageBody: {formatJson(item.lastMessage.body)}</div>
                </>
              ) : (
                <div>lastMessageBody: -</div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
