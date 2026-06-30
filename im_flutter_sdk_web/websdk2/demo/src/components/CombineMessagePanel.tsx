import { useMemo, useState } from 'react';
import { formatError, withTimeout } from '../utils';
import type { ChannelTypeOption, DemoClient, LogType, MessageRecord } from '../types';

export interface CombineMessagePanelProps {
  readonly client: DemoClient | null;
  readonly messages: ReadonlyArray<MessageRecord>;
  readonly onAddLog: (type: LogType, message: string) => void;
  readonly onAddMessage: (message: MessageRecord) => void;
  readonly defaultTargetId?: string;
  readonly defaultChannelType?: ChannelTypeOption;
}

const SEND_TIMEOUT = 15000;
const MAX_SOURCE_MESSAGES = 100;
const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const getMessageId = (message: MessageRecord): string => {
  return message.msgServerId || message.msgLocalId;
};

const getPreviewText = (message: MessageRecord): string => {
  if (
    message.type === 'text' &&
    isRecord(message.body) &&
    typeof message.body.content === 'string'
  ) {
    return message.body.content;
  }
  if (message.type === 'combine' && isRecord(message.body)) {
    if (typeof message.body.summary === 'string' && message.body.summary.trim()) {
      return message.body.summary;
    }
    if (typeof message.body.title === 'string' && message.body.title.trim()) {
      return message.body.title;
    }
  }
  return `${message.type} 消息`;
};

const toConversationType = (
  channelType: ChannelTypeOption
): 'singleChat' | 'groupChat' | 'chatRoom' => {
  if (channelType === 'group') {
    return 'groupChat';
  }
  if (channelType === 'room') {
    return 'chatRoom';
  }
  return 'singleChat';
};



const parseMessageIds = (value: string): string[] => {
  return value
    .split(/[\n,，\s]+/)
    .map(item => item.trim())
    .filter(item => item.length > 0);
};

