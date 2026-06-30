import { useState } from 'react';
import type { ChangeEvent } from 'react';
import type { DemoClient, LogType } from '../types';
import { formatError, safeJsonStringify, withTimeout } from '../utils';

export interface ChatThreadPanelProps {
  readonly client: DemoClient | null;
  readonly onAddLog: (type: LogType, message: string) => void;
  readonly defaultParentId?: string;
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

export const ChatThreadPanel = (props: ChatThreadPanelProps): JSX.Element => {
  const { client, onAddLog, defaultParentId } = props;
  const [parentId, setParentId] = useState(defaultParentId ?? '');
  const [chatThreadId, setChatThreadId] = useState('');
  const [threadName, setThreadName] = useState('Topic A');
  const [messageId, setMessageId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [pageSize, setPageSize] = useState('20');
  const [cursor, setCursor] = useState('');
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
    // eslint-disable-next-line no-console -- demo 需要把 ChatThreadManager / ChatThread 返回值直接打印到浏览器控制台
    console.log(`[ChatThreadDemo] ${label} 返回`, response);
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
      console.error(`[ChatThreadDemo] ${label} 失败`, error);
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

  const parsePageSize = (): number => {
    const parsed = Number.parseInt(pageSize, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
  };

  const getTrimmedParentId = (): string | null => {
    const trimmed = parentId.trim();
    if (!trimmed) {
      onAddLog('warn', '请输入父群 ID');
      return null;
    }
    return trimmed;
  };

  const getTrimmedChatThreadId = (): string | null => {
    const trimmed = chatThreadId.trim();
    if (!trimmed) {
      onAddLog('warn', '请输入 thread ID');
      return null;
    }
    return trimmed;
  };

  const handleCreateThread = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const trimmedParentId = getTrimmedParentId();
    if (!trimmedParentId) {
      return;
    }

    const trimmedName = threadName.trim();
    if (!trimmedName) {
      onAddLog('warn', '请输入 thread 名称');
      return;
    }

    const trimmedMessageId = messageId.trim();
    if (!trimmedMessageId) {
      onAddLog('warn', '请输入父消息 ID');
      return;
    }

    await runAction(
      '创建 thread',
      () =>
        readyClient.chatThreadManager.createChatThread({
          parentId: trimmedParentId,
          name: trimmedName,
          messageId: trimmedMessageId,
        }),
      response => {
        setChatThreadId(response.chatThreadId);
        onAddLog('info', `已将 threadId 自动填充为 ${response.chatThreadId}`);
      }
    );
  };

  const handleGetJoinedThreads = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    await runAction(
      '获取已加入 thread 列表',
      () =>
        readyClient.chatThreadManager.getJoinedChatThreadList({
          parentId: parentId.trim() || undefined,
          pageSize: parsePageSize(),
          cursor: cursor.trim() || undefined,
        }),
      response => {
        setCursor(response.cursor);
        const first = response.items[0];
        if (first) {
          setChatThreadId(first.chatThreadId);
          setParentId(first.parentId);
          onAddLog('info', `已自动填充 threadId=${first.chatThreadId} parentId=${first.parentId}`);
        }
      }
    );
  };

  const handleGetThreadList = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const trimmedParentId = getTrimmedParentId();
    if (!trimmedParentId) {
      return;
    }

    await runAction(
      '获取群下 thread 列表',
      () =>
        readyClient.chatThreadManager.getChatThreadList({
          parentId: trimmedParentId,
          pageSize: parsePageSize(),
          cursor: cursor.trim() || undefined,
        }),
      response => {
        setCursor(response.cursor);
        const first = response.items[0];
        if (first) {
          setChatThreadId(first.chatThreadId);
          onAddLog('info', `已将 threadId 自动填充为 ${first.chatThreadId}`);
        }
      }
    );
  };

  const handleGetInfo = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const trimmedChatThreadId = getTrimmedChatThreadId();
    if (!trimmedChatThreadId) {
      return;
    }

