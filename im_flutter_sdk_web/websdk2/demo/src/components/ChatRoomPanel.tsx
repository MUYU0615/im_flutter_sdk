import { useState } from 'react';
import type { ChangeEvent } from 'react';
import type { DemoClient, LogType } from '../types';
import { formatError, safeJsonStringify, withTimeout } from '../utils';

export interface ChatRoomPanelProps {
  readonly client: DemoClient | null;
  readonly onAddLog: (type: LogType, message: string) => void;
  readonly defaultChatRoomId?: string;
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

export const ChatRoomPanel = (props: ChatRoomPanelProps): JSX.Element => {
  const { client, onAddLog, defaultChatRoomId } = props;
  const [chatRoomId, setChatRoomId] = useState(defaultChatRoomId ?? '');
  const [attributeKeys, setAttributeKeys] = useState('');
  const [pageNum, setPageNum] = useState('1');
  const [pageSize, setPageSize] = useState('20');
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
    // eslint-disable-next-line no-console -- demo 需要把 ChatRoomManager / ChatRoom 返回值直接打印到浏览器控制台
    console.log(`[ChatRoomDemo] ${label} 返回`, response);
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
      console.error(`[ChatRoomDemo] ${label} 失败`, error);
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

  const getTrimmedChatRoomId = (): string | null => {
    const trimmedChatRoomId = chatRoomId.trim();
    if (!trimmedChatRoomId) {
      onAddLog('warn', '请输入聊天室 ID');
      return null;
    }
    return trimmedChatRoomId;
  };

  const parseAttributeKeys = (): ReadonlyArray<string> | undefined => {
    const keys = attributeKeys
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
    return keys.length > 0 ? keys : undefined;
  };

  const handleGetChatRoomList = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    await runAction('获取公开聊天室列表', () =>
      readyClient.chatRoomManager.getChatRoomList({
        pageNum: parsePageValue(pageNum, 1),
        pageSize: parsePageValue(pageSize, 20),
      })
    );
  };