export const CombineMessagePanel = (props: CombineMessagePanelProps): JSX.Element => {
  const { client, messages, onAddLog, onAddMessage, defaultTargetId, defaultChannelType } = props;

  const [channelType, setChannelType] = useState<ChannelTypeOption>(defaultChannelType ?? 'single');
  const [targetId, setTargetId] = useState(defaultTargetId ?? '');
  const [title, setTitle] = useState('聊天记录');
  const [summary, setSummary] = useState('');
  const [compatibleText, setCompatibleText] = useState('[聊天记录]');
  const [idInput, setIdInput] = useState('');
  const [selectedIds, setSelectedIds] = useState<ReadonlyArray<string>>([]);
  const [isSending, setIsSending] = useState(false);

  const sourceMessages = useMemo(() => {
    return messages.slice(0, MAX_SOURCE_MESSAGES);
  }, [messages]);

  const messageMap = useMemo(() => {
    const map = new Map<string, MessageRecord>();
    for (const message of messages) {
      const id = getMessageId(message);
      if (id) {
        map.set(id, message);
      }
    }
    return map;
  }, [messages]);

  const toggleSelect = (id: string): void => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      }
      return [...prev, id];
    });
  };

  const handleClearSelection = (): void => {
    setSelectedIds([]);
    setIdInput('');
  };

  const handleSend = async (): Promise<void> => {
    if (!client) {
      onAddLog('warn', '请先初始化 SDK');
      return;
    }

    const connectionState = client.getConnectionState();
    if (connectionState !== 'connected') {
      onAddLog('warn', `请先登录（当前状态: ${connectionState}）`);
      return;
    }

    const trimmedTargetId = targetId.trim();
    if (!trimmedTargetId) {
      onAddLog('warn', '请输入目标 ID');
      return;
    }

    const mergedIds = Array.from(new Set([...selectedIds, ...parseMessageIds(idInput)]));
    if (mergedIds.length === 0) {
      onAddLog('warn', '请先输入或勾选要合并的消息 ID');
      return;
    }

    const missingIds = mergedIds.filter(id => !messageMap.has(id));
    if (missingIds.length > 0) {
      onAddLog('warn', `以下消息 ID 不存在: ${missingIds.join(', ')}`);
      return;
    }

    const list: MessageRecord[] = [];
    for (const id of mergedIds) {
      const message = messageMap.get(id);
      if (!message) {
        continue;
      }
      list.push(message);
    }

    if (list.length === 0) {
      onAddLog('warn', '没有可用于合并的消息');
      return;
    }

    const trimmedTitle = title.trim() || '聊天记录';
    const finalSummary = summary.trim() || `共 ${list.length} 条消息`;

    setIsSending(true);
    try {
      const combineMessage = client.chatManager.createCombineMessage({
        conversationId: trimmedTargetId,
        conversationType: toConversationType(channelType),
        title: trimmedTitle,
        summary: finalSummary,
        compatibleText: compatibleText.trim() || '[聊天记录]',
        messageList: list,
      });

      // eslint-disable-next-line no-console -- demo 需要把发消息时构建出的合并消息对象输出到控制台，便于联调
      console.log('[demo:message] built', {
        type: combineMessage.type,
        msgLocalId: combineMessage.msgLocalId,
        status: combineMessage.status,
        body: combineMessage.body,
        message: combineMessage,
      });
      onAddMessage(combineMessage);
      const sentMessage = await withTimeout(
        client.chatManager.sendMessage(combineMessage),
        SEND_TIMEOUT,
        '发送合并消息'
      );
      onAddLog('success', `合并消息发送成功: ${sentMessage.msgServerId || sentMessage.msgLocalId}`);
    } catch (error) {
      onAddLog('error', `发送合并消息失败: ${formatError(error)}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="card">
      <div className="card-title">发送合并消息</div>

      <div className="form-group">
        <label>目标 ID</label>
        <input
          type="text"
          value={targetId}
          onChange={event => setTargetId(event.target.value)}
          placeholder="请输入对方用户 ID / 群组 ID / 聊天室 ID"
        />
      </div>

      <div className="form-group">
        <label>会话类型</label>
        <select
          value={channelType}
          onChange={event => setChannelType(event.target.value as ChannelTypeOption)}
        >
          <option value="single">单聊 single</option>
          <option value="group">群聊 group</option>
          <option value="room">聊天室 room</option>
        </select>
      </div>

      <div className="form-group">
        <label>标题</label>
        <input
          type="text"
          value={title}
          onChange={event => setTitle(event.target.value)}
          placeholder="合并消息标题"
        />
      </div>

      <div className="form-group">
        <label>摘要</label>
        <input
          type="text"
          value={summary}
          onChange={event => setSummary(event.target.value)}
          placeholder="可留空，默认按条数生成"
        />
      </div>

      <div className="form-group">
        <label>兼容文本</label>
        <input
          type="text"
          value={compatibleText}
          onChange={event => setCompatibleText(event.target.value)}
          placeholder="[聊天记录]"
        />
      </div>

      <div className="form-group">
        <label>消息 ID（支持逗号、空格、换行）</label>
        <textarea
          rows={3}
          value={idInput}
          onChange={event => setIdInput(event.target.value)}
          placeholder="例如: 123, 456"
        />
      </div>

      <div className="form-group">
        <label>快速勾选（最近 {sourceMessages.length} 条）</label>
        <div className="combine-source-list">
          {sourceMessages.length === 0 ? (
            <div className="combine-source-empty">暂无消息可选择</div>
          ) : (
            sourceMessages.map(message => {
              const id = getMessageId(message);
              if (!id) {
                return null;
              }
              const checked = selectedIds.includes(id);
              return (
                <label className="combine-source-item" key={id}>
                  <input type="checkbox" checked={checked} onChange={() => toggleSelect(id)} />
                  <span className="combine-source-text">
                    [{message.type}] {id} - {getPreviewText(message)}
                  </span>
                </label>
              );
            })
          )}
        </div>
      </div>

      <div>
        <button className="btn btn-warning" onClick={handleClearSelection} disabled={isSending}>
          清空选择
        </button>
        <button
          className="btn btn-primary"
          onClick={(): void => {
            void handleSend();
          }}
          disabled={isSending}
        >
          {isSending ? '发送中...' : '发送合并消息'}
        </button>
      </div>
    </div>
  );
};