    await runAction('chatThread.getInfo', () =>
      readyClient.chatThreadManager.getChatThread(trimmedChatThreadId).getInfo()
    );
  };

  const handleJoin = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const trimmedChatThreadId = getTrimmedChatThreadId();
    if (!trimmedChatThreadId) {
      return;
    }

    await runAction('chatThread.join', () =>
      readyClient.chatThreadManager.getChatThread(trimmedChatThreadId).join()
    );
  };

  const handleLeave = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const trimmedChatThreadId = getTrimmedChatThreadId();
    if (!trimmedChatThreadId) {
      return;
    }

    await runAction('chatThread.leave', () =>
      readyClient.chatThreadManager.getChatThread(trimmedChatThreadId).leave()
    );
  };

  const handleDestroy = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const trimmedChatThreadId = getTrimmedChatThreadId();
    if (!trimmedChatThreadId) {
      return;
    }

    await runAction('chatThread.destroy', () =>
      readyClient.chatThreadManager.getChatThread(trimmedChatThreadId).destroy()
    );
  };

  const handleUpdateName = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const trimmedChatThreadId = getTrimmedChatThreadId();
    if (!trimmedChatThreadId) {
      return;
    }

    const trimmedName = threadName.trim();
    if (!trimmedName) {
      onAddLog('warn', '请输入 thread 名称');
      return;
    }

    await runAction('chatThread.updateName', () =>
      readyClient.chatThreadManager.getChatThread(trimmedChatThreadId).updateName({
        name: trimmedName,
      })
    );
  };

  const handleGetMembers = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const trimmedChatThreadId = getTrimmedChatThreadId();
    if (!trimmedChatThreadId) {
      return;
    }

    await runAction(
      'chatThread.getMemberList',
      () =>
        readyClient.chatThreadManager.getChatThread(trimmedChatThreadId).getMemberList({
          pageSize: parsePageSize(),
          cursor: cursor.trim() || undefined,
        }),
      response => {
        setCursor(response.cursor);
      }
    );
  };

  const handleRemoveMember = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const trimmedChatThreadId = getTrimmedChatThreadId();
    if (!trimmedChatThreadId) {
      return;
    }

    const trimmedMemberId = memberId.trim();
    if (!trimmedMemberId) {
      onAddLog('warn', '请输入成员 ID');
      return;
    }

    await runAction('chatThread.removeMember', () =>
      readyClient.chatThreadManager.getChatThread(trimmedChatThreadId).removeMember({
        memberId: trimmedMemberId,
      })
    );
  };

  const handleGetLastMessages = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const trimmedChatThreadId = getTrimmedChatThreadId();
    if (!trimmedChatThreadId) {
      return;
    }

    await runAction('getChatThreadLastMessageList', () =>
      readyClient.chatThreadManager.getChatThreadLastMessageList({
        chatThreadIds: [trimmedChatThreadId],
      })
    );
  };

  return (
    <div className="card">
      <div className="card-title">ChatThreadManager / ChatThread 调试</div>
      <p className="push-note">
        本面板用于演示 `chatThreadManager` 与 `chatThread` 的主路径调用。所有返回值都会打印到浏览器
        console。
      </p>

      <div className="push-grid">
        <section className="push-section">
          <h3>列表 / 创建</h3>
          <div className="form-group">
            <label htmlFor="thread-parent-id">parentId</label>
            <input
              id="thread-parent-id"
              placeholder="例如：group-1"
              value={parentId}
              onChange={handleInputChange(setParentId)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="thread-page-size">pageSize</label>
            <input
              id="thread-page-size"
              value={pageSize}
              onChange={handleInputChange(setPageSize)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="thread-cursor">cursor</label>
            <input
              id="thread-cursor"
              value={cursor}
              onChange={handleInputChange(setCursor)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="thread-name">name</label>
            <input
              id="thread-name"
              value={threadName}
              onChange={handleInputChange(setThreadName)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="thread-message-id">messageId</label>
            <input
              id="thread-message-id"
              placeholder="父消息 ID"
              value={messageId}
              onChange={handleInputChange(setMessageId)}
            />
          </div>
          <button className="btn btn-primary" disabled={isBusy} onClick={toClickHandler(handleGetJoinedThreads)}>
            getJoinedChatThreadList
          </button>
          <button className="btn btn-primary" disabled={isBusy} onClick={toClickHandler(handleGetThreadList)}>
            getChatThreadList
          </button>
          <button className="btn btn-success" disabled={isBusy} onClick={toClickHandler(handleCreateThread)}>
            createChatThread
          </button>
        </section>

        <section className="push-section">
          <h3>单 thread 上下文</h3>
          <div className="form-group">
            <label htmlFor="thread-id">chatThreadId</label>
            <input
              id="thread-id"
              placeholder="例如：thread-1"
              value={chatThreadId}
              onChange={handleInputChange(setChatThreadId)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="thread-member-id">memberId</label>
            <input
              id="thread-member-id"
              placeholder="移除成员时使用"
              value={memberId}
              onChange={handleInputChange(setMemberId)}
            />
          </div>
          <button className="btn btn-primary" disabled={isBusy} onClick={toClickHandler(handleGetInfo)}>
            chatThread.getInfo
          </button>
          <button className="btn btn-primary" disabled={isBusy} onClick={toClickHandler(handleJoin)}>
            chatThread.join
          </button>
          <button className="btn btn-primary" disabled={isBusy} onClick={toClickHandler(handleLeave)}>
            chatThread.leave
          </button>
          <button className="btn btn-primary" disabled={isBusy} onClick={toClickHandler(handleGetMembers)}>
            chatThread.getMemberList
          </button>
          <button className="btn btn-primary" disabled={isBusy} onClick={toClickHandler(handleUpdateName)}>
            chatThread.updateName
          </button>
          <button className="btn btn-warning" disabled={isBusy} onClick={toClickHandler(handleGetLastMessages)}>
            getChatThreadLastMessageList
          </button>
          <button className="btn btn-warning" disabled={isBusy} onClick={toClickHandler(handleRemoveMember)}>
            chatThread.removeMember
          </button>
          <button className="btn btn-danger" disabled={isBusy} onClick={toClickHandler(handleDestroy)}>
            chatThread.destroy
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