  const handlePickChatRoomFromList = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    await runAction(
      '获取公开聊天室列表并填充 chatRoomId',
      () =>
        readyClient.chatRoomManager.getChatRoomList({
          pageNum: parsePageValue(pageNum, 1),
          pageSize: parsePageValue(pageSize, 20),
        }),
      response => {
        const firstChatRoomId = response.items[0]?.chatRoomId;
        if (firstChatRoomId) {
          setChatRoomId(firstChatRoomId);
          onAddLog('info', `已将 chatRoomId 自动填充为 ${firstChatRoomId}`);
        }
      }
    );
  };

  const handleGetInfo = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const trimmedChatRoomId = getTrimmedChatRoomId();
    if (!trimmedChatRoomId) {
      return;
    }

    await runAction('通过 ChatRoom 获取详情', () =>
      readyClient.chatRoomManager.getChatRoom(trimmedChatRoomId).getInfo()
    );
  };

  const handleGetMembers = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const trimmedChatRoomId = getTrimmedChatRoomId();
    if (!trimmedChatRoomId) {
      return;
    }

    await runAction('通过 ChatRoom 获取成员列表', () =>
      readyClient.chatRoomManager.getChatRoom(trimmedChatRoomId).getMembers({
        pageSize: parsePageValue(pageSize, 20),
      })
    );
  };

  const handleGetAdmins = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const trimmedChatRoomId = getTrimmedChatRoomId();
    if (!trimmedChatRoomId) {
      return;
    }

    await runAction('通过 ChatRoom 获取管理员列表', () =>
      readyClient.chatRoomManager.getChatRoom(trimmedChatRoomId).getAdminList()
    );
  };

  const handleGetMuteList = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const trimmedChatRoomId = getTrimmedChatRoomId();
    if (!trimmedChatRoomId) {
      return;
    }

    await runAction('通过 ChatRoom 获取禁言列表', () =>
      readyClient.chatRoomManager.getChatRoom(trimmedChatRoomId).getMuteList()
    );
  };

  const handleGetAllowlist = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const trimmedChatRoomId = getTrimmedChatRoomId();
    if (!trimmedChatRoomId) {
      return;
    }

    await runAction('通过 ChatRoom 获取 allowlist', () =>
      readyClient.chatRoomManager.getChatRoom(trimmedChatRoomId).getAllowlist()
    );
  };

  const handleCheckIfInAllowList = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const trimmedChatRoomId = getTrimmedChatRoomId();
    if (!trimmedChatRoomId) {
      return;
    }

    await runAction('通过 ChatRoom 查询当前用户是否在 allowlist', () =>
      readyClient.chatRoomManager.getChatRoom(trimmedChatRoomId).checkIfInAllowList()
    );
  };

  const handleGetBlocklist = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const trimmedChatRoomId = getTrimmedChatRoomId();
    if (!trimmedChatRoomId) {
      return;
    }

    await runAction('通过 ChatRoom 获取黑名单', () =>
      readyClient.chatRoomManager.getChatRoom(trimmedChatRoomId).getBlocklist()
    );
  };

  const handleIsCurrentUserMuted = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const trimmedChatRoomId = getTrimmedChatRoomId();
    if (!trimmedChatRoomId) {
      return;
    }

    await runAction('通过 ChatRoom 查询当前用户禁言状态', () =>
      readyClient.chatRoomManager.getChatRoom(trimmedChatRoomId).checkIfInMuteList()
    );
  };

  const handleGetAnnouncement = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const trimmedChatRoomId = getTrimmedChatRoomId();
    if (!trimmedChatRoomId) {
      return;
    }

    await runAction('通过 ChatRoom 获取公告', () =>
      readyClient.chatRoomManager.getChatRoom(trimmedChatRoomId).getAnnouncement()
    );
  };

  const handleGetAttributes = async (): Promise<void> => {
    const readyClient = ensureClientReady();
    if (!readyClient) {
      return;
    }

    const trimmedChatRoomId = getTrimmedChatRoomId();
    if (!trimmedChatRoomId) {
      return;
    }

    await runAction('通过 ChatRoom 获取属性', () =>
      readyClient.chatRoomManager.getChatRoom(trimmedChatRoomId).getAttributes({
        keys: parseAttributeKeys(),
      })
    );
  };

  return (
    <div className="card">
      <div className="card-title">ChatRoomManager / ChatRoom 调试</div>
      <p className="push-note">
        本面板用于演示 `chatRoomManager.getChatRoomList()` 和
        `chatRoomManager.getChatRoom(chatRoomId)` 的常见调用。所有返回值都会打印到浏览器
        console。
      </p>

      <div className="push-grid">
        <label className="field">
          <span>chatRoomId</span>
          <input
            value={chatRoomId}
            onChange={handleInputChange(setChatRoomId)}
            placeholder="请输入聊天室 ID"
          />
        </label>

        <label className="field">
          <span>pageNum</span>
          <input value={pageNum} onChange={handleInputChange(setPageNum)} placeholder="1" />
        </label>

        <label className="field">
          <span>pageSize</span>
          <input value={pageSize} onChange={handleInputChange(setPageSize)} placeholder="20" />
        </label>

        <label className="field field-full">
          <span>属性 keys（逗号分隔，可选）</span>
          <input
            value={attributeKeys}
            onChange={handleInputChange(setAttributeKeys)}
            placeholder="topic,notice"
          />
        </label>
      </div>

      <div className="action-group">
        <button onClick={toClickHandler(handleGetChatRoomList)} disabled={isBusy} type="button">
          获取公开聊天室列表
        </button>
        <button
          onClick={toClickHandler(handlePickChatRoomFromList)}
          disabled={isBusy}
          type="button"
        >
          获取列表并填充 ID
        </button>
        <button onClick={toClickHandler(handleGetInfo)} disabled={isBusy} type="button">
          获取聊天室详情
        </button>
        <button onClick={toClickHandler(handleGetMembers)} disabled={isBusy} type="button">
          获取成员列表
        </button>
        <button onClick={toClickHandler(handleGetAdmins)} disabled={isBusy} type="button">
          获取管理员列表
        </button>
        <button onClick={toClickHandler(handleGetMuteList)} disabled={isBusy} type="button">
          获取禁言列表
        </button>
        <button onClick={toClickHandler(handleIsCurrentUserMuted)} disabled={isBusy} type="button">
          查询当前用户禁言状态
        </button>
        <button onClick={toClickHandler(handleGetAllowlist)} disabled={isBusy} type="button">
          获取 allowlist
        </button>
        <button onClick={toClickHandler(handleCheckIfInAllowList)} disabled={isBusy} type="button">
          查询当前用户是否在 allowlist
        </button>
        <button onClick={toClickHandler(handleGetBlocklist)} disabled={isBusy} type="button">
          获取黑名单
        </button>
        <button onClick={toClickHandler(handleGetAnnouncement)} disabled={isBusy} type="button">
          获取公告
        </button>
        <button onClick={toClickHandler(handleGetAttributes)} disabled={isBusy} type="button">
          获取属性
        </button>
      </div>

      <label className="field field-full">
        <span>最近一次返回</span>
        <textarea value={lastResponse} readOnly rows={18} />
      </label>

      {pendingAction ? <p className="push-note">执行中：{pendingAction}</p> : null}
    </div>
  );
};
